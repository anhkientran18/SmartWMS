// Deterministic Axios fixtures and operation/SSR tests. No real stock mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { transferApi, transferRequest, MAX_TRANSFER_QUANTITY } from '../src/services/inventory/transferApi';
import { transferQueries, transferKey } from '../src/services/inventory/transferQueries';
import { createTransferOperation, getTransferOperation } from '../src/services/inventory/transferMutation';
import { changeTransferDraft, draftTransferRequest, emptyTransferDraft, supportedSourceRows, validateTransferDraft, warehouseForBin } from '../src/services/inventory/transferWorkflow';
import { inventoryKey, inventoryQueries } from '../src/services/inventory/inventoryQueries';
import InventoryTransferWorkspace, { TransferOutcome, TransferReadState, TransferRecordFields, transferErrorKey } from '../src/features/inventory/InventoryTransferWorkspace';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const journal = new Map<string, string>();
globalThis.sessionStorage = { getItem: key => journal.get(key) ?? null, setItem: (key, value) => { journal.set(key, value); }, removeItem: key => { journal.delete(key); }, clear: () => journal.clear(), key: index => [...journal.keys()][index] ?? null, get length() { return journal.size; } };
const ids = Array.from({ length: 8 }, (_, index) => `${index + 1}`.repeat(8) + '-' + `${index + 1}`.repeat(4) + '-' + `${index + 1}`.repeat(4) + '-' + `${index + 1}`.repeat(4) + '-' + `${index + 1}`.repeat(12));
const [warehouse, zone, source, destination, product, transaction, otherWarehouse, otherZone] = ids;
const body = { productId: product, sourceBinId: source, destinationBinId: destination, transferQuantity: 2, lotNumber: '', reason: 'Internal transfer' };
const productRow = { id: product, sku: 'REAL', name: 'Persisted product', barcode: '', unit: 'ea', weight: 0, trackingMode: 0 };
const sourceRow = { productId: product, sku: 'REAL', productName: 'Persisted product', lotNumber: '', quantity: 20, expirationDate: 'Không có hạn dùng', status: 'Available' };
const contents = (id = source) => ({ binId: id, binCode: id === source ? 'SRC' : 'DST', purpose: 0, maxCapacity: 50, currentOccupancy: 20, utilizationPercentage: 40, items: [{ ...sourceRow }] });
const record = { id: transaction, productId: product, productName: 'Persisted product', sku: 'REAL', quantityTransferred: 2, sourceBinCode: 'SRC', destinationBinCode: 'DST', reasonCode: 'Internal transfer', transferredAt: '2026-11-08T01:00:00Z', transferredBy: 'WarehouseStaff' };
const page = { items: [], pageIndex: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false, firstItemIndex: 1, lastItemIndex: 0 };
const context = () => ({ fresh: true, warehouses: [{ id: warehouse, code: 'WH', name: 'Warehouse' }], zones: [{ id: zone, code: 'Z', name: 'Zone', warehouseId: warehouse }],
  bins: [source, destination].map((id, index) => ({ id, code: index ? 'DST' : 'SRC', zoneId: zone, purpose: 0, maxCapacity: 50, currentOccupancy: 20 })), products: [{ ...productRow }], contents: contents() });
const draft = () => ({ ...emptyTransferDraft(), warehouseId: warehouse, sourceBinId: source, destinationBinId: destination, productId: product, lotNumber: '', quantity: '2', reason: 'Internal transfer' });
const user = (role: 'Admin' | 'WarehouseManager' | 'Staff' = 'Admin') => ({ role, username: 'fixture', token: `test.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600, fixtureNonce: Math.random() }))}.unsigned` });
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: 0 }, mutations: { retry: 3, retryDelay: 1 } } });
const response = (config, data, status = 200) => ({ config, data, status, statusText: String(status), headers: {} });
const success = data => { httpClient.defaults.adapter = async config => response(config, { isSuccess: true, data }); };
function mockReads(config) {
  if (config.url === `/api/v1/Bins/${source}/contents`) return response(config, { isSuccess: true, data: contents(source) });
  if (config.url === `/api/v1/Bins/${destination}/contents`) return response(config, { isSuccess: true, data: contents(destination) });
  if (config.url === '/api/v1/InventoryTransfers' && config.method === 'get') return response(config, { isSuccess: true, data: page });
  throw new Error('Unexpected fixture GET');
}
const render = (cache: QueryClient) => renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={cache}><InventoryTransferWorkspace /></QueryClientProvider></MemoryRouter>);

