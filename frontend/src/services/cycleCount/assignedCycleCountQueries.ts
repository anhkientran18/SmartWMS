import { QueryClient, queryOptions } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { guid } from '../inbound/inboundApi';
import { inventoryQueries } from '../inventory/inventoryQueries';
import { assignedCountApi, canManageCounts, canExecuteCounts, CountSheet, CreateCount, ConfirmCount } from './assignedCycleCountApi';

export const countKey = ['private','cycle-counts'] as const;
const options = <T>(key: unknown[], read: (signal: AbortSignal) => Promise<T>, enabled = true) => queryOptions({ queryKey: [...countKey,...key], queryFn: ({ signal }) => read(signal), enabled, retry: false, staleTime: 0, refetchOnWindowFocus: false });
export const countQueries = {
  assignees: () => options(['assignees'], assignedCountApi.assignees, canManageCounts(sessionStore.get()?.role)),
  pendingTasks: () => options(['pending-tasks'], assignedCountApi.pendingTasks, canExecuteCounts(sessionStore.get()?.role)),
  detail: (id: string) => options(['detail',id], signal => assignedCountApi.detail(id, signal), guid(id) && canExecuteCounts(sessionStore.get()?.role)),
};
export async function refreshCountReads(client: QueryClient, id: string, inventory = false, forbidden = false) {
  const keys: (readonly unknown[])[] = [countQueries.pendingTasks().queryKey];
  if (!forbidden) keys.push(countQueries.detail(id).queryKey);
  else client.removeQueries({ queryKey: countQueries.detail(id).queryKey, exact: true });
  if (inventory) {
    keys.push(inventoryQueries.summary().queryKey, inventoryQueries.alerts().queryKey, inventoryQueries.history({ pageIndex: 1,pageSize: 10 }).queryKey.slice(0,-1));
    if (canManageCounts(sessionStore.get()?.role)) {
      keys.push(inventoryQueries.bins().queryKey);
      const sheet = client.getQueryData<CountSheet>(countQueries.detail(id).queryKey);
      for (const binId of new Set(sheet?.items.map(i => i.binId) ?? [])) keys.push(inventoryQueries.bin(binId).queryKey, inventoryQueries.contents(binId).queryKey);
    }
  }
  await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey,refetchType: 'active' })));
}
export function createCountOptions(client: QueryClient) {
  const owner = sessionStore.get();
  return { mutationKey: [...countKey,'create'], mutationFn: (body: CreateCount) => assignedCountApi.create(body), retry: false as const, networkMode: 'always' as const,
    onSuccess: async (id: string) => { if (owner === sessionStore.get()) await refreshCountReads(client,id); } };
}
export function confirmCountOptions(client: QueryClient) {
  const owner = sessionStore.get();
  return { mutationKey: [...countKey,'confirm'], mutationFn: (body: ConfirmCount) => assignedCountApi.confirm(body), retry: false as const, networkMode: 'always' as const,
    onSuccess: async (_: void, body: ConfirmCount) => { if (owner === sessionStore.get()) await refreshCountReads(client,body.countSheetId,true); },
    onError: async (error: { status?: number }, body: ConfirmCount) => {
      if (owner === sessionStore.get() && error.status !== 401) await refreshCountReads(client,body.countSheetId,error.status !== 403,error.status === 403);
    } };
}
