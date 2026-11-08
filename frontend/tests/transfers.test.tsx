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
import InventoryTransferWorkspace, { TransferOutcome, TransferReadState, TransferRecordFields, transferErrorKey, createTransferEventHandlers } from '../src/features/inventory/InventoryTransferWorkspace';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const journal = new Map<string, string>();
let fixtureNonce = 0;
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
const user = (role: 'Admin' | 'WarehouseManager' | 'Staff' = 'Admin') => ({ role, username: 'fixture', token: `test.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600, fixtureNonce: ++fixtureNonce }))}.unsigned` });
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


const settledOperation = async (cache: QueryClient) => {
  const operation = createTransferOperation(cache);
  while (operation.getState().phase === 'restoring') await new Promise(resolve => setTimeout(resolve, 0));
  return operation;
};
async function uncertainOperation() {
  journal.clear(); sessionStore.set(user()); const cache = client();
  cache.setQueryDefaults(inventoryKey, { gcTime: Infinity }); cache.setQueryDefaults(transferKey, { gcTime: Infinity });
  httpClient.defaults.adapter = async config => { throw new axios.AxiosError('lost response', 'ERR_NETWORK', config); };
  const operation = createTransferOperation(cache); await operation.submit(body);
  assert.equal(operation.getState().phase, 'uncertain');
  return { cache, operation };
}

test('F01 confirmed journal keeps GUID across reload, locks the form and only clears on explicit acknowledgement', async () => {
  journal.clear(); const session = user(); sessionStore.set(session); const cache = client(); let posts = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method !== 'post') return mockReads(config);
    posts++; assert.deepEqual(JSON.parse([...journal.values()][0]), { version: 1, status: 'pending', request: body });
    return response(config, { isSuccess: true, data: transaction });
  };
  await getTransferOperation(cache).submit(body);
  assert.deepEqual(JSON.parse([...journal.values()][0]), { version: 1, status: 'succeeded', request: body, reference: transaction });
  const serialized = [...journal.entries()].flat().join('');
  for (const secret of [session.token, session.username, 'password', 'username', 'token']) assert.ok(!serialized.includes(secret));
  // A new QueryClient + operation models reload rather than the module's remount latch.
  const reloadedCache = client(); const restored = getTransferOperation(reloadedCache);
  while (restored.getState().phase === 'restoring') await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(restored.getState().phase, 'succeeded'); assert.equal(restored.getState().reference, transaction);
  const html = render(reloadedCache); assert.match(html, new RegExp(transaction)); assert.match(html, /<fieldset disabled=""/);
  await assert.rejects(restored.submit(body)); assert.equal(posts, 1); assert.equal(journal.size, 1);
  assert.equal(restored.acknowledge(), true); assert.equal(restored.getState().phase, 'ready'); assert.equal(journal.size, 0);
  cache.clear(); reloadedCache.clear();
});

test('F01 confirmed GUID and success journal survive failed post-commit reads', async () => {
  journal.clear(); sessionStore.set(user()); const cache = client();
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') return response(config, { isSuccess: true, data: transaction });
    throw new axios.AxiosError('read failed', 'ERR_NETWORK', config);
  };
  const operation = createTransferOperation(cache); await operation.submit(body);
  assert.equal(operation.getState().phase, 'succeeded'); assert.equal(operation.getState().reference, transaction); assert.ok(operation.getState().refreshError);
  const restored = await settledOperation(cache); assert.equal(restored.getState().phase, 'succeeded'); assert.equal(restored.getState().reference, transaction);
  assert.equal(JSON.parse([...journal.values()][0]).reference, transaction); cache.clear();
});

test('F01 post-commit storage failure keeps confirmed result, shows storage warning and blocks repeat until storage recovers', async () => {
  journal.clear(); sessionStore.set(user()); const cache = client(); const original = sessionStorage.setItem; let posts = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method !== 'post') return mockReads(config);
    posts++; sessionStorage.setItem = () => { throw new Error('Private storage detail'); };
    return response(config, { isSuccess: true, data: transaction });
  };
  try {
    const operation = createTransferOperation(cache); await operation.submit(body);
    assert.equal(operation.getState().phase, 'succeeded'); assert.equal(operation.getState().reference, transaction); assert.equal(operation.getState().storageWarning, true);
    await assert.rejects(operation.submit(body)); assert.equal(operation.acknowledge(), false); assert.equal(posts, 1); assert.equal(journal.size, 1);
    for (const [locale, copy] of [['en-US', en], ['vi-VN', vi]] as const) {
      await i18n.changeLanguage(locale);
      const html = renderToStaticMarkup(<TransferOutcome state={operation.getState()} onRefresh={() => {}} onNew={() => {}} />);
      assert.ok(html.includes(copy.transfer.outcome.succeeded)); assert.ok(html.includes(copy.transfer.storageWarning)); assert.match(html, new RegExp(transaction)); assert.doesNotMatch(html, /Private storage detail/);
    }
    sessionStorage.setItem = original; assert.equal(operation.acknowledge(), true); assert.equal(journal.size, 0); assert.equal(operation.getState().phase, 'ready');
  } finally { sessionStorage.setItem = original; cache.clear(); }
});