test('transfer API uses pageNumber/pageSize/productId/searchKeyword, direct DTO, authenticated Bearer and signal', async () => {
  const session = user(); sessionStore.set(session); const controller = new AbortController(); let calls = 0;
  const filter = { pageNumber: 2, pageSize: 10, productId: product, searchKeyword: 'SRC & nhận' };
  httpClient.defaults.adapter = async config => {
    calls++; assert.equal(config.headers.Authorization, `Bearer ${session.token}`);
    assert.equal(config.url, '/api/v1/InventoryTransfers');
    if (config.method === 'get') {
      assert.deepEqual(config.params, filter); assert.equal(config.signal, controller.signal);
      assert.equal(config.data, undefined);
      return response(config, { isSuccess: true, data: { ...page, pageIndex: 2, totalCount: 11, totalPages: 2, hasPreviousPage: true, firstItemIndex: 11, lastItemIndex: 11, items: [record] } });
    }
    assert.equal(config.method, 'post'); assert.deepEqual(JSON.parse(config.data), body);
    assert.equal(JSON.parse(config.data).requestData, undefined);
    return response(config, { isSuccess: true, data: transaction });
  };
  assert.equal((await transferApi.history(filter, controller.signal)).items[0].transferredBy, 'WarehouseStaff');
  assert.equal(await transferApi.create(body), transaction); assert.equal(calls, 2);
});

test('transfer detail validates GET ID, record identity and actor null', async () => {
  httpClient.defaults.adapter = async config => { assert.equal(config.url, `/api/v1/InventoryTransfers/${transaction}`); return response(config, { isSuccess: true, data: { ...record, transferredBy: null } }); };
  assert.equal((await transferApi.detail(transaction)).transferredBy, null);
  success({ ...record, id: source }); await assert.rejects(transferApi.detail(transaction));
  await assert.rejects(transferApi.detail('bad-id'));
});

test('transfer response rejects malformed/failed Result, GUID and row contracts without fake success', async () => {
  for (const data of [null, {}, { isSuccess: false, data: transaction }, { isSuccess: true, data: '' }, { isSuccess: true, data: source.replaceAll('3', '0') }, { data: transaction }]) {
    httpClient.defaults.adapter = async config => response(config, data); await assert.rejects(transferApi.create(body));
  }
  for (const row of [{ ...record, quantityTransferred: -1 }, { ...record, transferredAt: 'invalid' }, { ...record, sku: undefined }, { ...record, productId: '' }]) {
    success({ ...page, totalCount: 1, totalPages: 1, lastItemIndex: 1, items: [row] }); await assert.rejects(transferApi.history({ pageNumber: 1, pageSize: 10 }));
  }
});

test('transfer pagination rejects inconsistent metadata, totals, items, indexes and request bounds', async () => {
  for (const patch of [{ pageIndex: 2 }, { pageSize: 20 }, { totalPages: 1 }, { totalCount: -1 }, { totalCount: '0' }, { hasNextPage: true }, { hasPreviousPage: true }, { firstItemIndex: 0 }, { lastItemIndex: 1 }, { items: [record] }, { totalCount: 1, totalPages: 1, lastItemIndex: 1 }]) {
    success({ ...page, ...patch }); await assert.rejects(transferApi.history({ pageNumber: 1, pageSize: 10 }));
  }
  for (const filter of [{ pageNumber: 0, pageSize: 10 }, { pageNumber: 1.5, pageSize: 10 }, { pageNumber: 1, pageSize: 101 }, { pageNumber: MAX_TRANSFER_QUANTITY, pageSize: 100 }, { pageNumber: 1, pageSize: 10, productId: 'bad' }]) await assert.rejects(transferApi.history(filter));
  success(page); assert.deepEqual(await transferApi.history({ pageNumber: 1, pageSize: 10 }), page);
});

