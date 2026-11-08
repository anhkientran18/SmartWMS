import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { ApiError } from '../api/apiTypes';
import { normalizeApiError } from '../api/httpClient';
import { canReadBinContext, inventoryReadApi } from './inventoryReadApi';
import { inventoryKey, inventoryQueries } from './inventoryQueries';
import { isTransferGuid, TransferRequest, transferApi, transferRequest } from './transferApi';
import { transferKey, transferQueries } from './transferQueries';

export interface TransferOperationState {
  phase: 'restoring' | 'ready' | 'pending' | 'succeeded' | 'rejected' | 'uncertain';
  request?: TransferRequest; reference?: string; error?: ApiError; refreshError?: unknown; refreshing?: boolean; reconciled?: boolean;
  storageWarning?: boolean;
}
type TransferJournal = { version: 1; request: TransferRequest } & (
  { status: 'pending' | 'uncertain' } | { status: 'succeeded'; reference: string }
);
function readJournal(raw: string): TransferJournal {
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid journal');
  const request = transferRequest(saved.request);
  // The original request-only journal never proved a mutation outcome.
  if (Object.keys(saved).length === 1 && 'request' in saved) return { version: 1, status: 'uncertain', request };
  if (saved.version !== 1) throw new Error('Unsupported journal version');
  if (saved.status === 'succeeded' && isTransferGuid(saved.reference)) return { version: 1, status: 'succeeded', request, reference: saved.reference };
  if (['pending', 'uncertain'].includes(saved.status) && saved.reference === undefined) return { version: 1, status: saved.status, request };
  throw new Error('Invalid journal outcome');
}
export async function refreshTransferReads(client: QueryClient, request: TransferRequest, isCurrent = () => true) {
  const checkSession = () => { if (!isCurrent()) throw normalizeApiError(401); };
  checkSession();
  const history = { pageNumber: 1, pageSize: 10 };
  const requiredKeys = [inventoryQueries.contents(request.sourceBinId).queryKey,
    inventoryQueries.contents(request.destinationBinId).queryKey, transferQueries.history(history).queryKey];
  // Cache maintenance does not certify reconciliation. Mark all affected reads
  // stale without waiting for unrelated active requests to succeed.
  await Promise.all([inventoryKey, transferKey].map(queryKey => client.invalidateQueries({ queryKey, refetchType: 'none' }))).catch(() => undefined);
  checkSession();
  void Promise.resolve().then(() => {
    checkSession();
    return client.refetchQueries({ type: 'active', predicate: query =>
      query.queryKey[0] === 'private' && ['inventory', 'inventory-transfers'].includes(String(query.queryKey[1])) &&
      !requiredKeys.some(key => JSON.stringify(key) === JSON.stringify(query.queryKey)),
    }, { throwOnError: true });
  }).catch(() => undefined); // Best effort; never gates required reads or leaks a rejection.

  async function freshRead<T>(queryKey: readonly unknown[], read: (signal: AbortSignal) => Promise<T>) {
    checkSession();
    // Cancel an older in-flight read instead of accepting its deduplicated result.
    await client.cancelQueries({ queryKey, exact: true });
    checkSession();
    return client.fetchQuery({ queryKey, staleTime: 0, retry: false, networkMode: 'always', queryFn: async ({ signal }) => {
      checkSession();
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal.aborted) abort();
      signal.addEventListener('abort', abort, { once: true });
      const unsubscribe = sessionStore.subscribe(() => { if (!isCurrent()) abort(); });
      try {
        const value = await read(controller.signal);
        checkSession(); // An adapter ignoring cancellation must not populate a new session's cache.
        return value;
      } finally { unsubscribe(); signal.removeEventListener('abort', abort); }
    } });
  }
  // Check ownership between requests; no remaining private GETs after logout.
  await freshRead(requiredKeys[0], signal => inventoryReadApi.contents(request.sourceBinId, signal));
  await freshRead(requiredKeys[1], signal => inventoryReadApi.contents(request.destinationBinId, signal));
  await freshRead(requiredKeys[2], signal => transferApi.history(history, signal));
  checkSession();
}
export function createTransferOperation(client: QueryClient) {
  const owner = sessionStore.get();
  let state: TransferOperationState = { phase: 'restoring' };
  let storageKey: string | undefined;
  const listeners = new Set<() => void>();
  const set = (next: TransferOperationState) => { state = next; listeners.forEach(listener => listener()); };
  const checkOwner = () => { if (!owner || owner !== sessionStore.get() || !canReadBinContext(owner.role)) throw normalizeApiError(401); };
  const storageError = () => normalizeApiError(400, { code: 'FE_TRANSFER_STORAGE' });
  const persist = (journal: TransferJournal) => {
    if (!storageKey) throw storageError();
    sessionStorage.setItem(storageKey, JSON.stringify(journal));
  };
  const initialize = (async () => {
    if (!owner || !canReadBinContext(owner.role)) { set({ phase: 'ready' }); return; }
    try {
      // Preserve tab/login isolation without persisting credentials or username.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner.token));
      if (owner !== sessionStore.get()) return;
      storageKey = 'smartwms.transfer-review.' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        const journal = readJournal(saved);
        set(journal.status === 'succeeded' ? { phase: 'succeeded', request: journal.request, reference: journal.reference }
          : { phase: 'uncertain', request: journal.request });
      } else set({ phase: 'ready' });
    } catch {
      if (owner === sessionStore.get()) set({ phase: 'rejected', error: storageError() });
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
      set({ phase: 'pending', request });
      try { persist({ version: 1, status: 'pending', request }); }
      catch { set({ phase: 'rejected', request, error: storageError() }); return; }
      let reference: string;
      try { reference = await mutation.mutate(request); }
      catch (caught) {
        if (owner !== sessionStore.get()) return;
        const error = caught as ApiError;
        const rejected = [400, 401, 403, 409].includes(error.status ?? 0);
        let storageWarning = false;
        try {
          if (rejected) sessionStorage.removeItem(storageKey!);
          else persist({ version: 1, status: 'uncertain', request });
        } catch { storageWarning = true; } // A persisted pending entry still restores as uncertain.
        set({ phase: rejected ? 'rejected' : 'uncertain', request, error, storageWarning });
        return;
      }
      if (owner !== sessionStore.get()) return;
      let storageWarning = false;
      try { persist({ version: 1, status: 'succeeded', request, reference }); }
      catch { storageWarning = true; } // The confirmed result remains successful and locked in memory.
      set({ phase: 'succeeded', request, reference, storageWarning, refreshing: true });
      let refreshError: unknown;
      try { await refreshTransferReads(client, request, () => owner === sessionStore.get()); } catch (error) { refreshError = error; }
      if (owner === sessionStore.get()) set({ phase: 'succeeded', request, reference, storageWarning, refreshError });
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
    acknowledge(externallyReviewed = false): boolean {
      checkOwner();
      if (state.phase === 'ready' || state.phase === 'restoring' || state.phase === 'pending' || state.refreshing ||
          state.error?.code === 'FE_TRANSFER_STORAGE' ||
          state.phase === 'uncertain' && (!state.reconciled || !externallyReviewed)) throw normalizeApiError(409, { code: 'FE_TRANSFER_REVIEW_REQUIRED' });
      try {
        // Retry journal persistence only, never the stock mutation. Do not unlock
        // a confirmed result while the post-commit storage failure still exists.
        if (state.storageWarning && state.request && state.phase !== 'rejected') {
          persist(state.phase === 'succeeded' ? { version: 1, status: 'succeeded', request: state.request, reference: state.reference! }
            : { version: 1, status: 'uncertain', request: state.request });
        }
        if (!storageKey) throw storageError();
        sessionStorage.removeItem(storageKey);
        if (sessionStorage.getItem(storageKey) !== null) throw storageError();
      } catch { set({ ...state, storageWarning: true }); return false; }
      set({ phase: 'ready' }); // Only an explicit acknowledgement unlocks a NEW review.
      return true;
    },
  };
}
// Keep the latch across route remounts. The versioned journal also survives reload;
// a different login token gets its own operation and journal identity.
const operations = new WeakMap<QueryClient, { owner: ReturnType<typeof sessionStore.get>; operation: ReturnType<typeof createTransferOperation> }>();
export function getTransferOperation(client: QueryClient) {
  const owner = sessionStore.get(), saved = operations.get(client);
  if (saved?.owner === owner) return saved.operation;
  const operation = createTransferOperation(client);
  operations.set(client, { owner, operation });
  return operation;
}