test('F01 legacy, versioned pending and versioned uncertain journals all restore uncertain without replay', async () => {
  const { cache } = await uncertainOperation(); const key = [...journal.keys()][0]; let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; return mockReads(config); };
  for (const saved of [{ request: body }, { version: 1, status: 'pending', request: body }, { version: 1, status: 'uncertain', request: body }]) {
    journal.set(key, JSON.stringify(saved)); const restored = await settledOperation(cache);
    assert.equal(restored.getState().phase, 'uncertain'); assert.deepEqual(restored.getState().request, body);
    await assert.rejects(restored.submit(body)); assert.throws(() => restored.acknowledge(true));
  }
  assert.equal(calls, 0); cache.clear();
});

test('F01 corrupt or unsupported success journals fail closed without deleting evidence', async () => {
  const { cache } = await uncertainOperation(); const key = [...journal.keys()][0]; let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; return mockReads(config); };
  for (const raw of ['', '{invalid', JSON.stringify({ version: 1, status: 'succeeded', request: body }),
    JSON.stringify({ version: 1, status: 'succeeded', request: body, reference: 'invalid' }),
    JSON.stringify({ version: 2, status: 'succeeded', request: body, reference: transaction }),
    JSON.stringify({ version: 1, status: 'unknown', request: body }),
    JSON.stringify({ version: 1, status: 'succeeded', request: { ...body, transferQuantity: 0 }, reference: transaction }),
    JSON.stringify({ status: 'succeeded', request: body, reference: transaction })]) {
    journal.set(key, raw); const restored = await settledOperation(cache);
    assert.equal(restored.getState().error.code, 'FE_TRANSFER_STORAGE'); await assert.rejects(restored.submit(body)); assert.throws(() => restored.acknowledge(true)); assert.equal(journal.get(key), raw);
  }
  assert.equal(calls, 0); journal.clear(); cache.clear();
});

test('F02 mandatory GETs reconcile despite unrelated active summary failure; unrelated cache stays stale', async () => {
  const { cache, operation } = await uncertainOperation(); let summaryCalls = 0; const mandatory = [];
  const summaryOptions = inventoryQueries.summary(); cache.setQueryData(summaryOptions.queryKey, { totalProducts: 1, totalQuantity: 20, lowStockItems: 0 });
  const summaryObserver = new QueryObserver(cache, summaryOptions); const unsubscribe = summaryObserver.subscribe(() => {});
  httpClient.defaults.adapter = async config => {
    assert.equal(config.method, 'get');
    if (config.url === '/api/v1/Inventory/stock-summary') { summaryCalls++; throw new axios.AxiosError('Unrelated failure', 'ERR_NETWORK', config); }
    mandatory.push(config.url); if (config.url === '/api/v1/InventoryTransfers') assert.deepEqual(config.params, { pageNumber: 1, pageSize: 10 });
    return mockReads(config);
  };
  try {
    await operation.reconcile(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(operation.getState().phase, 'uncertain'); assert.equal(operation.getState().reconciled, true); assert.equal(operation.getState().refreshError, undefined);
    assert.equal(summaryCalls, 1); assert.equal(cache.getQueryState(summaryOptions.queryKey).isInvalidated, true);
    assert.deepEqual(mandatory, [`/api/v1/Bins/${source}/contents`, `/api/v1/Bins/${destination}/contents`, '/api/v1/InventoryTransfers']);
    assert.throws(() => operation.acknowledge(false));
  } finally { unsubscribe(); cache.clear(); }
});

for (const [label, route, queryKey, old] of [
  ['source', `/api/v1/Bins/${source}/contents`, inventoryQueries.contents(source).queryKey, contents()],
  ['destination', `/api/v1/Bins/${destination}/contents`, inventoryQueries.contents(destination).queryKey, contents(destination)],
  ['history', '/api/v1/InventoryTransfers', transferQueries.history({ pageNumber: 1, pageSize: 10 }).queryKey, page],
] as const) test(`F02 fresh ${label} failure blocks reconciliation despite cached successful data`, async () => {
  const { cache, operation } = await uncertainOperation(); cache.setQueryData(queryKey, old); let freshCalls = 0; let posts = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') posts++;
    assert.equal(config.method, 'get');
    if (config.url === route) { freshCalls++; throw new axios.AxiosError('Required read failed', 'ERR_NETWORK', config); }
    return mockReads(config);
  };
  await operation.reconcile(); assert.equal(freshCalls, 1); assert.equal(operation.getState().reconciled, false); assert.ok(operation.getState().refreshError);
  assert.equal(operation.getState().phase, 'uncertain'); assert.throws(() => operation.acknowledge(true)); assert.equal(posts, 0); cache.clear();
});