test('transfer GET cancellation passes through TanStack Query and Axios without mutation', async () => {
  const cache = client(); let start; const ready = new Promise(resolve => { start = resolve; }); let aborted = false;
  httpClient.defaults.adapter = config => new Promise((resolve, reject) => {
    assert.equal(config.method, 'get'); config.signal.addEventListener('abort', () => { aborted = true; reject(new axios.CanceledError()); }); start();
  });
  const options = transferQueries.history({ pageNumber: 1, pageSize: 10 });
  const pending = cache.fetchQuery(options), rejection = assert.rejects(pending);
  await ready; await cache.cancelQueries({ queryKey: options.queryKey }); await rejection;
  assert.equal(aborted, true); cache.clear();
});

test('source-backed None/Lot workflow validates hierarchy, excludes Serial/missing metadata/non-Available/ambiguous lots', () => {
  const c = context(), d = draft(); assert.equal(validateTransferDraft(d, c), undefined); assert.deepEqual(draftTransferRequest(d), body);
  c.products[0].trackingMode = 1; c.contents.items[0].lotNumber = 'LOT-1'; d.lotNumber = 'LOT-1'; assert.equal(validateTransferDraft(d, c), undefined);
  c.products[0].trackingMode = 2; assert.equal(validateTransferDraft(d, c), 'selection'); assert.equal(supportedSourceRows(c).length, 0);
  c.products = []; assert.equal(supportedSourceRows(c).length, 0);
  c.products = [{ ...productRow }]; c.contents.items[0].status = 'Quarantined'; assert.equal(supportedSourceRows(c).length, 0);
  c.contents = contents(); c.contents.items.push({ ...sourceRow, lotNumber: 'LOT-DEFAULT' }); assert.equal(supportedSourceRows(c).length, 0);
});

test('same bin, known cross-warehouse, missing/stale hierarchy or source selection cannot submit', () => {
  assert.equal(validateTransferDraft({ ...draft(), destinationBinId: source.toUpperCase() }, context()), 'sameBin');
  const c = context(); c.warehouses.push({ id: otherWarehouse, code: 'OTHER', name: 'Other' }); c.zones.push({ id: otherZone, code: 'OTHER', name: 'Other', warehouseId: otherWarehouse }); c.bins[1].zoneId = otherZone;
  assert.equal(validateTransferDraft(draft(), c), 'warehouse'); assert.equal(warehouseForBin(destination, c), otherWarehouse);
  c.zones = []; assert.equal(validateTransferDraft(draft(), c), 'warehouse');
  assert.equal(validateTransferDraft(draft(), { ...context(), fresh: false }), 'context');
  assert.equal(validateTransferDraft(draft(), { ...context(), contents: undefined }), 'context');
  assert.equal(validateTransferDraft(draft(), { ...context(), contents: contents(destination) }), 'context');
  assert.equal(validateTransferDraft({ ...draft(), lotNumber: null }, context()), 'selection');
  assert.equal(validateTransferDraft({ ...draft(), productId: 'bad' }, context()), 'selection');
  const duplicate = context(); duplicate.zones.push({ ...duplicate.zones[0] }); assert.equal(warehouseForBin(source, duplicate), undefined);
});

test('zero/negative/noninteger/overflow/unsafe quantities and empty/overlong reason reject before POST', async () => {
  let calls = 0; httpClient.defaults.adapter = async config => { calls++; return response(config, { isSuccess: true, data: transaction }); };
  for (const quantity of ['', '0', '-1', '1.2', '1e2', '2147483648', '9007199254740992', 'NaN']) {
    assert.equal(validateTransferDraft({ ...draft(), quantity }, context()), 'quantity');
  }
  for (const transferQuantity of [0, -1, 1.2, MAX_TRANSFER_QUANTITY + 1, Infinity]) await assert.rejects(transferApi.create({ ...body, transferQuantity }));
  for (const reason of ['', '  ', 'x'.repeat(501)]) {
    assert.equal(validateTransferDraft({ ...draft(), reason }, context()), 'reason'); await assert.rejects(transferApi.create({ ...body, reason }));
  }
  await assert.rejects(transferApi.create({ ...body, productId: 'bad' })); await assert.rejects(transferApi.create({ ...body, destinationBinId: source }));
  assert.equal(calls, 0); assert.equal(transferRequest({ ...body, transferQuantity: MAX_TRANSFER_QUANTITY }).transferQuantity, MAX_TRANSFER_QUANTITY);
  assert.equal(validateTransferDraft({ ...draft(), quantity: String(MAX_TRANSFER_QUANTITY) }, context()), undefined);
});

