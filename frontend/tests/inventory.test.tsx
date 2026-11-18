// Controlled frontend evidence. No real account, backend call or inventory mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { inventoryReadApi as api, canReadBinContext } from '../src/services/inventory/inventoryReadApi';
import { inventoryQueries as queries } from '../src/services/inventory/inventoryQueries';
import { inventoryService } from '../src/services/inventory/inventoryService';
import RealStockVisibility, { InventoryReadState } from '../src/features/inventory/RealStockVisibility';
import { httpClient } from '../src/services/api/httpClient';
import { bindAuthLifecycle } from '../src/features/auth/AuthProvider';
import { sessionStore } from '../src/features/auth/session';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const values = new Map<string, string>();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); }, clear: () => values.clear(), key: index => [...values.keys()][index] ?? null, get length() { return values.size; } };
globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
globalThis.document = { documentElement: { lang: '' } } as unknown as Document;
const id = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const summary = { totalProducts: 4, totalQuantity: 22, lowStockItems: 4 };
const page = { items: [], pageIndex: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };
const row = { id, productId: other, productName: 'Persisted', transactionType: 'STATUS_CHANGE', quantityChanged: 0, sourceBinCode: '', destinationBinCode: '', reasonCode: '', createdAt: '2026-10-22T00:00:00Z', createdBy: null };
const bin = { id, code: 'BIN', zoneId: other, purpose: 0, maxCapacity: 0, currentOccupancy: 0 };
const contents = { binId: id, binCode: 'BIN', purpose: 0, maxCapacity: 0, currentOccupancy: 0, utilizationPercentage: 0, items: [{ productId: other, sku: 'REAL', productName: 'Persisted', quantity: 0, status: 'NewBackendStatus', lotNumber: '', expirationDate: 'Không có hạn dùng' }] };
const user = (role: 'Admin' | 'Staff' = 'Admin') => ({ token: `test.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.unsigned`, username: 'fixture', fullName: '', role });
const response = (config, data, status = 200) => ({ config, data, status, statusText: String(status), headers: {} });
const success = data => { httpClient.defaults.adapter = async config => response(config, { isSuccess: true, data }); };
const fail = (status: number) => { httpClient.defaults.adapter = async config => { throw new axios.AxiosError('controlled', undefined, config, undefined, response(config, null, status)); }; };
// Static render inspects the settled snapshot rather than starting a mount retry.
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: 0 } } });
const render = (cache: QueryClient) => renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={cache}><RealStockVisibility /></QueryClientProvider></MemoryRouter>);

test('physical summary preserves real totals and zero; bodyless GET uses F1 Bearer/signal', async () => {
  const session = user(); sessionStore.set(session); const controller = new AbortController();
  httpClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/Inventory/stock-summary'); assert.equal(config.data, undefined);
    assert.equal(config.signal, controller.signal); assert.equal(config.headers.Authorization, `Bearer ${session.token}`);
    return response(config, { isSuccess: true, data: summary });
  };
  assert.deepEqual(await api.summary(controller.signal), summary);
  success({ totalProducts: 0, totalQuantity: 0, lowStockItems: 0 }); assert.equal((await api.summary()).totalQuantity, 0);
});

test('malformed summary and failed envelopes reject, never coerce or invent quantities', async () => {
  for (const value of [null, {}, { ...summary, totalQuantity: '22' }, { ...summary, totalQuantity: -1 }, { ...summary, totalQuantity: Number.MAX_SAFE_INTEGER + 1 }]) {
    success(value); await assert.rejects(api.summary(), error => error.code === 'FE_INVENTORY_CONTRACT');
  }
  httpClient.defaults.adapter = async config => response(config, { isSuccess: false, data: summary });
  await assert.rejects(api.summary());
});

test('alerts use exact endpoint/fields; absent products stay absent and zero is retained', async () => {
  success([{ productId: id, sku: 'REAL', productName: 'Persisted', currentStock: 0 }]);
  assert.equal((await api.alerts())[0].currentStock, 0);
  success([]); assert.deepEqual(await api.alerts(), []);
  success([{ productId: id, sku: 'REAL', productName: 'Persisted', quantity: 3 }]); await assert.rejects(api.alerts());
});

