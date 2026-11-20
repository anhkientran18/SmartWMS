import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import { productMutationApi, canManageProducts } from '../src/services/products/productMutationApi';
import ProductFormModal from '../src/features/products/ProductFormModal';
import ProductWorkspace, { ProductCatalogTable } from '../src/features/products/ProductWorkspace';
import { inventoryQueries } from '../src/services/inventory/inventoryQueries';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const user = (role = 'Admin') => ({
  token: `fixture.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.unsigned`,
  username: 'fixture',
  role: role as any,
});
const response = (config: any, data: any, status = 200) => ({
  config,
  data,
  status,
  headers: {},
  statusText: String(status),
});

test('canManageProducts role guard admits Admin, WarehouseManager, Staff and denies unauthenticated or unknown roles without HTTP calls', async () => {
  for (const role of ['Admin', 'WarehouseManager', 'Staff']) {
    assert.equal(canManageProducts(role), true);
  }
  for (const role of [undefined, '', 'Guest', 'Viewer']) {
    assert.equal(canManageProducts(role), false);
  }

  let calls = 0;
  httpClient.defaults.adapter = async (config) => {
    calls++;
    return response(config, { isSuccess: true, data: id(1) });
  };

  sessionStore.set(null);
  await assert.rejects(
    () =>
      productMutationApi.createProduct({
        sku: 'SKU-01',
        name: 'Product 01',
        unit: 'Pcs',
        weight: 1,
        trackingMode: 0,
      }),
    (err: any) => err?.status === 403
  );
  await assert.rejects(
    () =>
      productMutationApi.updateProduct({
        id: id(1),
        sku: 'SKU-01',
        name: 'Product 01',
        unit: 'Pcs',
        weight: 1,
        trackingMode: 0,
      }),
    (err: any) => err?.status === 403
  );
  assert.equal(calls, 0);
});

test('productMutationApi.createProduct sends POST /api/v1/Products with trimmed payload and zero fake dimension or nameEn keys (G03/G07)', async () => {
  sessionStore.set(user('WarehouseManager'));
  let capturedMethod = '';
  let capturedUrl = '';
  let capturedBody: Record<string, unknown> = {};

  httpClient.defaults.adapter = async (config) => {
    capturedMethod = String(config.method).toLowerCase();
    capturedUrl = String(config.url);
    capturedBody = JSON.parse(String(config.data));
    return response(config, { isSuccess: true, data: id(401) });
  };

  const createdId = await productMutationApi.createProduct({
    sku: '  SKU-NEW-01  ',
    barcode: '  8930001  ',
    name: '  Thung Carton 5 Lop  ',
    description: '  Bao bi dong goi  ',
    unit: '  Hop  ',
    weight: 1.75,
    trackingMode: 1,
  });

  assert.equal(createdId, id(401));
  assert.equal(capturedMethod, 'post');
  assert.equal(capturedUrl, '/api/v1/Products');
  assert.deepEqual(capturedBody, {
    sku: 'SKU-NEW-01',
    barcode: '8930001',
    name: 'Thung Carton 5 Lop',
    description: 'Bao bi dong goi',
    unit: 'Hop',
    weight: 1.75,
    trackingMode: 1,
  });
  for (const forbiddenKey of ['width', 'height', 'depth', 'nameEn']) {
    assert.equal(forbiddenKey in capturedBody, false, `Forbidden key present: ${forbiddenKey}`);
  }
});

test('productMutationApi.updateProduct sends PUT /api/v1/Products/{id} with exact supported fields and propagates 409 Conflict on TrackingMode lock', async () => {
  sessionStore.set(user('Admin'));
  let capturedMethod = '';
  let capturedUrl = '';
  let capturedBody: Record<string, unknown> = {};

  httpClient.defaults.adapter = async (config) => {
    capturedMethod = String(config.method).toLowerCase();
    capturedUrl = String(config.url);
    capturedBody = JSON.parse(String(config.data));
    return response(config, { isSuccess: true, data: true });
  };

  const updated = await productMutationApi.updateProduct({
    id: id(401),
    sku: ' SKU-NEW-01 ',
    barcode: ' 8930002 ',
    name: ' Thung Carton Cap Nhat ',
    description: ' Mo ta cap nhat ',
    unit: ' Pcs ',
    weight: 2.25,
    trackingMode: 2,
  });

  assert.equal(updated, true);
  assert.equal(capturedMethod, 'put');
  assert.equal(capturedUrl, `/api/v1/Products/${id(401)}`);
  assert.deepEqual(capturedBody, {
    id: id(401),
    sku: 'SKU-NEW-01',
    barcode: '8930002',
    name: 'Thung Carton Cap Nhat',
    description: 'Mo ta cap nhat',
    unit: 'Pcs',
    weight: 2.25,
    trackingMode: 2,
  });
  for (const forbiddenKey of ['width', 'height', 'depth', 'nameEn']) {
    assert.equal(forbiddenKey in capturedBody, false, `Forbidden key present: ${forbiddenKey}`);
  }

  // Verify 409 Conflict propagation when backend blocks TrackingMode change on product with dependencies
  const conflictMsg = 'Không thể đổi TrackingMode khi sản phẩm đã có serial, tồn kho hoặc chứng từ/workflow đang mở.';
  httpClient.defaults.adapter = async (config) => {
    throw new axios.AxiosError(
      'Conflict',
      'ERR_BAD_REQUEST',
      config,
      {},
      response(config, { isSuccess: false, message: conflictMsg }, 409)
    );
  };

  await assert.rejects(
    () =>
      productMutationApi.updateProduct({
        id: id(401),
        sku: 'SKU-NEW-01',
        name: 'Thung Carton Cap Nhat',
        unit: 'Pcs',
        weight: 2.25,
        trackingMode: 0,
      }),
    (err: any) => err?.status === 409
  );
});