test('warehouse/source/product/lot changes synchronously invalidate all dependent choices', () => {
  for (const [key, value] of [['warehouseId', otherWarehouse], ['sourceBinId', destination], ['productId', transaction], ['lotNumber', 'NEW']] as const) {
    const next = changeTransferDraft(draft(), key, value); assert.equal(next.destinationBinId, ''); assert.equal(next.quantity, '');
    if (key !== 'lotNumber') assert.equal(next.lotNumber, null);
    if (['warehouseId', 'sourceBinId'].includes(key)) assert.equal(next.productId, '');
    if (key === 'warehouseId') assert.equal(next.sourceBinId, '');
  }
});

test('single-submit latch, pending state, success GUID, query invalidation and no optimistic stock update', async () => {
  sessionStore.set(user()); const cache = client(); cache.setQueryDefaults(inventoryKey, { gcTime: Infinity }); cache.setQueryDefaults(transferKey, { gcTime: Infinity }); const op = getTransferOperation(cache); let resolvePost; let posts = 0;
  cache.setQueryData(inventoryQueries.summary().queryKey, { totalProducts: 1, totalQuantity: 20, lowStockItems: 0 });
  cache.setQueryData(inventoryQueries.contents(source).queryKey, contents()); cache.setQueryData(inventoryQueries.bins().queryKey, context().bins);
  const filter = { pageNumber: 2, pageSize: 10, productId: product }; cache.setQueryData(transferQueries.history(filter).queryKey, page);
  const reads = [];
  httpClient.defaults.adapter = config => {
    if (config.method === 'post') { posts++; return new Promise(resolve => { resolvePost = () => resolve(response(config, { isSuccess: true, data: transaction })); }); }
    reads.push(config.url); return Promise.resolve(mockReads(config));
  };
  const pending = op.submit(body); while (op.getState().phase === 'restoring') await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(op.getState().phase, 'pending'); assert.match(render(cache), /<fieldset disabled=""/);
  await assert.rejects(op.submit(body), error => error.status === 409);
  assert.equal(cache.getQueryData(inventoryQueries.contents(source).queryKey).items[0].quantity, 20);
  while (!resolvePost) await new Promise(resolve => setTimeout(resolve, 0)); resolvePost(); await pending;
  assert.equal(posts, 1); assert.equal(op.getState().phase, 'succeeded'); assert.equal(op.getState().reference, transaction);
  assert.equal(cache.getQueryState(inventoryQueries.summary().queryKey).isInvalidated, true);
  assert.equal(cache.getQueryState(inventoryQueries.bins().queryKey).isInvalidated, true);
  assert.equal(cache.getQueryState(transferQueries.history(filter).queryKey).isInvalidated, true);
  assert.ok(reads.includes(`/api/v1/Bins/${source}/contents`)); assert.ok(reads.includes(`/api/v1/Bins/${destination}/contents`));
  assert.ok(reads.includes('/api/v1/InventoryTransfers'));
  assert.equal(cache.getQueryData(inventoryQueries.summary().queryKey).totalQuantity, 20);
  op.acknowledge(); assert.equal(op.getState().phase, 'ready'); cache.clear();
});

test('confirmed POST remains successful with reference when stock refresh fails', async () => {
  sessionStore.set(user()); const cache = client(); const op = createTransferOperation(cache);
  httpClient.defaults.adapter = async config => { if (config.method === 'post') return response(config, { isSuccess: true, data: transaction }); throw new axios.AxiosError('read offline', 'ERR_NETWORK', config); };
  await op.submit(body); assert.equal(op.getState().phase, 'succeeded'); assert.equal(op.getState().reference, transaction); assert.ok(op.getState().refreshError); cache.clear();
});

test('400/403/409 stay definite rejections, preserve server message and never retry even with global retry=3', async () => {
  for (const status of [400, 403, 409]) {
    sessionStore.set(user()); const cache = client(); const op = createTransferOperation(cache); let posts = 0;
    httpClient.defaults.adapter = async config => { posts++; throw new axios.AxiosError('rejected', undefined, config, undefined, response(config, { message: 'Persisted rejection', errorCode: 'CONFLICT' }, status)); };
    await op.submit(body); assert.equal(op.getState().phase, 'rejected'); assert.equal(op.getState().error.message, 'Persisted rejection'); assert.equal(op.getState().error.status, status); assert.equal(posts, 1);
    assert.equal(transferErrorKey(op.getState().error), `transfer.errors.${status}`); op.acknowledge(); cache.clear();
  }
});