test('ledger uses pageIndex and exact filters, signed/zero deltas, and rejects wrong pagination shape', async () => {
  httpClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/Inventory/stock-history');
    assert.deepEqual(config.params, { pageIndex: 2, pageSize: 10, productId: id, transactionType: 'ADJUSTMENT' });
    return response(config, { isSuccess: true, data: { ...page, pageIndex: 2, totalCount: 12, totalPages: 2, hasPreviousPage: true, items: [{ ...row, quantityChanged: -3 }, row] } });
  };
  const result = await api.history({ pageIndex: 2, pageSize: 10, productId: id, transactionType: 'ADJUSTMENT' });
  assert.deepEqual(result.items.map(r => r.quantityChanged), [-3, 0]);
  success([]); await assert.rejects(api.history({ pageIndex: 1, pageSize: 10 }));
  success({ ...page, totalPages: 8 }); await assert.rejects(api.history({ pageIndex: 1, pageSize: 10 }));
});

test('bin contracts retain zero capacity/status; reject missing identifiers and wrong selected bin', async () => {
  success(bin); assert.equal((await api.bin(id)).maxCapacity, 0);
  success(contents); assert.equal((await api.contents(id)).items[0].status, 'NewBackendStatus');
  for (const value of [{ ...contents, binId: '' }, { ...contents, binId: other }, { ...contents, items: [{ ...contents.items[0], productId: '' }] }, { ...contents, items: null }]) {
    success(value); await assert.rejects(api.contents(id));
  }
});

test('products preserve persisted barcode/weight zero and reject malformed metadata', async () => {
  const product = { id, sku: 'REAL', name: 'Persisted', barcode: '', unit: '', weight: 0, trackingMode: 0 };
  success([product]); assert.deepEqual(await api.products(), [product]);
  success([{ ...product, weight: '250' }]); await assert.rejects(api.products());
});

test('network/500 cannot fall back to seeded or cached inventory', async () => {
  values.set('smartwms_cached_inventory_v1', JSON.stringify([{ quantity: 9999 }]));
  assert.equal(inventoryService.getCachedInventory(), null); await assert.rejects(inventoryService.getAllInventoryDetails());
  fail(500); await assert.rejects(api.summary(), error => error.status === 500);
  httpClient.defaults.adapter = async config => { throw new axios.AxiosError('offline', 'ERR_NETWORK', config); };
  await assert.rejects(api.alerts(), error => error.status === undefined);
});

test('partial history failure preserves primary summary; failed refetch hides old success in UI', async () => {
  sessionStore.set(user('Staff')); const cache = client();
  cache.setQueryData(queries.summary().queryKey, summary); cache.setQueryData(queries.alerts().queryKey, []); cache.setQueryData(queries.products().queryKey, []);
  const historyOptions = queries.history({ pageIndex: 1, pageSize: 10, productId: undefined, transactionType: undefined });
  fail(500); await assert.rejects(cache.fetchQuery(historyOptions));
  const html = render(cache); assert.match(html, /22/); assert.match(html, /role="alert"/); assert.doesNotMatch(html, /task queue/);
  cache.setQueryData(queries.summary().queryKey, summary);
  await assert.rejects(cache.fetchQuery({ ...queries.summary(), staleTime: 0 }));
  const observer = new QueryObserver(cache, queries.summary());
  const failedHtml = renderToStaticMarkup(<InventoryReadState query={observer.getCurrentResult()}><span>OLD_PRIVATE_QUANTITY</span></InventoryReadState>);
  assert.doesNotMatch(failedHtml, /OLD_PRIVATE_QUANTITY/); assert.match(failedHtml, /role="alert"/); cache.clear();
});

test('Staff UI gates management reads; 403 remains forbidden and authenticated', async () => {
  assert.equal(canReadBinContext('Staff'), false); assert.equal(canReadBinContext('Admin'), true); assert.equal(canReadBinContext('WarehouseManager'), true);
  const session = user('Staff'); sessionStore.set(session); const cache = client();
  const html = render(cache); assert.match(html, /WarehouseManager|Quản lý kho/); assert.doesNotMatch(html, /Search bin code|Tìm mã ô kệ/);
  fail(403); await assert.rejects(api.contents(id), error => error.status === 403 && error.isForbidden === true);
  assert.equal(sessionStore.get(), session); cache.clear();
});

