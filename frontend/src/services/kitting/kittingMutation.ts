import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { normalizeApiError } from '../api/httpClient';
import { ApiError } from '../api/apiTypes';
import { inventoryQueries } from '../inventory/inventoryQueries';
import { AssembleKitRequest, assemblyRequest, kittingApi } from './kittingApi';

export async function refreshAssemblyReads(client: QueryClient, body: AssembleKitRequest) {
  const keys: (readonly unknown[])[] = [
    inventoryQueries.summary().queryKey,
    inventoryQueries.alerts().queryKey,
    inventoryQueries.history({ pageIndex: 1, pageSize: 10 }).queryKey.slice(0, -1),
    inventoryQueries.bins().queryKey,
  ];
  for (const id of new Set([body.targetBinId, ...body.components.map(row => row.sourceBinId)].flatMap(id => [id, id.toLowerCase()]))) {
    keys.push(inventoryQueries.bin(id).queryKey, inventoryQueries.contents(id).queryKey);
  }
  // Mark inactive reads stale; refetch mounted observers. Any active read failure
  // prevents acknowledging reconciliation. Never overwrite stock optimistically.
  await Promise.all(keys.map(queryKey => client.invalidateQueries(
    { queryKey, refetchType: 'active' }, { throwOnError: true },
  )));
}

// These are ephemeral request-safety states, never assembly-order statuses.
export interface AssemblyOperationState {
  phase: 'ready' | 'pending' | 'succeeded' | 'rejected' | 'review-required';
  outcome?: 'confirmed' | 'unknown' | 'conflict';
  error?: ApiError;
  refreshError?: unknown;
}

// One instance per workspace. UI must confirm a request before calling submit,
// and clear its draft after succeeded. No request is persisted or replayed.
export function createAssemblyOperation(client: QueryClient) {
  const owner = sessionStore.get();
  let state: AssemblyOperationState = { phase: 'ready' };
  let draft: AssembleKitRequest | undefined;
  let reviewing = false;
  const listeners = new Set<() => void>();
  const set = (next: AssemblyOperationState) => { state = next; listeners.forEach(listener => listener()); };
  const checkOwner = () => { if (!owner || owner !== sessionStore.get()) throw normalizeApiError(401); };
  const mutation = new MutationObserver(client, {
    mutationKey: ['private', 'kitting', 'assemble'],
    mutationFn: kittingApi.assemble,
    retry: false,
    networkMode: 'always',
    gcTime: 0,
  });
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async submit(value: AssembleKitRequest) {
      checkOwner();
      if (reviewing || state.phase !== 'ready') throw normalizeApiError(409, { code: 'FE_KITTING_REVIEW_REQUIRED' });
      draft = assemblyRequest(value); // Isolate from subsequent edits to the caller's form.
      set({ phase: 'pending' }); // Synchronous latch before mutation scheduling.
      let outcome: AssemblyOperationState['outcome'];
      let error: ApiError | undefined;
      try {
        await mutation.mutate(draft);
        outcome = 'confirmed';
      } catch (caught) {
        error = caught as ApiError;
        outcome = error.status === 409 ? 'conflict' :
          [400, 401, 403].includes(error.status) ? undefined : 'unknown';
      }
      if (owner !== sessionStore.get()) return; // No old-session cache reads or UI feedback.
      let refreshError: unknown;
      if (outcome) {
        try { await refreshAssemblyReads(client, draft); } catch (caught) { refreshError = caught; }
      }
      if (owner !== sessionStore.get()) return;
      set({ phase: outcome === 'confirmed' && !refreshError ? 'succeeded' : outcome ? 'review-required' : 'rejected', outcome, error, refreshError });
    },
    // Explicit operator action after reviewing inventory/history. This only
    // refreshes reads and unlocks a NEW confirmation; it never submits a draft.
    async acknowledgeReview() {
      checkOwner();
      if (reviewing || state.phase === 'pending' || state.phase === 'ready') return;
      reviewing = true;
      try {
        if (draft && state.phase === 'review-required') await refreshAssemblyReads(client, draft);
        checkOwner();
        draft = undefined;
        set({ phase: 'ready' });
      } finally { reviewing = false; }
    },
  };
}