test('401 invalidates only its owning session and does not refresh private reads after logout', async () => {
  sessionStore.set(user()); const cache = client(); const op = createTransferOperation(cache); let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; throw new axios.AxiosError('expired', undefined, config, undefined, response(config, {}, 401)); };
  await op.submit(body); assert.equal(sessionStore.get(), null); assert.equal(calls, 1); assert.equal(transferErrorKey({ status: 401 }), 'transfer.errors.401'); cache.clear();
});

test('network/timeout/500/504/malformed success are uncertain: no retry, locked until explicit successful read reconciliation', async () => {
  for (const kind of ['network', 'timeout', '500', '504', 'malformed']) {
    sessionStore.set(user()); const cache = client(); const op = getTransferOperation(cache); let posts = 0; let reads = 0;
    httpClient.defaults.adapter = async config => {
      if (config.method !== 'post') { reads++; return mockReads(config); }
      posts++;
      if (kind === 'malformed') return response(config, { isSuccess: true, data: 'lost-reference' });
      throw new axios.AxiosError(kind, kind === 'timeout' ? 'ECONNABORTED' : 'ERR_NETWORK', config, undefined,
        ['500', '504'].includes(kind) ? response(config, {}, Number(kind)) : undefined);
    };
    await op.submit(body); assert.equal(op.getState().phase, 'uncertain'); assert.equal(posts, 1); assert.equal(reads, 0);
    assert.equal(getTransferOperation(cache), op); // route remount retains pending/uncertain operation
    await assert.rejects(op.submit(body)); assert.throws(() => op.acknowledge(true));
    await op.reconcile(); assert.equal(posts, 1); assert.equal(op.getState().reconciled, true); assert.ok(reads >= 3);
    assert.throws(() => op.acknowledge(false)); op.acknowledge(true); assert.equal(op.getState().phase, 'ready'); assert.equal(posts, 1); cache.clear();
  }
});

test('failed read reconciliation cannot unlock an uncertain transfer', async () => {
  sessionStore.set(user()); const cache = client(); const op = createTransferOperation(cache);
  httpClient.defaults.adapter = async config => { throw new axios.AxiosError('offline', 'ERR_NETWORK', config); };
  await op.submit(body); await op.reconcile(); assert.equal(op.getState().reconciled, false); assert.ok(op.getState().refreshError); assert.throws(() => op.acknowledge(true)); cache.clear();
});

test('session changes prevent late success feedback/refetch and Staff cannot create an operation', async () => {
  sessionStore.set(user()); const cache = client(); const old = getTransferOperation(cache); let resolvePost; let calls = 0;
  httpClient.defaults.adapter = config => { calls++; return new Promise(resolve => { resolvePost = () => resolve(response(config, { isSuccess: true, data: transaction })); }); };
  const pending = old.submit(body); while (!resolvePost) await new Promise(resolve => setTimeout(resolve, 0));
  sessionStore.set(user('Staff')); resolvePost(); await pending;
  assert.equal(calls, 1); assert.notEqual(getTransferOperation(cache), old); await assert.rejects(getTransferOperation(cache).submit(body)); assert.equal(calls, 1); cache.clear();
});

test('Staff route blocks all management queries; Admin/WM production workspace has loading and no demo data', () => {
  const cache = client(); sessionStore.set(user('Staff')); const forbidden = render(cache);
  assert.match(forbidden, /role="alert"/); assert.equal(cache.getQueryCache().getAll().length, 0); assert.doesNotMatch(forbidden, /<select|<textarea/);
  for (const role of ['Admin', 'WarehouseManager'] as const) {
    sessionStore.set(user(role)); const html = render(cache); assert.match(html, /transfer-create-title/); assert.match(html, /transfer-history-title/); assert.match(html, /role="status"/); assert.match(html, /<fieldset/); assert.match(html, /disabled/); assert.doesNotMatch(html, /DEMO-SKU|MOCK-SKU/);
  }
  cache.clear();
});

