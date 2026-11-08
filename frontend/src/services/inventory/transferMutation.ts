import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { ApiError } from '../api/apiTypes';
import { normalizeApiError } from '../api/httpClient';
import { canReadBinContext } from './inventoryReadApi';
import { inventoryKey, inventoryQueries } from './inventoryQueries';
import { TransferRequest, transferApi, transferRequest } from './transferApi';
import { transferKey, transferQueries } from './transferQueries';

export interface TransferOperationState {
  phase: 'ready' | 'pending' | 'succeeded' | 'rejected' | 'uncertain';
  request?: TransferRequest; reference?: string; error?: ApiError; refreshError?: unknown; refreshing?: boolean; reconciled?: boolean;
}
export async function refreshTransferReads(client: QueryClient, request: TransferRequest, isCurrent = () => true) {
  if (!isCurrent()) return;
  await Promise.all([inventoryKey, transferKey].map(queryKey => client.invalidateQueries({ queryKey, refetchType: 'active' }, { throwOnError: true })));
  // Fetch these even when their panels are unmounted. Merely invalidating inactive
  // queries cannot provide reconciliation evidence. These reads NEVER submit stock.
  if (!isCurrent()) return;
  await Promise.all([
    client.fetchQuery({ ...inventoryQueries.contents(request.sourceBinId), staleTime: 0 }),
    client.fetchQuery({ ...inventoryQueries.contents(request.destinationBinId), staleTime: 0 }),
    client.fetchQuery({ ...transferQueries.history({ pageNumber: 1, pageSize: 10 }), staleTime: 0 }),
  ]);
}
export function createTransferOperation(client: QueryClient) {
  const owner = sessionStore.get();
  let state: TransferOperationState = { phase: 'ready' };
  const listeners = new Set<() => void>();
  const set = (next: TransferOperationState) => { state = next; listeners.forEach(listener => listener()); };
  const checkOwner = () => { if (!owner || owner !== sessionStore.get() || !canReadBinContext(owner.role)) throw normalizeApiError(401); };
  const mutation = new MutationObserver(client, { mutationKey: [...transferKey, 'create'], mutationFn: transferApi.create,
    retry: false, networkMode: 'always', gcTime: 0 });
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async submit(value: TransferRequest) {
      checkOwner();
      if (state.phase !== 'ready') throw normalizeApiError(409, { code: 'FE_TRANSFER_REVIEW_REQUIRED' });
      const request = transferRequest(value);
      set({ phase: 'pending', request }); // Synchronous guard, including double clicks before React rerenders.
      let reference: string;
      try { reference = await mutation.mutate(request); }
      catch (caught) {
        if (owner !== sessionStore.get()) return;
        const error = caught as ApiError;
        // Server/gateway errors may occur after commit. Absence of a response and
        // malformed success envelopes are equally uncertain; never auto retry.
        set({ phase: [400, 401, 403, 409].includes(error.status ?? 0) ? 'rejected' : 'uncertain', request, error });
        return;
      }
      if (owner !== sessionStore.get()) return;
      set({ phase: 'succeeded', request, reference, refreshing: true });
      let refreshError: unknown;
      try { await refreshTransferReads(client, request, () => owner === sessionStore.get()); } catch (error) { refreshError = error; }
      if (owner === sessionStore.get()) set({ phase: 'succeeded', request, reference, refreshError });
    },
    async reconcile() {
      checkOwner();
      if (!state.request || state.phase === 'pending' || state.phase === 'ready' || state.refreshing) return;
      const previous = state;
      set({ ...previous, refreshing: true, reconciled: false, refreshError: undefined });
      try {
        await refreshTransferReads(client, previous.request!, () => owner === sessionStore.get());
        if (owner === sessionStore.get()) set({ ...previous, refreshing: false, reconciled: true, refreshError: undefined });
      } catch (error) {
        if (owner === sessionStore.get()) set({ ...previous, refreshing: false, reconciled: false, refreshError: error });
      }
    },
    acknowledge(externallyReviewed = false) {
      checkOwner();
      if (state.phase === 'ready' || state.phase === 'pending' || state.refreshing ||
          state.phase === 'uncertain' && (!state.reconciled || !externallyReviewed)) throw normalizeApiError(409);
      set({ phase: 'ready' }); // Only unlocks a NEW review; never replays the request.
    },
  };
}
// Preserve the synchronous latch and unknown outcome across route unmount/remount
// in this tab. AuthLifecycle clears caches; a new session gets a new operation.
const operations = new WeakMap<QueryClient, { owner: ReturnType<typeof sessionStore.get>; operation: ReturnType<typeof createTransferOperation> }>();
export function getTransferOperation(client: QueryClient) {
  const owner = sessionStore.get(), saved = operations.get(client);
  if (saved?.owner === owner) return saved.operation;
  const operation = createTransferOperation(client);
  operations.set(client, { owner, operation });
  return operation;
}
