import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient, onlineManager, QueryObserver } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { assemblyRequest, assemblyPreview, canAssembleKit, kitQuantity, KIT_INT_MAX, kittingApi } from '../src/services/kitting/kittingApi';
import { createAssemblyOperation, refreshAssemblyReads } from '../src/services/kitting/kittingMutation';
import { inventoryQueries } from '../src/services/inventory/inventoryQueries';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import KittingWorkspace, { AssemblyConfirmation, componentRequirement } from '../src/features/kitting/KittingWorkspace';
import { sameProduct, binLabel } from '../src/features/kitting/KittingSelectors';
import { inventoryReadApi } from '../src/services/inventory/inventoryReadApi';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';
import i18n from '../src/i18n';

globalThis.window = new EventTarget() as any;
globalThis.document = { documentElement: { lang: '' } } as any;
const id = (n: number) => `abcdef00-0000-0000-0000-${String(n).padStart(12, '0')}`;
const body = { kitProductId: id(1), targetBinId: id(2), assembleQuantity: 2, components: [{ componentProductId: id(3), sourceBinId: id(4), quantityPerKit: 3 }] };
const response = (config: any, data: any, status = 200) => ({ config, data, status, headers: {}, statusText: String(status) });
const user = (role = 'Admin') => ({ token: `fixture.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.unsigned`, username: 'fixture', role: role as any });
function ok(data: unknown = true, role = 'Admin') { sessionStore.set(user(role)); httpClient.defaults.adapter = async config => response(config, { isSuccess: true, data }); }
function fail(status?: number) { httpClient.defaults.adapter = async config => { throw new axios.AxiosError('fixture', undefined, config, undefined, status ? response(config, { errorCode: 'BUSINESS', message: 'specific backend error' }, status) : undefined); }; }
const cache = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
const spyReads = (client: QueryClient) => { const keys: any[] = []; client.invalidateQueries = async (filters: any) => { keys.push(filters.queryKey); }; return keys; };