test('populated history and empty/error states render in VI/EN; source metadata and actor remain honest', async () => {
  const cache = client(); sessionStore.set(user()); const c = context();
  for (const [key, value] of [[inventoryQueries.warehouses().queryKey, c.warehouses], [inventoryQueries.zones().queryKey, c.zones], [inventoryQueries.bins().queryKey, c.bins], [inventoryQueries.products().queryKey, c.products]]) cache.setQueryData(key, value);
  const key = transferQueries.history({ pageNumber: 1, pageSize: 10, productId: undefined, searchKeyword: undefined }).queryKey;
  for (const [locale, copy] of [['en-US', en], ['vi-VN', vi]] as const) {
    await i18n.changeLanguage(locale); cache.setQueryData(key, { ...page, totalCount: 1, totalPages: 1, lastItemIndex: 1, items: [{ ...record, productName: '<script>unsafe()</script>' }] });
    const html = render(cache); assert.match(html, /SRC/); assert.match(html, /DST/); assert.match(html, /WarehouseStaff/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
    assert.ok(html.includes(copy.transfer.actorNote)); assert.ok(html.includes(copy.transfer.stockNote)); assert.match(html, /aria-current="page"/);
    cache.setQueryData(key, page); assert.ok(render(cache).includes(copy.transfer.empty));
    const detail = renderToStaticMarkup(<TransferRecordFields row={record} />); assert.match(detail, /REAL/); assert.match(detail, /Internal transfer/);
    const uncertain = renderToStaticMarkup(<TransferOutcome state={{ phase: 'uncertain', request: body }} onRefresh={() => {}} onNew={() => {}} />);
    assert.ok(uncertain.includes(copy.transfer.uncertainty)); assert.match(uncertain, /type="checkbox"[^>]*disabled/); assert.match(uncertain, /role="alert"/);
  }
  httpClient.defaults.adapter = async config => { throw new axios.AxiosError('private internal detail', undefined, config, undefined, response(config, {}, 500)); };
  const options = transferQueries.history({ pageNumber: 1, pageSize: 10 }); await assert.rejects(cache.fetchQuery({ ...options, staleTime: 0 }));
  const observer = new QueryObserver(cache, options);
  const errorHtml = renderToStaticMarkup(<TransferReadState query={observer.getCurrentResult()}><span>STALE_TRANSFER</span></TransferReadState>);
  assert.match(errorHtml, /role="alert"/); assert.doesNotMatch(errorHtml, /STALE_TRANSFER|private internal detail/); cache.clear();
});

test('transfer query keys isolate filters and locales/error states have complete key parity', () => {
  assert.notDeepEqual(transferQueries.history({ pageNumber: 1, pageSize: 10 }).queryKey, transferQueries.history({ pageNumber: 2, pageSize: 10 }).queryKey);
  assert.notDeepEqual(transferQueries.history({ pageNumber: 1, pageSize: 10, productId: product }).queryKey, transferQueries.history({ pageNumber: 1, pageSize: 10, searchKeyword: 'SRC' }).queryKey);
  const keys = value => Object.entries(value).flatMap(([key, child]) => child && typeof child === 'object' ? keys(child).map(sub => `${key}.${sub}`) : [key]);
  assert.deepEqual(keys(en.transfer).sort(), keys(vi.transfer).sort());
  for (const status of [400, 401, 403, 409, 500, undefined]) assert.equal(typeof transferErrorKey({ status }).split('.').reduce((value, key) => value?.[key], en), 'string');
});

test('production route/link and sprint wiring retain existing routes, demo boundary and backend contracts', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8'), stock = readFileSync('src/features/inventory/RealStockVisibility.tsx', 'utf8');
  const apiTree = app.split('{!isDemoMode ? <Routes>')[1].split('</Routes> : <Routes>')[0];
  for (const route of ['/dashboard/inventory', '/dashboard/inventory/transfers', '/dashboard/replenishment', '/dashboard/orders', '/dashboard/cycle-counting/*', '/dashboard/products', '/dashboard/orders/inbound/create', '/dashboard/orders/outbound/create']) assert.ok(apiTree.includes(`path="${route}"`), route);
  assert.equal(app.match(/path="\/dashboard\/inventory\/transfers"/g).length, 1); assert.match(stock, /management && <Link[^>]*to="\/dashboard\/inventory\/transfers"/);
  assert.match(readFileSync('tests/run-sprint.mjs', 'utf8'), /'inventory'/); assert.match(readFileSync('tests/inventory.test.tsx', 'utf8'), /import '\.\/transfers.test'/);
  const controller = readFileSync('../SmartWMS.Api/Controllers/InventoryTransfersController.cs', 'utf8'); assert.match(controller, /Admin,WarehouseManager,Staff/); assert.match(controller, /\[FromBody\] CreateInventoryTransferRequest request/);
  const workspace = readFileSync('src/features/inventory/InventoryTransferWorkspace.tsx', 'utf8'); assert.match(workspace, /review\.revision === revision/); assert.match(workspace, /<dialog/);
});

