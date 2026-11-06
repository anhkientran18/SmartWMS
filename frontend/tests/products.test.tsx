import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { inventoryReadApi, canReadProducts, isProductQr } from '../src/services/inventory/inventoryReadApi';
import { inventoryQueries } from '../src/services/inventory/inventoryQueries';
import { createBarcodeLookup } from '../src/services/inventory/productLookup';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import ProductWorkspace, { productErrorKey, ProductFields, ResolutionDetails, productPageMetrics, ProductMetrics, ProductCatalogTable, ProductLabelPreview } from '../src/features/products/ProductWorkspace';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

globalThis.window = new EventTarget() as any;
globalThis.document = { documentElement: { lang: '' } } as any;
const id = 'abcdef00-0000-0000-0000-000000000001';
const other = 'abcdef00-0000-0000-0000-000000000002';
const product = { id, sku: 'SKU-A', name: 'Real product', barcode: '123', unit: 'Pcs', weight: 2.5, trackingMode: 2, description: 'Real description' };
const result = { productId: id, sku: 'SKU-A', productName: 'Real product', lotNumber: 'LOT-A', expirationDate: '2027-03-04T00:00:00Z', stockStatus: 'Available' };
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=';
const response = (config: any, data: any, status = 200) => ({ config, data, status, headers: {}, statusText: String(status) });
function user(role = 'Admin') { return { token: `fixture.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.unsigned`, username: 'fixture', role: role as any }; }
function ok(data: unknown = product, role = 'Admin') { sessionStore.set(user(role)); httpClient.defaults.adapter = async c => response(c, { isSuccess: true, data }); }
const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });

test('all three real roles can browse; missing/unknown roles denied', () => {
  for (const role of ['Admin', 'WarehouseManager', 'Staff']) assert.equal(canReadProducts(role), true);
  for (const role of [undefined, 'Other', '']) assert.equal(canReadProducts(role), false);
});
test('catalog keeps F7 fixed20 page route, filter semantics, and shared key', async () => {
  ok(); let calls = 0;
  httpClient.defaults.adapter = async c => { calls++; assert.equal(c.method, 'get'); assert.equal(c.url, '/api/v1/Products'); assert.deepEqual(c.params, { pageNumber: 2, pageSize: 20, searchKeyword: 'A' }); return response(c, { isSuccess: true, data: { items: [product], pageIndex: 2, pageSize: 20, totalCount: 21, totalPages: 2, hasPreviousPage: true, hasNextPage: false } }); };
  assert.equal((await inventoryReadApi.productsPage(2, ' A ')).items[0].description, product.description);
  assert.equal(calls, 1);
  assert.deepEqual(inventoryQueries.productsPage(2, ' A ').queryKey, ['private', 'inventory', 'products', 'page', { pageNumber: 2, searchKeyword: 'A' }]);
});
test('detail uses canonical route, checks identity and requires description', async () => {
  ok(); const signal = new AbortController().signal;
  httpClient.defaults.adapter = async c => { assert.equal(c.url, `/api/v1/Products/${id.toUpperCase()}`); assert.equal(c.signal, signal); return response(c, { isSuccess: true, data: product }); };
  assert.deepEqual(await inventoryReadApi.product(id.toUpperCase(), signal), product);
  for (const bad of [{ ...product, id: other }, { ...product, description: undefined }, { ...product, trackingMode: 9 }, { ...product, weight: -1 }]) {
    ok(bad); await assert.rejects(inventoryReadApi.product(id), (e: any) => e.status === 502);
  }
});
test('invalid detail identifiers and invalid QR SKU make zero requests', async () => {
  ok(); let calls = 0; httpClient.defaults.adapter = async c => { calls++; return response(c, {}); };
  for (const bad of ['', 'bad', '00000000-0000-0000-0000-000000000000']) await assert.rejects(inventoryReadApi.product(bad));
  for (const bad of ['', ' ', 'x'.repeat(51)]) await assert.rejects(inventoryReadApi.productQr(bad));
  assert.equal(calls, 0);
});
test('QR uses encoded SKU and only accepts bounded PNG data URIs', async () => {
  ok(png); httpClient.defaults.adapter = async c => { assert.equal(c.url, '/api/v1/Products/SKU%2FA%20%23/qrcode'); return response(c, { isSuccess: true, data: png }); };
  assert.equal(await inventoryReadApi.productQr('SKU/A #'), png);
  for (const bad of ['javascript:alert(1)', 'https://example.com/x.png', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,AAAA', '', png + '" onerror="x', 'x'.repeat(2_000_001)]) {
    assert.equal(isProductQr(bad), false); ok(bad); await assert.rejects(inventoryReadApi.productQr('SKU'), (e: any) => e.status === 502);
  }
});
test('detail/QR keys remain under existing private products family; QR stays case-sensitive', () => {
  assert.deepEqual(inventoryQueries.product(id.toUpperCase()).queryKey, ['private', 'inventory', 'products', 'detail', id]);
  assert.deepEqual(inventoryQueries.productQr('aB').queryKey, ['private', 'inventory', 'products', 'qr', 'aB']);
  assert.equal(inventoryQueries.product(id).retry, false);
});
test('all supported label formats are forwarded once without frontend interpretation', async () => {
  for (const rawBarcodeData of ['123', 'SKU:A', 'BARCODE:123', 'SKU:A|BARCODE:123', 'A|LOT-A|2027-03-04']) {
    ok(result); let calls = 0; httpClient.defaults.adapter = async c => { calls++; assert.equal(c.url, '/api/v1/Products/parse-barcode'); assert.equal(c.method, 'post'); assert.deepEqual(JSON.parse(c.data), { rawBarcodeData }); return response(c, { isSuccess: true, data: result }); };
    assert.deepEqual(await inventoryReadApi.resolveBarcode(rawBarcodeData), result); assert.equal(calls, 1);
  }
});
test('blank/overlong input rejected locally; malformed format remains backend-owned', async () => {
  ok(result); let calls = 0; httpClient.defaults.adapter = async c => { calls++; return response(c, { isSuccess: true, data: result }); };
  for (const raw of ['', ' ', 'a'.repeat(164)]) await assert.rejects(inventoryReadApi.resolveBarcode(raw), (e: any) => e.status === 400);
  assert.equal(calls, 0); await inventoryReadApi.resolveBarcode('SKU:broken|date'); assert.equal(calls, 1);
});
test('parser rejects malformed envelopes, identities, dates and metadata', async () => {
  for (const bad of [null, {}, { ...result, productId: 'bad' }, { ...result, expirationDate: 'bad' }, { ...result, lotNumber: 1 }, { ...result, stockStatus: undefined }]) {
    ok(bad); await assert.rejects(inventoryReadApi.resolveBarcode('A'), (e: any) => e.status === 502);
  }
  ok({ ...result, expirationDate: null, lotNumber: '' }); assert.equal((await inventoryReadApi.resolveBarcode('A')).expirationDate, null);
});
test('Result/ProblemDetails 400 403 404 500 and network errors preserved; no fallback or retry', async () => {
  for (const status of [400, 403, 404, 500, undefined]) for (const family of ['result', 'problem']) {
    ok(); let calls = 0;
    httpClient.defaults.adapter = async c => { calls++; throw new axios.AxiosError('fixture', undefined, c, undefined, status ? response(c, family === 'result' ? { isSuccess: false, errorCode: 'BUSINESS', message: 'unsafe message' } : { status, code: 'VALIDATION', title: 'Invalid', errors: { RawBarcodeData: ['invalid'] } }, status) : undefined); };
    const op = createBarcodeLookup(); await op.submit('A'); assert.equal(op.getState().error?.status, status); assert.equal(op.getState().result, undefined); assert.equal(calls, 1); op.dispose();
  }
});
test('401 follows shared session invalidation and never publishes old-owner result', async () => {
  ok(); httpClient.defaults.adapter = async c => { throw new axios.AxiosError('fixture', undefined, c, undefined, response(c, {}, 401)); };
  const op = createBarcodeLookup(); await op.submit('A'); assert.equal(sessionStore.get(), null); assert.equal(op.getState().result, undefined); op.dispose();
});
test('duplicate concurrent submits latch synchronously and clear previous result', async () => {
  ok(result); const op = createBarcodeLookup(); await op.submit('A'); assert.ok(op.getState().result);
  let finish: () => void; let calls = 0; httpClient.defaults.adapter = c => new Promise(resolve => { calls++; finish = () => resolve(response(c, { isSuccess: true, data: result })); });
  const first = op.submit('A'); const second = op.submit('B'); assert.equal(op.getState().pending, true); assert.equal(op.getState().result, undefined);
  await second; await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1); finish!(); await first; assert.ok(op.getState().result); op.dispose();
});
test('failed parse clears previous success; editing clears errors and results', async () => {
  ok(result); const op = createBarcodeLookup(); await op.submit('A');
  httpClient.defaults.adapter = async c => { throw new axios.AxiosError('fixture', undefined, c, undefined, response(c, {}, 404)); };
  await op.submit('missing'); assert.equal(op.getState().result, undefined); assert.equal(op.getState().error?.status, 404); op.reset(); assert.deepEqual(op.getState(), { pending: false }); op.dispose();
});
test('late completion after session switch is ignored; disposal aborts signal', async () => {
  ok(); let finish: () => void; let signal: any;
  httpClient.defaults.adapter = c => new Promise(resolve => { signal = c.signal; finish = () => resolve(response(c, { isSuccess: true, data: result })); });
  const op = createBarcodeLookup(); const pending = op.submit('A'); await new Promise(resolve => setImmediate(resolve)); sessionStore.set(user('Staff')); finish!(); await pending; assert.equal(op.getState().result, undefined); op.dispose(); assert.equal(signal.aborted, true);
});
test('unmount cancels an outstanding lookup without success or error publication', async () => {
  ok(); let finish: () => void;
  httpClient.defaults.adapter = c => new Promise(resolve => { finish = () => resolve(response(c, { isSuccess: true, data: result })); });
  const op = createBarcodeLookup(); const pending = op.submit('A'); await new Promise(resolve => setImmediate(resolve)); op.dispose(); finish!(); await pending; assert.equal(op.getState().result, undefined); assert.equal(op.getState().error, undefined);
});
test('shared page cache deduplicates consumers; failed refresh cannot become success', async () => {
  ok(); let calls = 0; httpClient.defaults.adapter = async c => { calls++; return response(c, { isSuccess: true, data: { items: [product], pageIndex: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false } }); };
  const c = client(); const observer = new QueryObserver(c, inventoryQueries.productsPage(1, '')); const stop = observer.subscribe(() => {});
  await c.fetchQuery(inventoryQueries.productsPage(1, '')); assert.equal(calls, 1); assert.equal(c.getQueryCache().getAll().length, 1);
  httpClient.defaults.adapter = async config => { throw new axios.AxiosError('fixture', undefined, config, undefined, response(config, {}, 500)); };
  await assert.rejects(c.fetchQuery({ ...inventoryQueries.productsPage(1, ''), staleTime: 0 })); assert.equal(observer.getCurrentResult().isError, true); stop(); c.clear();
});
test('VI/EN keys match and real fields render without stock availability inference', async () => {
  const leaves = (v: any, prefix = ''): string[] => Object.entries(v).flatMap(([k, value]) => typeof value === 'string' ? [prefix + k] : leaves(value, prefix + k + '.'));
  assert.deepEqual(leaves(en.f8).sort(), leaves(vi.f8).sort());
  for (const language of ['en-US', 'vi-VN']) {
    await i18n.changeLanguage(language);
    const detail = renderToStaticMarkup(<ProductFields product={product} />); assert.ok(detail.includes('Real description')); assert.ok(detail.includes('2.5') || detail.includes('2,5'));
    const parsed = renderToStaticMarkup(<ResolutionDetails result={result} onOpen={() => {}} />); assert.ok(parsed.includes('2027-03-04')); assert.ok(parsed.includes('LOT-A')); assert.ok(!parsed.includes('Available')); assert.ok(!parsed.includes('f8.'));
  }
});
test('presentation errors are localized by status, never raw server messages', () => {
  assert.equal(productErrorKey({ status: 400, message: '<script>' }, true), 'f8.errors.barcode');
  for (const status of [401, 403, 404]) assert.equal(productErrorKey({ status, message: '' }), `f8.errors.${status}`);
  assert.equal(productErrorKey({ status: 500, message: '' }), 'f8.errors.server');
});
test('missing session renders forbidden without reads; source uses no alternate product cache or warehouse dependencies', () => {
  sessionStore.set(null); const markup = renderToStaticMarkup(<ProductWorkspace />); assert.ok(!markup.includes('<table'));
  const source = readFileSync('src/features/products/ProductWorkspace.tsx', 'utf8');
  assert.ok(!/productService|DBViewer|inventoryQueries\.(warehouses|zones|bins|products)\(/.test(source));
  assert.ok(source.includes('inventoryQueries.productsPage(')); assert.ok(source.includes('enabled: requested')); assert.ok(source.includes('<dialog')); assert.ok(!source.includes('stockStatus'));
});
test('page metrics use only supplied page items, trim empty data and preserve zero', () => {
  const page = [product, { ...product, id: other, barcode: ' ', unit: ' Pcs ' }, { ...product, id: 'abcdef00-0000-0000-0000-000000000003', barcode: '', unit: '' }];
  const before = structuredClone(page);
  assert.deepEqual(productPageMetrics(page), { withBarcode: 1, missingBarcode: 2, distinctUnits: 1, coverage: 33 });
  assert.deepEqual(productPageMetrics([]), { withBarcode: 0, missingBarcode: 0, distinctUnits: 0, coverage: null });
  assert.deepEqual(page, before);
});
test('KPI global total is independent of page counts and unavailable data never becomes zero', async () => {
  await i18n.changeLanguage('en-US');
  const populated = renderToStaticMarkup(<ProductMetrics total={901} items={[product]} />);
  assert.ok(populated.includes('901')); assert.ok(populated.includes('100% coverage on the current page'));
  assert.ok(populated.includes('Across the product catalog')); assert.ok(populated.includes('Distinct Units — Current Page'));
  const pending = renderToStaticMarkup(<ProductMetrics busy />);
  assert.equal((pending.match(/>—<\/p>/g) || []).length, 4); assert.ok(pending.includes('aria-busy="true"'));
});
test('approved primary table hierarchy retains description, unitless weight and accessible read actions', async () => {
  await i18n.changeLanguage('en-US');
  const html = renderToStaticMarkup(<ProductCatalogTable items={[product]} onOpen={() => {}} />);
  const labels = ['SKU', 'Barcode', 'Product name &amp; description', 'Unit', 'Weight', 'Actions'];
  let index = -1; for (const label of labels) { const next = html.indexOf('>' + label + '</th>'); assert.ok(next > index, label); index = next; }
  assert.ok(html.includes('Real description')); assert.ok(html.includes('View product SKU-A')); assert.ok(html.includes('Preview QR for product SKU-A'));
  assert.ok(!html.includes('kg')); assert.ok(!html.includes('Tracking mode')); assert.ok(!/Create product|Edit product|Delete product/.test(html));
});
test('label preview includes only canonical identity and its supplied QR content', async () => {
  for (const language of ['en-US', 'vi-VN']) {
    await i18n.changeLanguage(language);
    const html = renderToStaticMarkup(<ProductLabelPreview product={product}><span>QR fixture</span></ProductLabelPreview>);
    for (const text of ['SmartWMS', product.sku, product.barcode, product.name, product.unit, 'QR fixture']) assert.ok(html.includes(text));
    assert.ok(!/Price|Category|kg|3&quot;|printer|f8\./.test(html));
  }
});
test('catalog total and initial list share one existing cache entry; barcode dialog is not permanently mounted', async () => {
  ok(); await i18n.changeLanguage('en-US'); const c = client();
  c.setQueryData(inventoryQueries.productsPage(1, '').queryKey, { items: [product], pageIndex: 1, pageSize: 20, totalCount: 901, totalPages: 46, hasPreviousPage: false, hasNextPage: true });
  const html = renderToStaticMarkup(<QueryClientProvider client={c}><ProductWorkspace /></QueryClientProvider>);
  assert.equal(c.getQueryCache().getAll().length, 1);
  assert.ok(html.includes('901')); assert.ok(html.indexOf('Product catalog metrics') < html.indexOf('Product catalog tools'));
  assert.ok(html.indexOf('Product catalog tools') < html.indexOf('id="product-catalog-title"'));
  assert.ok(html.includes('Analyze barcode')); assert.ok(!html.includes('id="product-barcode"')); assert.ok(!html.includes('<dialog'));
  c.clear();
});