test('productMutationApi strictly omits deleteProduct (G10 hard-delete hazard prevented)', () => {
  assert.equal('deleteProduct' in productMutationApi, false);
});

test('ProductFormModal renders in VI and EN for Create and Edit modes with TrackingMode change warning and zero fake dimension or nameEn inputs', async () => {
  const sampleProduct = {
    id: id(401),
    sku: 'SKU-EDIT-01',
    name: 'San pham chinh sua',
    barcode: '893999',
    unit: 'Pcs',
    weight: 3.5,
    trackingMode: 1,
    description: 'Mo ta san pham',
  };

  for (const [lang, dict] of [
    ['vi-VN', vi],
    ['en-US', en],
  ] as const) {
    await i18n.changeLanguage(lang);

    const createHtml = renderToStaticMarkup(
      <ProductFormModal isOpen={true} onClose={() => {}} onSuccess={() => {}} editProduct={null} />
    );
    assert.ok(createHtml.includes(dict.f8.createProductTitle));
    assert.ok(createHtml.includes(dict.f8.createProductBtn));
    assert.ok(!createHtml.includes(dict.f8.trackingModeChangeWarning));

    const editHtml = renderToStaticMarkup(
      <ProductFormModal isOpen={true} onClose={() => {}} onSuccess={() => {}} editProduct={sampleProduct} />
    );
    assert.ok(editHtml.includes(dict.f8.editProductTitle));
    assert.ok(editHtml.includes(dict.common.saveChanges));
    assert.ok(editHtml.includes(dict.f8.trackingModeChangeWarning));

    for (const html of [createHtml, editHtml]) {
      assert.ok(html.includes('id="product-form-sku"'));
      assert.ok(html.includes('id="product-form-barcode"'));
      assert.ok(html.includes('id="product-form-name"'));
      assert.ok(html.includes('id="product-form-unit"'));
      assert.ok(html.includes('id="product-form-weight"'));
      assert.ok(html.includes('id="product-form-tracking-mode"'));
      assert.ok(html.includes('id="product-form-description"'));
      // G03 & G07: strictly zero width/height/depth/nameEn form inputs or labels
      assert.ok(
        !/id="product-form-(width|height|depth|name-en)"|nameEn|Dimensions|Kích thước/i.test(html)
      );
    }
  }
  await i18n.changeLanguage('vi-VN');
});

test('ProductWorkspace renders Add Product and row-level Edit buttons for authorized roles and zero Delete Product buttons (G10)', async () => {
  sessionStore.set(user('Admin'));
  const sampleProduct = {
    id: id(401),
    sku: 'SKU-A',
    name: 'Real product',
    barcode: '123',
    unit: 'Pcs',
    weight: 2.5,
    trackingMode: 2,
    description: 'Real description',
  };

  for (const [lang, dict] of [
    ['vi-VN', vi],
    ['en-US', en],
  ] as const) {
    await i18n.changeLanguage(lang);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    qc.setQueryData(inventoryQueries.productsPage(1, '').queryKey, {
      items: [sampleProduct],
      pageIndex: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });

    const workspaceHtml = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <ProductWorkspace />
      </QueryClientProvider>
    );
    assert.ok(workspaceHtml.includes(dict.f8.addProduct));
    assert.ok(workspaceHtml.includes(`title="${dict.common.buttons.edit}"`));
    assert.ok(!workspaceHtml.includes(`title="${dict.common.buttons.delete}"`));

    const tableHtml = renderToStaticMarkup(
      <ProductCatalogTable items={[sampleProduct]} onOpen={() => {}} onEdit={() => {}} />
    );
    assert.ok(tableHtml.includes(`title="${dict.common.buttons.edit}"`));
    assert.ok(!tableHtml.includes(`title="${dict.common.buttons.delete}"`));
    qc.clear();
  }
  await i18n.changeLanguage('vi-VN');
});

test('VI and EN f8 and common locale namespaces maintain strict key parity', () => {
  const leaves = (obj: Record<string, any>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]
    );
  assert.deepEqual(leaves(vi.f8).sort(), leaves(en.f8).sort());
  assert.deepEqual(leaves(vi.common).sort(), leaves(en.common).sort());
});
