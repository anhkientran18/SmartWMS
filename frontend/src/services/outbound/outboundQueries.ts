import { QueryClient, queryOptions } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { inventoryQueries } from '../inventory/inventoryQueries';
import { CreateOutbound, Outbound, OutboundCommand, OutboundFilter, outboundApi } from './outboundApi';

export const outboundKey = ['private', 'outbound'] as const;
const options = <T>(key: unknown[], read: (signal: AbortSignal) => Promise<T>) => queryOptions({ queryKey: [...outboundKey, ...key], queryFn: ({ signal }) => read(signal), retry: false, staleTime: 0, refetchOnWindowFocus: false });
export const outboundQueries = {
  list: (filter: OutboundFilter) => options(['list', filter], signal => outboundApi.list(filter, signal)),
  detail: (id: string) => options(['detail', id], signal => outboundApi.detail(id, signal)),
  customers: () => options(['customers'], outboundApi.customers),
};
export async function refreshOutboundReads(client: QueryClient, command?: OutboundCommand) {
  const keys: readonly unknown[][] = [ [...outboundKey, 'list'], ...(command ? [outboundQueries.detail(command.id).queryKey] : []) ];
  const affected: (readonly unknown[])[] = [...keys];
  if (command && ['allocate', 'pick', 'ship', 'cancel'].includes(command.action)) {
    affected.push(inventoryQueries.history({ pageIndex: 1, pageSize: 10 }).queryKey.slice(0, -1));
  }
  if (command && ['allocate', 'pick', 'cancel'].includes(command.action)) {
    const order = client.getQueryData<Outbound>(outboundQueries.detail(command.id).queryKey);
    // Detail is loaded before review. If unavailable after a failed command, invalidate
    // only these stock families conservatively; never refresh unrelated master data.
    affected.push(order ? inventoryQueries.bin(order.binId).queryKey : inventoryQueries.bin('').queryKey.slice(0, -1),
      order ? inventoryQueries.contents(order.binId).queryKey : inventoryQueries.contents('').queryKey.slice(0, -1));
  }
  if (command?.action === 'pick') affected.push(inventoryQueries.bins().queryKey, inventoryQueries.summary().queryKey, inventoryQueries.alerts().queryKey);
  await Promise.all(affected.map(queryKey => client.invalidateQueries({ queryKey, refetchType: 'active' })));
}
function mutationOptions<T, R>(client: QueryClient, name: string, execute: (body: T) => Promise<R>, command: (body: T) => OutboundCommand | undefined) {
  const owner = sessionStore.get();
  const refresh = async (body: T, error?: { status?: number }) => {
    if (owner === sessionStore.get() && error?.status !== 401 && error?.status !== 403) await refreshOutboundReads(client, command(body));
  };
  return { mutationKey: [...outboundKey, name], mutationFn: execute, retry: false as const, networkMode: 'always' as const,
    onSuccess: async (_: R, body: T) => refresh(body), onError: async (error: { status?: number }, body: T) => refresh(body, error) };
}
export const outboundMutationOptions = (client: QueryClient) => mutationOptions(client, 'execute', outboundApi.execute, body => body);
export const createOutboundMutationOptions = (client: QueryClient) => mutationOptions<CreateOutbound, string>(client, 'create', outboundApi.create, () => undefined);