test('query keys isolate filters; refresh refetches active reads and cancellation reaches HTTP', async () => {
  assert.notDeepEqual(queries.history({ pageIndex: 1, pageSize: 10 }).queryKey, queries.history({ pageIndex: 2, pageSize: 10 }).queryKey);
  assert.notDeepEqual(queries.contents(id).queryKey, queries.contents(other).queryKey);
  const cache = client(); let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; return response(config, { isSuccess: true, data: summary }); };
  const observer = new QueryObserver(cache, queries.summary()); const unsubscribe = observer.subscribe(() => {});
  await cache.fetchQuery(queries.summary()); const before = calls;
  await cache.refetchQueries({ queryKey: ['private', 'inventory'], type: 'active' }); assert.equal(calls, before + 1);
  unsubscribe(); let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; }); let aborted = false;
  httpClient.defaults.adapter = config => new Promise((resolve, reject) => {
    config.signal?.addEventListener?.('abort', () => { aborted = true; reject(new axios.CanceledError()); }); started();
  });
  const pending = cache.fetchQuery(queries.contents(id)); const rejected = assert.rejects(pending);
  await ready; await cache.cancelQueries({ queryKey: queries.contents(id).queryKey }); await rejected;
  assert.equal(aborted, true); cache.clear();
});

test('F1 logout/new identity disposes all F2 private queries before the next render', async () => {
  sessionStore.set(user()); const cache = client(); const unbind = bindAuthLifecycle(cache);
  cache.setQueryData(queries.summary().queryKey, summary); cache.setQueryData(queries.contents(id).queryKey, contents);
  sessionStore.set(null, 'logout'); assert.equal(cache.getQueryCache().getAll().length, 0);
  sessionStore.set(user('Staff')); assert.equal(cache.getQueryData(queries.summary().queryKey), undefined);
  assert.doesNotMatch(render(cache), /Persisted/); unbind(); cache.clear(); sessionStore.set(null);
});

test('F2 translation resources have VI/EN key parity', () => {
  const keys = (value, prefix = ''): string[] => Object.entries(value).flatMap(([key, child]) => typeof child === 'object' && child !== null ? keys(child, prefix + key + '.') : [prefix + key]);
  assert.deepEqual(keys(en.f2).sort(), keys(vi.f2).sort());
});


test('F4.5 keeps localized read errors safe while retaining structured service detail', async () => {
  const cache = client(); sessionStore.set(user('Staff'));
  const rawDetail = 'INTERNAL_SQL_DETAIL /api/v1/Inventory';
  httpClient.defaults.adapter = async config => { throw new axios.AxiosError('controlled', undefined, config, undefined, response(config, { message: rawDetail }, 500)); };
  await assert.rejects(cache.fetchQuery(queries.summary()), error => error.message === rawDetail);
  const observer = new QueryObserver(cache, queries.summary());
  for (const [locale, copy] of [['en-US', en], ['vi-VN', vi]] as const) {
    await i18n.changeLanguage(locale);
    const html = renderToStaticMarkup(<InventoryReadState query={observer.getCurrentResult()}><span>STALE_STOCK</span></InventoryReadState>);
    assert.ok(html.includes(copy.f2.error));
    assert.doesNotMatch(html, /INTERNAL_SQL_DETAIL|STALE_STOCK|\/api\/v1/);
  }
  cache.clear(); sessionStore.set(null);
});

test('F4.5 shared presentation copy has VI/EN key parity', () => {
  const keys = (value, prefix = ''): string[] => Object.entries(value).flatMap(([key, child]) => typeof child === 'object' && child !== null ? keys(child, prefix + key + '.') : [prefix + key]);
  assert.deepEqual(keys(en.ui).sort(), keys(vi.ui).sort());
});


test('F4.5 populated stock keeps real signed quantities, localized types and pagination', async () => {
  const cache = client(); sessionStore.set(user('Staff'));
  cache.setQueryData(queries.summary().queryKey, summary);
  cache.setQueryData(queries.alerts().queryKey, [{ productId: other, sku: 'PERSISTED-SKU', productName: 'Persisted product', currentStock: 0 }]);
  cache.setQueryData(queries.products().queryKey, []);
  cache.setQueryData(queries.history({ pageIndex: 1, pageSize: 10, productId: undefined, transactionType: undefined }).queryKey,
    { ...page, totalCount: 2, totalPages: 1, items: [{ ...row, quantityChanged: -3 }, { ...row, id: other, transactionType: 'FUTURE_CODE' }] });
  for (const [locale, copy] of [['en-US', en], ['vi-VN', vi]] as const) {
    await i18n.changeLanguage(locale);
    const html = render(cache);
    assert.ok(html.includes(copy.ui.transactions.STATUS_CHANGE));
    assert.match(html, /FUTURE_CODE/);
    assert.match(html, /PERSISTED-SKU/);
    assert.match(html, />-3</);
    assert.match(html, /aria-current="page"/);
    assert.ok(html.includes(copy.common.pagination.next));
    assert.doesNotMatch(html, /Loading backend|API THẬT|Real API/);
  }
  cache.clear(); sessionStore.set(null);
});

import './transfers.test';