test('logout during success invalidation never starts subsequent inactive private reconciliation reads', async () => {
  sessionStore.set(user()); const cache = client(); const op = createTransferOperation(cache);
  const invalidate = cache.invalidateQueries.bind(cache); let invalidations = 0; let gets = 0;
  cache.invalidateQueries = async (...args) => { invalidations++; sessionStore.set(null, 'logout'); return invalidate(...args); };
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') return response(config, { isSuccess: true, data: transaction });
    gets++; return mockReads(config);
  };
  await op.submit(body); assert.ok(invalidations > 0); assert.equal(gets, 0); cache.clear();
});

test('duplicate/conflicting product metadata blocks selecting ambiguous stock', () => {
  const c = context(); c.products.push({ ...productRow, trackingMode: 2 });
  assert.equal(supportedSourceRows(c).length, 0); assert.equal(validateTransferDraft(draft(), c), 'selection');
});

test('reload restores an unresolved transfer and requires reconciliation; journal contains no credentials', async () => {
  journal.clear(); const session = user(); sessionStore.set(session); const cache = client(); let posts = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method !== 'post') return mockReads(config);
    posts++; throw new axios.AxiosError('lost response', 'ERR_NETWORK', config);
  };
  const first = createTransferOperation(cache); await first.submit(body); assert.equal(first.getState().phase, 'uncertain');
  assert.equal(journal.size, 1); const serialized = [...journal.entries()].flat().join(''); assert.ok(!serialized.includes(session.token)); assert.ok(!serialized.includes(session.username));
  const restored = createTransferOperation(cache);
  while (restored.getState().phase === 'restoring') await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(restored.getState().phase, 'uncertain'); assert.deepEqual(restored.getState().request, body);
  await assert.rejects(restored.submit(body)); assert.equal(posts, 1); assert.throws(() => restored.acknowledge(true));
  await restored.reconcile(); restored.acknowledge(true); assert.equal(restored.getState().phase, 'ready'); assert.equal(journal.size, 0); assert.equal(posts, 1); cache.clear();
});

test('unavailable safety storage fails closed before POST', async () => {
  sessionStore.set(user()); const cache = client(); const original = sessionStorage.setItem; let posts = 0;
  sessionStorage.setItem = () => { throw new Error('Storage disabled'); };
  httpClient.defaults.adapter = async config => { posts++; return response(config, { isSuccess: true, data: transaction }); };
  try {
    const op = createTransferOperation(cache); await op.submit(body);
    assert.equal(op.getState().phase, 'rejected'); assert.equal(op.getState().error.code, 'FE_TRANSFER_STORAGE'); assert.equal(posts, 0);
    assert.throws(() => op.acknowledge(true));
  } finally { sessionStorage.setItem = original; cache.clear(); }
});

test('corrupt unresolved journal cannot silently unlock a repeated attempt', async () => {
  journal.clear(); sessionStore.set(user()); const cache = client(); let posts = 0;
  httpClient.defaults.adapter = async config => { posts++; throw new axios.AxiosError('lost response', 'ERR_NETWORK', config); };
  const first = createTransferOperation(cache); await first.submit(body);
  const key = [...journal.keys()][0]; assert.ok(key); journal.set(key, '{corrupt');
  const restored = createTransferOperation(cache);
  while (restored.getState().phase === 'restoring') await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(restored.getState().error.code, 'FE_TRANSFER_STORAGE');
  assert.throws(() => restored.acknowledge(true)); await assert.rejects(restored.submit(body)); assert.equal(posts, 1);
  journal.clear(); cache.clear();
});
