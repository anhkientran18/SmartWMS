import axios from 'axios';
import { sessionStore } from '../../features/auth/session';
import { ApiError } from '../api/apiTypes';
import { normalizeApiError } from '../api/httpClient';
import { BarcodeResolution, canReadProducts, inventoryReadApi } from './inventoryReadApi';

export interface LookupState { pending: boolean; result?: BarcodeResolution; error?: ApiError }
// Explicit read operation: synchronous latch, no retry, no cache invalidation.
export function createBarcodeLookup() {
  const owner = sessionStore.get();
  let state: LookupState = { pending: false };
  let disposed = false;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: LookupState) => { state = next; listeners.forEach(listener => listener()); };
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset() { if (!state.pending) publish({ pending: false }); },
    async submit(raw: string) {
      if (disposed || state.pending) return;
      if (!owner || owner !== sessionStore.get() || !canReadProducts(owner.role)) {
        publish({ pending: false, error: normalizeApiError(403) }); return;
      }
      controller = new AbortController();
      publish({ pending: true });
      try {
        const result = await inventoryReadApi.resolveBarcode(raw, controller.signal);
        if (!disposed && owner === sessionStore.get()) publish({ pending: false, result });
      } catch (error) {
        if (!disposed && owner === sessionStore.get() && !axios.isCancel(error)) publish({ pending: false, error: error as ApiError });
      }
    },
    dispose() { disposed = true; controller?.abort(); listeners.clear(); },
  };
}
