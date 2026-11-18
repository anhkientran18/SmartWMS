import { queryOptions } from '@tanstack/react-query';
import { TransferFilter, transferApi } from './transferApi';

export const transferKey = ['private', 'inventory-transfers'] as const;
export const transferQueries = {
  history: (filter: TransferFilter) => queryOptions({ queryKey: [...transferKey, 'history', filter],
    queryFn: ({ signal }) => transferApi.history(filter, signal), retry: false, staleTime: 30_000, refetchOnWindowFocus: false }),
  detail: (id: string) => queryOptions({ queryKey: [...transferKey, 'detail', id.toLowerCase()],
    queryFn: ({ signal }) => transferApi.detail(id, signal), retry: false, staleTime: 30_000, refetchOnWindowFocus: false }),
};
