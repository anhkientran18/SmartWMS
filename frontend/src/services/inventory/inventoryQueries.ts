import { queryOptions } from '@tanstack/react-query';
import { HistoryFilter, inventoryReadApi } from './inventoryReadApi';

export const inventoryKey = ['private', 'inventory'] as const;
const options = <T>(key: readonly unknown[], read: (signal: AbortSignal) => Promise<T>) => queryOptions({
  queryKey: [...inventoryKey, ...key], queryFn: ({ signal }) => read(signal),
  retry: false, refetchOnWindowFocus: false, staleTime: 30_000,
});
export const inventoryQueries = {
  summary: () => options(['stock-summary'], inventoryReadApi.summary),
  alerts: () => options(['low-stock-alerts'], inventoryReadApi.alerts),
  history: (filter: HistoryFilter) => options(['stock-history', filter], signal => inventoryReadApi.history(filter, signal)),
  warehouses: () => options(['warehouses'], inventoryReadApi.warehouses),
  zones: () => options(['zones'], inventoryReadApi.zones),
  bins: () => options(['bins'], inventoryReadApi.bins),
  products: () => options(['products'], inventoryReadApi.products),
  product: (id: string) => options(['products', 'detail', id.toLowerCase()], signal => inventoryReadApi.product(id, signal)),
  productQr: (sku: string) => options(['products', 'qr', sku], signal => inventoryReadApi.productQr(sku, signal)),
  productsPage: (pageNumber: number, searchKeyword: string) => options(['products', 'page', { pageNumber, searchKeyword: searchKeyword.trim() }], signal => inventoryReadApi.productsPage(pageNumber, searchKeyword, signal)),
  bin: (id: string) => options(['bin', id], signal => inventoryReadApi.bin(id, signal)),
  contents: (id: string) => options(['bin-contents', id], signal => inventoryReadApi.contents(id, signal)),
};