test('F02 wrong bin identity or malformed history cannot satisfy reconciliation', async () => {
  for (const malformed of ['source', 'destination', 'history']) {
    const { cache, operation } = await uncertainOperation();
    httpClient.defaults.adapter = async config => {
      if (malformed === 'source' && config.url === `/api/v1/Bins/${source}/contents`) return response(config, { isSuccess: true, data: contents(destination) });
      if (malformed === 'destination' && config.url === `/api/v1/Bins/${destination}/contents`) return response(config, { isSuccess: true, data: contents(source) });
      if (malformed === 'history' && config.url === '/api/v1/InventoryTransfers') return response(config, { isSuccess: true, data: { ...page, totalPages: 99 } });
      return mockReads(config);
    };
    await operation.reconcile(); assert.equal(operation.getState().reconciled, false); assert.ok(operation.getState().refreshError); cache.clear();
  }
});

test('F02 confirmed GUID survives unrelated background failure while mandatory reads remain visible', async () => {
  journal.clear(); sessionStore.set(user()); const cache = client(); cache.setQueryDefaults(inventoryKey, { gcTime: Infinity }); cache.setQueryDefaults(transferKey, { gcTime: Infinity });
  cache.setQueryData(inventoryQueries.summary().queryKey, { totalProducts: 1, totalQuantity: 20, lowStockItems: 0 });
  const observer = new QueryObserver(cache, inventoryQueries.summary()); const unsubscribe = observer.subscribe(() => {}); let posts = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') { posts++; return response(config, { isSuccess: true, data: transaction }); }
    if (config.url === '/api/v1/Inventory/stock-summary') throw new axios.AxiosError('Background read failed', 'ERR_NETWORK', config);
    return mockReads(config);
  };
  try {
    const operation = createTransferOperation(cache); await operation.submit(body); await new Promise(resolve => setImmediate(resolve));
    assert.equal(posts, 1); assert.equal(operation.getState().phase, 'succeeded'); assert.equal(operation.getState().reference, transaction); assert.equal(operation.getState().refreshError, undefined);
    assert.deepEqual(cache.getQueryData(inventoryQueries.contents(source).queryKey), contents()); assert.deepEqual(cache.getQueryData(inventoryQueries.contents(destination).queryKey), contents(destination));
    assert.equal(JSON.parse([...journal.values()][0]).reference, transaction);
  } finally { unsubscribe(); cache.clear(); }
});

test('F02 logout during a required GET aborts it and prevents remaining reads and late cache/state success', async () => {
  const { cache, operation } = await uncertainOperation(); let started; const ready = new Promise(resolve => { started = resolve; }); let release; const calls = []; let signal;
  httpClient.defaults.adapter = config => {
    calls.push(config.url); signal = config.signal;
    return new Promise(resolve => { release = () => resolve(mockReads(config)); started(); });
  };
  const pending = operation.reconcile(); await ready; sessionStore.set(user('WarehouseManager')); assert.equal(signal.aborted, true);
  release(); await pending;
  assert.deepEqual(calls, [`/api/v1/Bins/${source}/contents`]); assert.notEqual(operation.getState().reconciled, true);
  assert.equal(cache.getQueryData(inventoryQueries.contents(source).queryKey), undefined);
  const next = await settledOperation(cache); assert.equal(next.getState().phase, 'ready'); assert.equal(next.getState().request, undefined); cache.clear();
});

test('F02 an older in-flight source read is canceled rather than reused as fresh evidence', async () => {
  const { cache, operation } = await uncertainOperation(); let started; const ready = new Promise(resolve => { started = resolve; }); let sourceReads = 0; let canceled = false;
  httpClient.defaults.adapter = config => {
    if (config.url === `/api/v1/Bins/${source}/contents` && ++sourceReads === 1) return new Promise((resolve, reject) => {
      config.signal.addEventListener('abort', () => { canceled = true; reject(new axios.CanceledError()); }); started();
    });
    return Promise.resolve(mockReads(config));
  };
  const old = cache.fetchQuery(inventoryQueries.contents(source)); const rejection = assert.rejects(old); await ready;
  await operation.reconcile(); await rejection;
  assert.equal(canceled, true); assert.equal(sourceReads, 2); assert.equal(operation.getState().reconciled, true); cache.clear();
});

