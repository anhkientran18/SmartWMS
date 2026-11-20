import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import { customerApi, canManageCustomers } from '../src/services/customers/customerApi';
import CustomerModal from '../src/features/customers/CustomerModal';
import RealCreateOutbound from '../src/features/outbound/RealCreateOutbound';
import { outboundQueries } from '../src/services/outbound/outboundQueries';
import { inventoryQueries } from '../src/services/inventory/inventoryQueries';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const id = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
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

test('canManageCustomers role guard admits Admin, WarehouseManager and denies Staff, unauthenticated or unknown roles without HTTP calls', async () => {
  for (const role of ['Admin', 'WarehouseManager']) {
    assert.equal(canManageCustomers(role), true);
  }
  for (const role of ['Staff', undefined, '', 'Guest', 'Viewer']) {
    assert.equal(canManageCustomers(role), false);
  }

  let calls = 0;
  httpClient.defaults.adapter = async (config) => {
    calls++;
    return response(config, { isSuccess: true, data: id(1) });
  };

  for (const session of [null, user('Staff')]) {
    sessionStore.set(session);
    await assert.rejects(
      () => customerApi.createCustomer({ code: 'CUST-01', name: 'Customer 01' }),
      (err: any) => err?.status === 403
    );
    await assert.rejects(
      () => customerApi.updateCustomer({ id: id(1), code: 'CUST-01', name: 'Customer 01' }),
      (err: any) => err?.status === 403
    );
    await assert.rejects(
      () => customerApi.getCustomerById(id(1)),
      (err: any) => err?.status === 403
    );
  }
  assert.equal(calls, 0);
});

test('customerApi.createCustomer sends POST /api/v1/Customers with trimmed payload and zero nameEn keys (G07)', async () => {
  sessionStore.set(user('Admin'));
  let capturedMethod = '';
  let capturedUrl = '';
  let capturedBody: Record<string, unknown> = {};

  httpClient.defaults.adapter = async (config) => {
    capturedMethod = String(config.method).toLowerCase();
    capturedUrl = String(config.url);
    capturedBody = JSON.parse(String(config.data));
    return response(config, { isSuccess: true, data: id(301) });
  };

  const createdId = await customerApi.createCustomer({
    code: '  CUST-NEW-01  ',
    name: '  Cong ty TNHH Minh Phu  ',
    email: '  contact@minhphu.vn  ',
    phone: '  0909123456  ',
    deliveryAddress: '  123 Le Loi, Q1, TP.HCM  ',
  });

  assert.equal(createdId, id(301));
  assert.equal(capturedMethod, 'post');
  assert.equal(capturedUrl, '/api/v1/Customers');
  assert.deepEqual(capturedBody, {
    code: 'CUST-NEW-01',
    name: 'Cong ty TNHH Minh Phu',
    email: 'contact@minhphu.vn',
    phone: '0909123456',
    deliveryAddress: '123 Le Loi, Q1, TP.HCM',
  });
  assert.equal('nameEn' in capturedBody, false);
});

test('customerApi.updateCustomer sends PUT /api/v1/Customers/{id} and customerApi.getCustomerById normalizes address to deliveryAddress', async () => {
  sessionStore.set(user('WarehouseManager'));
  let capturedMethod = '';
  let capturedUrl = '';
  let capturedBody: Record<string, unknown> = {};

  httpClient.defaults.adapter = async (config) => {
    capturedMethod = String(config.method).toLowerCase();
    capturedUrl = String(config.url);
    if (config.data) {
      capturedBody = JSON.parse(String(config.data));
      return response(config, { isSuccess: true, data: true });
    }
    return response(config, {
      isSuccess: true,
      data: {
        id: id(301),
        code: 'CUST-301',
        name: 'Cong ty Minh Phu',
        email: 'sales@minhphu.vn',
        phone: '0909111222',
        address: '456 Nguyen Hue, Q1',
      },
    });
  };

  const detail = await customerApi.getCustomerById(id(301));
  assert.equal(capturedMethod, 'get');
  assert.equal(capturedUrl, `/api/v1/Customers/${id(301)}`);
  assert.equal(detail.deliveryAddress, '456 Nguyen Hue, Q1');

  const updated = await customerApi.updateCustomer({
    id: id(301),
    code: ' CUST-301 ',
    name: ' Cong ty Minh Phu Updated ',
    email: ' sales@minhphu.vn ',
    phone: ' 0909111222 ',
    deliveryAddress: ' 789 Dien Bien Phu ',
  });

  assert.equal(updated, true);
  assert.equal(capturedMethod, 'put');
  assert.equal(capturedUrl, `/api/v1/Customers/${id(301)}`);
  assert.deepEqual(capturedBody, {
    id: id(301),
    code: 'CUST-301',
    name: 'Cong ty Minh Phu Updated',
    email: 'sales@minhphu.vn',
    phone: '0909111222',
    deliveryAddress: '789 Dien Bien Phu',
  });
  assert.equal('nameEn' in capturedBody, false);
});

