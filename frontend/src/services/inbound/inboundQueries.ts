import { QueryClient, queryOptions } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { refreshReplenishmentReads } from '../inventory/replenishmentMutation';
import { inboundApi, PutawayRequest, ReceiveRequest } from './inboundApi';

export const inboundKey = ['private', 'inbound'] as const;
const options = <T>(key: unknown[], read: (signal: AbortSignal) => Promise<T>) => queryOptions({
  queryKey: [...inboundKey, ...key], queryFn: ({ signal }) => read(signal), retry: false, staleTime: 0, refetchOnWindowFocus: false,
});
export const inboundQueries = {
  list: () => options(['list'], inboundApi.list),
  detail: (id: string) => options(['detail', id], signal => inboundApi.detail(id, signal)),
  suggestion: (sku: string, quantity: number) => options(['suggestion', sku, quantity], signal => inboundApi.suggestion(sku, quantity, signal)),
};
export async function refreshInboundReads(client: QueryClient) {
  await Promise.all([client.invalidateQueries({ queryKey: inboundKey, refetchType: 'active' }), refreshReplenishmentReads(client)]);
}
function mutationOptions<T>(client: QueryClient, name: string, execute: (body: T) => Promise<unknown>) {
  const owner = sessionStore.get();
  return {
    mutationKey: [...inboundKey, name], mutationFn: execute, retry: false as const, networkMode: 'always' as const,
    onSuccess: async () => { if (owner === sessionStore.get()) await refreshInboundReads(client); },
    onError: async (error: { status?: number }) => {
      // A lost response may have committed. Always restore reads, never replay the command.
      if (owner === sessionStore.get() && error.status !== 401 && error.status !== 403) await refreshInboundReads(client);
    },
  };
}
export const receiveMutationOptions = (client: QueryClient) => mutationOptions<ReceiveRequest>(client, 'receive', inboundApi.receive);
export const putawayMutationOptions = (client: QueryClient) => mutationOptions<PutawayRequest>(client, 'putaway', inboundApi.putaway);
