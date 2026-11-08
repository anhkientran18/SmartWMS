import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { ApiError } from '../api/apiTypes';
import { normalizeApiError } from '../api/httpClient';
import { canReadBinContext } from './inventoryReadApi';
import { inventoryKey, inventoryQueries } from './inventoryQueries';
import { TransferRequest, transferApi, transferRequest } from './transferApi';
import { transferKey, transferQueries } from './transferQueries';

export interface TransferOperationState {
  phase: 'restoring' | 'ready' | 'pending' | 'succeeded' | 'rejected' | 'uncertain';
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
  let state: TransferOperationState = { phase: 'restoring' };
  let storageKey: string | undefined;
  const listeners = new Set<() => void>();
  const set = (next: TransferOperationState) => { state = next; listeners.forEach(listener => listener()); };
  const checkOwner = () => { if (!owner || owner !== sessionStore.get() || !canReadBinContext(owner.role)) throw normalizeApiError(401); };
  const storageError = () => normalizeApiError(400, { code: 'FE_TRANSFER_STORAGE' });
  const initialize = (async () => {
    if (!owner || !canReadBinContext(owner.role)) { set({ phase: 'ready' }); return; }
    try {
      // A one-way digest correlates this login after reload; never persist a JWT,
      // username or password. This journal is a UX guard, not authorization.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner.token));
      storageKey = 'smartwms.transfer-review.' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const journal = JSON.parse(saved);
        const request = transferRequest(journal.request);
        // Even a previously pending request may have committed before reload.
        set({ phase: 'uncertain', request });
      } else set({ phase: 'ready' });
    } catch {
      // Fail closed if the journal cannot be read, including corrupt data. It
      // must not silently turn an unresolved request into an unlocked form.
      set({ phase: 'rejected', error: storageError() });
    }
  })();
  const mutation = new MutationObserver(client, { mutationKey: [...transferKey, 'create'], mutationFn: transferApi.create,
    retry: false, networkMode: 'always', gcTime: 0 });
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async submit(value: TransferRequest) {
      await initialize;
      checkOwner();
      if (state.phase !== 'ready') throw normalizeApiError(409, { code: 'FE_TRANSFER_REVIEW_REQUIRED' });
      const request = transferRequest(value);
      set({ phase: 'pending', request }); // Synchronous latch before the first POST.
      try {
        if (!storageKey) throw storageError();
        sessionStorage.setItem(storageKey, JSON.stringify({ request }));
      } catch { set({ phase: 'rejected', request, error: storageError() }); return; }
      let reference: string;
      try { reference = await mutation.mutate(request); }
      catch (caught) {
        if (owner !== sessionStore.get()) return;
        const error = caught as ApiError;
        // Server/gateway errors may occur after commit. Absence of a response and
        // malformed success envelopes are equally uncertain; never auto retry.
        const rejected = [400, 401, 403, 409].includes(error.status ?? 0);
        // Retain uncertain requests durably. Definite rejections can be cleared.
        if (rejected && storageKey) { try { sessionStorage.removeItem(storageKey); } catch { /* Conservative guard survives reload. */ } }
        set({ phase: rejected ? 'rejected' : 'uncertain', request, error });
        return;
      }
      if (owner !== sessionStore.get()) return;
      if (storageKey) { try { sessionStorage.removeItem(storageKey); } catch { /* A reload will conservatively require review. */ } }
      set({ phase: 'succeeded', request, reference, refreshing: true });
      let refreshError: unknown;
      try { await refreshTransferReads(client, request, () => owner === sessionStore.get()); } catch (error) { refreshError = error; }
      if (owner === sessionStore.get()) set({ phase: 'succeeded', request, reference, refreshError });
    },
    async reconcile() {
      checkOwner();
      if (!state.request || state.phase === 'pending' || state.phase === 'restoring' || state.phase === 'ready' || state.refreshing) return;
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
      if (state.phase === 'ready' || state.phase === 'restoring' || state.phase === 'pending' || state.refreshing ||
          state.error?.code === 'FE_TRANSFER_STORAGE' ||
          state.phase === 'uncertain' && (!state.reconciled || !externallyReviewed)) throw normalizeApiError(409);
      try { if (storageKey) sessionStorage.removeItem(storageKey); }
      catch { set({ ...state, error: storageError() }); return; }
      set({ phase: 'ready' }); // Only unlocks a NEW review; never replays the request.
    },
  };
}
// Preserve the synchronous latch and unknown outcome across route unmount/remount
// in this tab. The session journal also survives reload. AuthLifecycle clears
// caches; a new login token gets its own operation and journal identity.
const operations = new WeakMap<QueryClient, { owner: ReturnType<typeof sessionStore.get>; operation: ReturnType<typeof createTransferOperation> }>();
export function getTransferOperation(client: QueryClient) {
  const owner = sessionStore.get(), saved = operations.get(client);
  if (saved?.owner === owner) return saved.operation;
  const operation = createTransferOperation(client);
  operations.set(client, { owner, operation });
  return operation;
}