test('CustomerModal renders in VI and EN for Create and Edit modes with zero nameEn inputs', async () => {
  const sampleCustomer = {
    id: id(301),
    code: 'CUST-301',
    name: 'Cong ty Minh Phu',
    email: 'info@minhphu.vn',
    phone: '0909000111',
    deliveryAddress: '123 Le Loi',
  };

  for (const [lang, dict] of [
    ['vi-VN', vi],
    ['en-US', en],
  ] as const) {
    await i18n.changeLanguage(lang);

    const createHtml = renderToStaticMarkup(
      <CustomerModal isOpen={true} onClose={() => {}} onSuccess={() => {}} editCustomer={null} />
    );
    assert.ok(createHtml.includes(dict.customer.createTitle));
    assert.ok(createHtml.includes(dict.customer.createBtn));

    const editHtml = renderToStaticMarkup(
      <CustomerModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        editCustomer={sampleCustomer}
      />
    );
    assert.ok(editHtml.includes(dict.customer.editTitle));
    assert.ok(editHtml.includes(dict.common.saveChanges));

    for (const html of [createHtml, editHtml]) {
      assert.ok(html.includes('id="customer-form-code"'));
      assert.ok(html.includes('id="customer-form-name"'));
      assert.ok(html.includes('id="customer-form-email"'));
      assert.ok(html.includes('id="customer-form-phone"'));
      assert.ok(html.includes('id="customer-form-address"'));
      assert.ok(!/nameEn/i.test(html));
    }
  }
  await i18n.changeLanguage('vi-VN');
});

test('RealCreateOutbound renders inline New Customer trigger button in VI and EN', async () => {
  sessionStore.set(user('Admin'));
  for (const [lang, dict] of [
    ['vi-VN', vi],
    ['en-US', en],
  ] as const) {
    await i18n.changeLanguage(lang);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    qc.setQueryData(outboundQueries.customers().queryKey, [
      { id: id(301), code: 'CUST-301', name: 'Cong ty Minh Phu' },
    ]);
    qc.setQueryData(inventoryQueries.products().queryKey, []);
    qc.setQueryData(inventoryQueries.bins().queryKey, []);
    qc.setQueryData(inventoryQueries.zones().queryKey, []);
    qc.setQueryData(inventoryQueries.warehouses().queryKey, []);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RealCreateOutbound />
        </MemoryRouter>
      </QueryClientProvider>
    );
    assert.ok(html.includes(dict.customer.newCustomer));
    assert.ok(html.includes('id="outbound-customer-select"'));

    sessionStore.set(user('Staff'));
    const staffHtml = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RealCreateOutbound />
        </MemoryRouter>
      </QueryClientProvider>
    );
    assert.ok(staffHtml.includes(dict.f5.errors.forbidden));
    assert.ok(!staffHtml.includes(dict.customer.newCustomer));
    sessionStore.set(user('Admin'));
    qc.clear();
  }
  await i18n.changeLanguage('vi-VN');
});

test('VI and EN customer and common locale namespaces maintain strict key parity', () => {
  const leaves = (obj: Record<string, any>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]
    );
  assert.deepEqual(leaves(vi.customer).sort(), leaves(en.customer).sort());
  assert.deepEqual(leaves(vi.common).sort(), leaves(en.common).sort());
});
