import { QueryClient } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { inventoryQueries } from './inventoryQueries';
import { runAutoReplenishment } from './replenishmentApi';

// Invalidate cached pages/bins, fetch only active observers; master data is unaffected.
export async function refreshReplenishmentReads(client: QueryClient) {
  const keys = [inventoryQueries.summary().queryKey, inventoryQueries.alerts().queryKey,
    inventoryQueries.history({ pageIndex: 1, pageSize: 10 }).queryKey.slice(0, -1),
    inventoryQueries.bins().queryKey, inventoryQueries.bin('').queryKey.slice(0, -1),
    inventoryQueries.contents('').queryKey.slice(0, -1)];
  await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey, refetchType: 'active' })));
}

export function replenishmentMutationOptions(client: QueryClient) {
  const owner = sessionStore.get();
  return {
    mutationKey: ['private', 'inventory', 'auto-replenishment'],
    mutationFn: () => runAutoReplenishment(),
    retry: false as const,
    // A disconnected command fails explicitly, never queues a future inventory write.
    networkMode: 'always' as const,
    onSuccess: async () => {
      if (owner === sessionStore.get()) await refreshReplenishmentReads(client);
    },
  };
}

// Synchronous latch covers two clicks before React commits the pending render.
export function createSubmissionGate() {
  let pending = false;
  return async (execute: () => Promise<unknown>) => {
    if (pending) return;
    pending = true;
    try { await execute(); } finally { pending = false; }
  };
}