test('exact POST and direct whitelisted body, boolean success only', async () => {
  ok(); let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; assert.equal(config.url, '/api/v1/Kitting/assemble'); assert.equal(config.method, 'post'); assert.deepEqual(JSON.parse(config.data), body); return response(config, { isSuccess: true, data: true }); };
  assert.equal(await kittingApi.assemble(body), true); assert.equal(calls, 1);
});
test('unsupported fields and frontend row identities never reach wire', () => {
  const extras = { bomId: id(9), assemblyId: id(9), lotNumber: 'LOT', expirationDate: '2030-01-01', lpn: 'LPN', serial: 'S', reservation: id(9), inventoryRowId: id(9), operatorId: id(9), rowId: 'local' };
  assert.deepEqual(assemblyRequest({ ...body, ...extras, requestData: body, components: [{ ...body.components[0], ...extras }] } as any), body);
});
test('Admin and WM allowed; Staff/missing/unknown roles cannot send', async () => {
  for (const role of ['Admin', 'WarehouseManager']) { ok(true, role); assert.equal(canAssembleKit(role), true); await kittingApi.assemble(body); }
  for (const role of ['Staff', undefined, 'Other']) { ok(true, role); if (!role) sessionStore.set(null); let calls = 0; httpClient.defaults.adapter = async c => { calls++; return response(c, {}); }; assert.equal(canAssembleKit(role), false); await assert.rejects(kittingApi.assemble(body), (e: any) => e.status === 403); assert.equal(calls, 0); }
});
test('invalid required GUIDs rejected locally with field paths', () => {
  for (const key of ['kitProductId', 'targetBinId']) for (const value of ['', 'bad', '00000000-0000-0000-0000-000000000000']) assert.throws(() => assemblyRequest({ ...body, [key]: value }), (e: any) => e.code === 'FE_KITTING_INPUT' && !!e.errors[key]);
  for (const key of ['componentProductId', 'sourceBinId']) assert.throws(() => assemblyRequest({ ...body, components: [{ ...body.components[0], [key]: '' }] }), (e: any) => !!e.errors[`components.0.${key}`]);
});
test('nonempty recipe and non-null rows required', () => {
  for (const components of [[], null, [null], new Array(1)]) assert.throws(() => assemblyRequest({ ...body, components } as any));
});
test('positive Int32 quantities and exact bounds for both quantity fields', () => {
  for (const v of [0, -1, 1.5, NaN, Infinity, KIT_INT_MAX + 1, '2', null]) { assert.equal(kitQuantity(v), false); assert.throws(() => assemblyRequest({ ...body, assembleQuantity: v } as any)); assert.throws(() => assemblyRequest({ ...body, components: [{ ...body.components[0], quantityPerKit: v }] } as any)); }
  assert.equal(kitQuantity(KIT_INT_MAX), true); assert.equal(kitQuantity(1), true);
  assert.equal(assemblyPreview({ ...body, assembleQuantity: KIT_INT_MAX, components: [{ ...body.components[0], quantityPerKit: 1 }] }).rows[0].requiredQuantity, KIT_INT_MAX);
});
test('required quantities are local presentation without mutating inputs', () => {
  const before = structuredClone(body); const p = assemblyPreview(body);
  assert.equal(p.rows[0].requiredQuantity, 6); assert.equal(p.aggregated[0].requiredQuantity, 6); assert.deepEqual(body, before);
});
test('duplicate rows preserved, aggregate preview matches backend grouping', () => {
  const value = { ...body, components: [...body.components, { ...body.components[0], sourceBinId: id(4).toUpperCase(), componentProductId: id(3).toUpperCase() }] };
  assert.equal(assemblyRequest(value).components.length, 2); const p = assemblyPreview(value); assert.equal(p.rows.length, 2); assert.equal(p.aggregated.length, 1); assert.equal(p.aggregated[0].requiredQuantity, 12);
});
test('aggregate is scoped to bin/product, separate bins remain independent', () => {
  assert.equal(assemblyPreview({ ...body, components: [...body.components, { ...body.components[0], sourceBinId: id(5) }] }).aggregated.length, 2);
});
test('multiply overflow and duplicate aggregate overflow reject exactly', () => {
  assert.throws(() => assemblyRequest({ ...body, assembleQuantity: KIT_INT_MAX }));
  assert.throws(() => assemblyRequest({ ...body, assembleQuantity: 1, components: [{ ...body.components[0], quantityPerKit: KIT_INT_MAX }, body.components[0]] }));
  assert.throws(() => assemblyRequest({ ...body, assembleQuantity: KIT_INT_MAX, components: [{ ...body.components[0], quantityPerKit: KIT_INT_MAX }] }));
});
test('logical self-use rejected irrespective of GUID casing; same bin permitted', () => {
  assert.throws(() => assemblyRequest({ ...body, components: [{ ...body.components[0], componentProductId: id(1).toUpperCase() }] }));
  assert.equal(assemblyRequest({ ...body, targetBinId: id(4) }).targetBinId, id(4));
});
test('invalid local input makes zero HTTP calls', async () => {
  ok(); let calls = 0; httpClient.defaults.adapter = async c => { calls++; return response(c, {}); };
  await assert.rejects(kittingApi.assemble({ ...body, assembleQuantity: 0 })); assert.equal(calls, 0);
});
test('false/string/missing/malformed response cannot report success', async () => {
  for (const data of [false, 'true', id(1), null, undefined, {}]) { ok(); httpClient.defaults.adapter = async c => response(c, { isSuccess: true, data }); await assert.rejects(kittingApi.assemble(body), (e: any) => e.status === 502); }
  ok(); httpClient.defaults.adapter = async c => response(c, { data: true }); await assert.rejects(kittingApi.assemble(body));
});
test('F1 400/401/403/409/network errors retained without mock fallback', async () => {
  for (const status of [400, 401, 403, 409, undefined]) { ok(); fail(status); await assert.rejects(kittingApi.assemble(body), (e: any) => e.status === status && (status === undefined || e.code === 'BUSINESS')); }
});
test('success targets F2 summary alerts all history pages and participating bin reads only', async () => {
  ok(); const c = cache(); const keys = spyReads(c); c.setQueryData(['unrelated'], 'keep');
  await refreshAssemblyReads(c, body);
  assert.deepEqual(keys, [inventoryQueries.summary().queryKey, inventoryQueries.alerts().queryKey, inventoryQueries.history({ pageIndex: 1, pageSize: 10 }).queryKey.slice(0, -1), inventoryQueries.bins().queryKey, inventoryQueries.bin(id(2)).queryKey, inventoryQueries.contents(id(2)).queryKey, inventoryQueries.bin(id(4)).queryKey, inventoryQueries.contents(id(4)).queryKey]);
  assert.equal(c.getQueryData(['unrelated']), 'keep'); assert(!keys.some(k => k.includes('products') || k.includes('kitting'))); c.clear();
});
test('all cached history pages stale; inventory and product data never optimistically changed', async () => {
  ok(); const c = cache(); const h1 = inventoryQueries.history({ pageIndex: 1, pageSize: 10 }).queryKey; const h2 = inventoryQueries.history({ pageIndex: 2, pageSize: 10 }).queryKey;
  c.setQueryData(h1, ['old1']); c.setQueryData(h2, ['old2']); c.setQueryData(inventoryQueries.summary().queryKey, { totalQuantity: 100 }); c.setQueryData(inventoryQueries.products().queryKey, ['catalog']);
  await createAssemblyOperation(c).submit(body);
  for (const key of [h1, h2]) assert.equal(c.getQueryState(key)?.isInvalidated, true);
  assert.deepEqual(c.getQueryData(h1), ['old1']); assert.deepEqual(c.getQueryData(inventoryQueries.summary().queryKey), { totalQuantity: 100 }); assert.equal(c.getQueryState(inventoryQueries.products().queryKey)?.isInvalidated, false); c.clear();
});
test('synchronous double submit blocked; pending draft is copied, no optimistic write', async () => {
  ok(); const c = cache(); spyReads(c); const op = createAssemblyOperation(c); let release!: () => void; let calls = 0; const draft = structuredClone(body);
  httpClient.defaults.adapter = async config => { calls++; await new Promise<void>(r => release = r); assert.deepEqual(JSON.parse(config.data), body); return response(config, { isSuccess: true, data: true }); };
  const first = op.submit(draft); assert.equal(op.getState().phase, 'pending'); draft.components[0].quantityPerKit = 999;
  await assert.rejects(op.submit(body)); assert.equal(calls, 1); release(); await first; assert.equal(op.getState().phase, 'succeeded'); c.clear();
});
test('confirmed success blocks repetition until deliberate new-request action', async () => {
  ok(); const c = cache(); spyReads(c); const op = createAssemblyOperation(c); await op.submit(body); await assert.rejects(op.submit(body)); await op.acknowledgeReview(); assert.equal(op.getState().phase, 'ready'); await op.submit(body); assert.equal(op.getState().outcome, 'confirmed'); c.clear();
});
test('409 and uncertain results refresh once, no retries, review required before new confirmation', async () => {
  for (const status of [409, undefined, 408, 500]) {
    ok(); fail(status); const adapter: any = httpClient.defaults.adapter; let calls = 0; httpClient.defaults.adapter = async config => { calls++; return adapter(config); };
    const c = cache(); const keys = spyReads(c); const op = createAssemblyOperation(c); await op.submit(body);
    assert.equal(calls, 1); assert.equal(op.getState().phase, 'review-required'); assert.equal(op.getState().outcome, status === 409 ? 'conflict' : 'unknown'); assert(keys.length > 0);
    await assert.rejects(op.submit(body)); await op.acknowledgeReview(); assert.equal(calls, 1); assert.equal(op.getState().phase, 'ready'); c.clear();
  }
});
test('400 preserves specific business error, not shortage; 403 stops without replay', async () => {
  for (const status of [400, 403]) { ok(); fail(status); const c = cache(); const keys = spyReads(c); const op = createAssemblyOperation(c); await op.submit(body); assert.equal(op.getState().phase, 'rejected'); assert.equal(op.getState().error?.message, 'specific backend error'); assert.equal(keys.length, 0); await assert.rejects(op.submit(body)); c.clear(); }
});
test('no reconnect queued write even when TanStack is offline', async () => {
  ok(); onlineManager.setOnline(false); const c = cache(); spyReads(c); const op = createAssemblyOperation(c); let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; throw new axios.AxiosError('offline', undefined, config); };
  try { await op.submit(body); assert.equal(calls, 1); onlineManager.setOnline(true); await new Promise(r => setTimeout(r, 20)); assert.equal(calls, 1); assert.equal(op.getState().phase, 'review-required'); } finally { onlineManager.setOnline(true); c.clear(); }
});
test('known browser offline fails before HTTP, no delayed write', async () => {
  ok(); const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } }); let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; return response(config, {}); };
  try { await assert.rejects(kittingApi.assemble(body)); assert.equal(calls, 0); } finally { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete (globalThis as any).navigator; }
});
test('refresh failure retains known success and blocks another write until reviewed', async () => {
  ok(); const c = cache(); c.invalidateQueries = async () => { throw Error('read failed'); }; const op = createAssemblyOperation(c); await op.submit(body);
  assert.equal(op.getState().phase, 'review-required'); assert.equal(op.getState().outcome, 'confirmed'); assert(op.getState().refreshError); await assert.rejects(op.acknowledgeReview()); await assert.rejects(op.submit(body)); spyReads(c); await op.acknowledgeReview(); assert.equal(op.getState().phase, 'ready'); c.clear();
});
test('active inventory observers actually refetch authoritative data after success', async () => {
  ok(); const c = cache(); const key = inventoryQueries.summary().queryKey; c.setQueryData(key, { totalQuantity: 10 }); let reads = 0;
  const observer = new QueryObserver(c, { queryKey: key, queryFn: async () => { reads++; return { totalQuantity: 12 }; }, staleTime: Infinity }); const off = observer.subscribe(() => {});
  await createAssemblyOperation(c).submit(body); assert.equal(reads, 1); assert.deepEqual(c.getQueryData(key), { totalQuantity: 12 }); off(); c.clear();
});
test('actual active query failure blocks reconciliation despite confirmed command', async () => {
  ok(); const c = cache(); const key = inventoryQueries.summary().queryKey; c.setQueryData(key, { totalQuantity: 10 });
  const observer = new QueryObserver(c, { queryKey: key, queryFn: async () => { throw Error('refresh failed'); }, retry: false, staleTime: Infinity }); const off = observer.subscribe(() => {});
  const op = createAssemblyOperation(c); await op.submit(body); assert.equal(op.getState().phase, 'review-required'); assert.equal(op.getState().outcome, 'confirmed'); assert(op.getState().refreshError); await assert.rejects(op.acknowledgeReview()); await assert.rejects(op.submit(body)); off(); c.clear();
});
test('malformed/failed HTTP200 success envelopes require reconciliation, never claim no change', async () => {
  for (const envelope of [{ isSuccess: true, data: false }, { isSuccess: false, data: true }, { data: true }]) {
    ok(); const c = cache(); const keys = spyReads(c); httpClient.defaults.adapter = async config => response(config, envelope);
    const op = createAssemblyOperation(c); await op.submit(body); assert.equal(op.getState().phase, 'review-required'); assert.equal(op.getState().outcome, 'unknown'); assert(keys.length > 0); await assert.rejects(op.submit(body)); c.clear();
  }
});
test('session change cannot submit or reconcile a previous session operation', async () => {
  ok(); const c = cache(); const keys = spyReads(c); const op = createAssemblyOperation(c); let release!: () => void;
  httpClient.defaults.adapter = async config => { await new Promise<void>(r => release = r); return response(config, { isSuccess: true, data: true }); };
  const pending = op.submit(body); await new Promise(r => setTimeout(r, 0)); sessionStore.set(user('WarehouseManager')); release(); await pending; assert.equal(keys.length, 0); await assert.rejects(op.submit(body)); await assert.rejects(op.acknowledgeReview()); c.clear();
});
test('no management routes, production mocks, persistence, or optimistic cache writes', () => {
  assert.deepEqual(Object.keys(kittingApi), ['assemble']);
  for (const file of ['src/services/kitting/kittingApi.ts', 'src/services/kitting/kittingMutation.ts']) { const source = readFileSync(file, 'utf8'); assert(!/localStorage|setQueryData|mockProvider|requestData:|\/Kitting\/(orders|history|bom|detail)/.test(source)); }
});
test('paged Product reads reuse real route, server search/page, F1 cancellation and inventory keys', async () => {
  ok(); const signal = new AbortController().signal; const product = { id: id(1), sku: 'ORDINARY', name: 'Ordinary product', barcode: '', unit: 'pcs', weight: 0, trackingMode: 0 };
  httpClient.defaults.adapter = async config => { assert.equal(config.url, '/api/v1/Products'); assert.deepEqual(config.params, { pageNumber: 2, pageSize: 20, searchKeyword: 'Ordinary' }); assert.equal(config.signal, signal); return response(config, { isSuccess: true, data: { items: [product], pageIndex: 2, pageSize: 20, totalCount: 21, totalPages: 2, hasPreviousPage: true, hasNextPage: false } }); };
  assert.deepEqual((await inventoryReadApi.productsPage(2, ' Ordinary ', signal)).items, [product]);
  assert.deepEqual(inventoryQueries.productsPage(2, ' Ordinary ').queryKey.slice(0, 3), inventoryQueries.products().queryKey);
});
test('malformed Product page or mismatched pagination is rejected without fallback', async () => {
  for (const data of [{ items: [] }, { items: [], pageIndex: 2, pageSize: 20, totalCount: 0, totalPages: 0, hasPreviousPage: true, hasNextPage: false }]) { ok(data); await assert.rejects(inventoryReadApi.productsPage(1, '')); }
});
test('component exclusion compares only Product ID, including GUID casing', () => {
  assert.equal(sameProduct(id(1), id(1).toUpperCase()), true); assert.equal(sameProduct(id(1), id(2)), false); assert.equal(sameProduct(undefined, undefined), false);
  const source = readFileSync('src/features/kitting/KittingSelectors.tsx', 'utf8'); assert(source.includes('!sameProduct(p.id, excludeId)')); assert(!/isKit|sku\.startsWith|KIT-.*filter/.test(source));
});
test('draft preview rejects blank, fractional or overflowing values without plausible totals', () => {
  assert.equal(componentRequirement('10', '3'), 30); for (const [a, b] of [['', '3'], ['1.5', '2'], ['10', '0'], ['2147483647', '2']]) assert.equal(componentRequirement(a, b), undefined);
});
test('bin display uses real warehouse/zone context only', () => {
  assert.equal(binLabel({ id: id(2), code: 'B1', zoneId: id(4), purpose: 0, maxCapacity: 0, currentOccupancy: 0 }, [{ id: id(4), code: 'Z1', name: 'Zone', warehouseId: id(5) }], [{ id: id(5), code: 'W1', name: 'Warehouse' }]), 'B1 · Z1 · W1');
});
test('Staff direct Kitting route renders forbidden without mounting reads or actions', async () => {
  ok(true, 'Staff'); await i18n.changeLanguage('en-US'); const html = renderToStaticMarkup(React.createElement(KittingWorkspace)); assert(html.includes(en.f7.forbidden)); assert(!html.includes(en.f7.confirm));
});
test('VI/EN parity and accepted confirmation include every component, output SKU, bin and quantities', async () => {
  assert.deepEqual(Object.keys(en.f7).sort(), Object.keys(vi.f7).sort());
  const product = { id: id(1), sku: 'KIT-ORDINARY', name: 'Full untruncated output name', barcode: '', unit: 'pcs', weight: 0, trackingMode: 0 };
  const rows = [{ rowId: 1, product: { ...product, id: id(3), sku: 'PART-A' }, binId: id(4), quantity: '3' }];
  for (const lang of ['en-US', 'vi-VN']) { await i18n.changeLanguage(lang); const html = renderToStaticMarkup(React.createElement(AssemblyConfirmation, { batch: { request: body, output: product, rows }, bins: [2, 4].map(n => ({ id: id(n), code: `BIN-${n}`, zoneId: id(9), purpose: 0, maxCapacity: 100, currentOccupancy: 0 })), zones: [], warehouses: [], pending: false, onBack() {}, onConfirm() {} }));
    for (const text of ['Full untruncated output name', 'KIT-ORDINARY', 'PART-A', 'BIN-2', 'BIN-4', i18n.t('f7.warning'), i18n.t('f7.confirm'), i18n.t('f7.back')]) assert(html.includes(text)); assert(html.includes('>6<')); }
});