test('F03 submit event handles session-change rejection without stale feedback, replay or unhandled rejection', async () => {
  journal.clear(); sessionStore.set(user()); const cache = client(); const operation = await settledOperation(cache); const errors = []; let resets = 0; let posts = 0; const unhandled = [];
  httpClient.defaults.adapter = async config => { posts++; return response(config, { isSuccess: true, data: transaction }); };
  const events = createTransferEventHandlers(operation, key => errors.push(key), () => { resets++; });
  const listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
  try {
    sessionStore.set(user('WarehouseManager')); await assert.doesNotReject(events.submit(body)); await new Promise(resolve => setImmediate(resolve));
    assert.equal(posts, 0); assert.equal(resets, 0); assert.deepEqual(errors, []); assert.deepEqual(unhandled, []);
  } finally { process.removeListener('unhandledRejection', listener); cache.clear(); }
});

test('F03 reconcile event rejection keeps the uncertain form locked and reports only safe localized feedback', async () => {
  const { cache, operation } = await uncertainOperation(); let resets = 0; const errors = []; let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; return mockReads(config); };
  const events = createTransferEventHandlers({ submit: operation.submit, reconcile: async () => { throw { status: 403, message: 'INTERNAL_SQL_SECRET' }; }, acknowledge: operation.acknowledge }, key => errors.push(key), () => { resets++; });
  await assert.doesNotReject(events.reconcile()); assert.equal(operation.getState().phase, 'uncertain'); assert.notEqual(operation.getState().reconciled, true);
  assert.equal(resets, 0); assert.equal(calls, 0); assert.deepEqual(errors, [undefined, 'transfer.errors.403']);
  for (const copy of [en, vi]) { const feedback = errors.at(-1).split('.').reduce((value, key) => value[key], copy); assert.equal(typeof feedback, 'string'); assert.doesNotMatch(feedback, /INTERNAL_SQL_SECRET/); }
  cache.clear();
});

test('F03 failed acknowledgement leaves draft, review, confirmed GUID and journal intact until explicit success', async () => {
  journal.clear(); sessionStore.set(user()); const cache = client(); const original = sessionStorage.removeItem; let posts = 0;
  httpClient.defaults.adapter = async config => { if (config.method === 'post') { posts++; return response(config, { isSuccess: true, data: transaction }); } return mockReads(config); };
  const operation = createTransferOperation(cache); await operation.submit(body); const originalDraft = draft(); const originalReview = { request: body };
  let currentDraft = originalDraft, currentReview = originalReview; const errors = [];
  const events = createTransferEventHandlers(operation, key => errors.push(key), () => { currentDraft = emptyTransferDraft(); currentReview = undefined; });
  try {
    sessionStorage.removeItem = () => { throw new Error('PRIVATE_STORAGE_DETAIL'); };
    assert.doesNotThrow(() => events.acknowledge(false)); assert.equal(currentDraft, originalDraft); assert.equal(currentReview, originalReview);
    assert.equal(operation.getState().phase, 'succeeded'); assert.equal(operation.getState().reference, transaction); assert.equal(operation.getState().storageWarning, true); assert.equal(journal.size, 1);
    await events.submit(body); assert.equal(posts, 1); assert.equal(errors.at(-1), 'transfer.errors.review'); assert.equal(operation.getState().reference, transaction);
    sessionStorage.removeItem = original; events.acknowledge(false); assert.deepEqual(currentDraft, emptyTransferDraft()); assert.equal(currentReview, undefined); assert.equal(operation.getState().phase, 'ready'); assert.equal(journal.size, 0);
  } finally { sessionStorage.removeItem = original; cache.clear(); }
});

test('F03 acknowledgement throwing synchronously is caught without resetting the draft', () => {
  sessionStore.set(user()); const errors = []; let resets = 0;
  const events = createTransferEventHandlers({ submit: async () => {}, reconcile: async () => {}, acknowledge: () => { throw { status: 409, code: 'FE_TRANSFER_REVIEW_REQUIRED', message: 'RAW_PRIVATE_DETAIL' }; } }, key => errors.push(key), () => { resets++; });
  assert.doesNotThrow(() => events.acknowledge(true)); assert.equal(resets, 0); assert.deepEqual(errors, [undefined, 'transfer.errors.review']); assert.ok(!JSON.stringify(errors).includes('RAW_PRIVATE_DETAIL'));
  const workspace = readFileSync('src/features/inventory/InventoryTransferWorkspace.tsx', 'utf8');
  assert.match(workspace, /void events\.submit\(request\)/); assert.match(workspace, /void events\.reconcile\(\)/); assert.match(workspace, /onNew=\{events\.acknowledge\}/);
  assert.doesNotMatch(workspace, /void operation\.(?:submit|reconcile)\(/);
});
