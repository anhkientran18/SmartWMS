import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import axios from 'axios';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { adminRead, adminWrite, adminDelete, validAdminData } from '../src/services/administration/adminApi';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import { safeAuditValues } from '../src/features/administration/AuditLogWorkspace';
import { canViewExecutiveDashboard, getExecutiveDashboard, ExecutiveDashboardData } from '../src/services/dashboard/executiveDashboardApi';
import ExecutiveInsightCard from '../src/features/dashboard/ExecutiveInsightCard';
import OperationalDashboard from '../src/features/dashboard/OperationalDashboard';
import { inventoryQueries } from '../src/services/inventory/inventoryQueries';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const id = '50000000-0000-0000-0000-000000000001';
const response = (config: any, data: unknown, status = 200) => ({ config, data, status, headers: {}, statusText: String(status) });
const session = () => sessionStore.set({ token: `fixture.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.unsigned`, username: 'fixture', role: 'Admin' });
test('Supplier paging sends the actual searchTerm and cancellation signal', async () => {
  session(); const signal = new AbortController().signal;
  const page = { items: [], totalCount: 0, totalPages: 0 };
  httpClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/Suppliers'); assert.deepEqual(config.params, { pageNumber: 2, pageSize: 10, searchTerm: 'demo' }); assert.equal(config.signal, signal);
    return response(config, { isSuccess: true, data: page });
  };
  assert.deepEqual(await adminRead('Suppliers', signal, { pageNumber: 2, pageSize: 10, searchTerm: 'demo' }), page);
});
test('User pages retain their special totalRecords shape and reject noncanonical roles', () => {
  const user = { id, username: 'demo', email: 'demo@example.test', firstName: 'Demo', lastName: 'Sprint', fullName: 'Sprint Demo', role: 'Staff', isActive: false };
  assert.equal(validAdminData('Users', { totalRecords: 1, totalPages: 1, items: [user] }), true);
  assert.equal(validAdminData('Users', { totalCount: 1, totalPages: 1, items: [user] }), false);
  assert.equal(validAdminData(`Users/${id}`, { ...user, role: 'Worker' }), false);
});
test('Malformed master reads fail as a contract error instead of becoming empty data', async () => {
  session(); httpClient.defaults.adapter = async config => response(config, { isSuccess: true, data: { items: null, totalCount: 0, totalPages: 0 } });
  await assert.rejects(adminRead('Suppliers'), (e: any) => e.status === 502 && e.code === 'FE_ADMIN_CONTRACT');
});
test('User edits preserve inactive false, complete names and canonical role with matching body/path ID', async () => {
  session(); const payload = { firstName: 'Demo', lastName: 'Sprint', role: 'Staff', isActive: false };
  httpClient.defaults.adapter = async config => { assert.equal(config.method, 'put'); assert.equal(config.url, `/api/v1/Users/${id}`); assert.deepEqual(JSON.parse(config.data), { ...payload, id }); return response(config, { isSuccess: true, data: true }); };
  assert.equal(await adminWrite('Users', payload, id), true);
});
test('Warehouse update preserves omitted default staging configuration', async () => {
  session(); httpClient.defaults.adapter = async config => { const body = JSON.parse(config.data); assert.equal(Object.hasOwn(body, 'defaultStagingBinId'), false); return response(config, { isSuccess: true, data: true }); };
  await adminWrite('Warehouses', { code: 'DEMO', name: 'Demo warehouse', address: '' }, id);
});
test('Create requires a returned identity and never silently accepts a boolean', async () => {
  session(); httpClient.defaults.adapter = async config => response(config, { isSuccess: true, data: true });
  await assert.rejects(adminWrite('Suppliers', { code: 'DEMO', name: 'Demo' }), (e: any) => e.code === 'FE_ADMIN_CONTRACT');
  httpClient.defaults.adapter = async config => response(config, { isSuccess: true, data: id });
  assert.equal(await adminWrite('Suppliers', { code: 'DEMO', name: 'Demo' }), id);
});
test('Dependency failures remain conflicts and are never transformed into successful deletion', async () => {
  session(); httpClient.defaults.adapter = async config => { throw new axios.AxiosError('conflict', undefined, config, undefined, response(config, { errorCode: 'COM_409' }, 409)); };
  await assert.rejects(adminDelete('Zones', id), (e: any) => e.status === 409 && e.code === 'COM_409');
  assert.equal(sessionStore.get()?.username, 'fixture');
});
test('Admin authorization rejection retains the signed-in session', async () => {
  session(); httpClient.defaults.adapter = async config => { throw new axios.AxiosError('forbidden', undefined, config, undefined, response(config, null, 403)); };
  await assert.rejects(adminRead('Users'), (e: any) => e.status === 403);
  assert.ok(sessionStore.get());
});
test('Audit detail safely redacts nested credentials without evaluating JSON strings', () => {
  const safe = safeAuditValues(JSON.stringify({ name: 'Demo', passwordHash: 'private', nested: { accessToken: 'private', quantity: 3 } }));
  assert.ok(!safe.includes('private')); assert.ok(safe.includes('Demo')); assert.ok(safe.includes('3'));
  assert.equal(safeAuditValues(null), '—'); assert.equal(safeAuditValues('<script>'), '[Unstructured audit data]');
});
test('VI and EN authorization errors are available without depending on server prose', async () => {
  await i18n.changeLanguage('en-US'); assert.ok(i18n.t('f1.errors.403').length > 5);
  await i18n.changeLanguage('vi-VN'); assert.ok(i18n.t('f1.errors.403').length > 5);
});
test('K11 executiveDashboardApi restricts Staff with 403 and normalizes Admin/WarehouseManager executive payload', async () => {
  assert.equal(canViewExecutiveDashboard('Admin'), true);
  assert.equal(canViewExecutiveDashboard('WarehouseManager'), true);
  assert.equal(canViewExecutiveDashboard('Staff'), false);
  assert.equal(canViewExecutiveDashboard(undefined), false);

  let calls = 0;
  httpClient.defaults.adapter = async config => { calls++; return response(config, { isSuccess: true, data: {} }); };
  sessionStore.set({ token: `fixture.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.unsigned`, username: 'staff-user', role: 'Staff' });
  await assert.rejects(() => getExecutiveDashboard(), (err: any) => err?.status === 403);
  assert.equal(calls, 0);

  session();
  httpClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/Dashboard/executive');
    return response(config, {
      isSuccess: true,
      data: {
        warehouse: {
          totalProducts: 45,
          totalActiveBins: 120,
          globalOccupancyRate: 68.5,
          lowStockAlerts: [{ productId: id, sku: 'SKU-01', productName: 'Widget A', currentStock: 5 }],
          recentTransactions: [{ sku: 'SKU-01', transactionType: 'INBOUND', quantityChanged: 20, location: 'BIN-01', createdAt: '2026-10-31T10:00:00Z' }],
        },
        inventory: { totalProducts: 45, totalQuantity: 1500, lowStockItems: 3 },
        inboundReceiptsByStatus: { New: 4, Processing: 2, Completed: 18 },
        outboundOrdersByStatus: { Pending: 1, Picked: 3, Shipped: 25 },
        aiInsight: {
          totalProducts: 45,
          totalBins: 120,
          overallOccupancyPercentage: 68.5,
          aiExecutiveSummary: 'Storage occupancy is healthy at 68.5%.',
          aiAvailable: true,
          aiErrorCode: null,
        },
      },
    });
  };
  const data = await getExecutiveDashboard();
  assert.equal(data.warehouse.totalProducts, 45);
  assert.equal(data.inboundReceiptsByStatus['New'], 4);
  assert.equal(data.outboundOrdersByStatus['Shipped'], 25);
  assert.equal(data.aiInsight.aiAvailable, true);
});
test('K11 ExecutiveInsightCard and OperationalDashboard render for Admin/WarehouseManager, hide for Staff, and handle AI offline fallback', async () => {
  const sampleData: ExecutiveDashboardData = {
    warehouse: {
      totalProducts: 50,
      totalActiveBins: 100,
      globalOccupancyRate: 70,
      lowStockAlerts: [],
      recentTransactions: [{ sku: 'SKU-01', transactionType: 'INBOUND', quantityChanged: 10, location: 'BIN-A', createdAt: '2026-10-31T12:00:00Z' }],
    },
    inventory: { totalProducts: 50, totalQuantity: 1000, lowStockItems: 0 },
    inboundReceiptsByStatus: { New: 3, Completed: 9 },
    outboundOrdersByStatus: { Pending: 2, Shipped: 10 },
    aiInsight: {
      totalProducts: 50,
      totalBins: 100,
      overallOccupancyPercentage: 70,
      aiExecutiveSummary: 'AI operational assessment: optimal storage capacity.',
      aiAvailable: true,
      aiErrorCode: null,
    },
  };

  await i18n.changeLanguage('en-US');
  const onlineHtml = renderToStaticMarkup(<ExecutiveInsightCard data={sampleData} />);
  assert.ok(onlineHtml.includes('AI operational assessment: optimal storage capacity.'));
  assert.ok(onlineHtml.includes(en.dashboard.executive.aiGenerated));
  assert.ok(onlineHtml.includes('SKU-01'));

  const offlineHtml = renderToStaticMarkup(
    <ExecutiveInsightCard data={{ ...sampleData, aiInsight: { ...sampleData.aiInsight, aiAvailable: false, aiExecutiveSummary: '' } }} />
  );
  assert.ok(offlineHtml.includes(en.dashboard.executive.aiOfflineBadge));
  assert.ok(offlineHtml.includes(en.dashboard.executive.aiUnavailableNotice));

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  qc.setQueryData(inventoryQueries.summary().queryKey, { totalProducts: 50, totalQuantity: 1000, lowStockItems: 0 });
  qc.setQueryData(inventoryQueries.alerts().queryKey, []);
  qc.setQueryData(['private', 'dashboard', 'occupancy'], []);
  qc.setQueryData(['private', 'dashboard', 'chart', 7], []);
  qc.setQueryData(['private', 'dashboard', 'executive'], sampleData);

  session();
  const adminDashHtml = renderToStaticMarkup(<QueryClientProvider client={qc}><MemoryRouter><OperationalDashboard /></MemoryRouter></QueryClientProvider>);
  assert.ok(adminDashHtml.includes(en.dashboard.executive.subtitle));
  assert.ok(adminDashHtml.includes('AI operational assessment: optimal storage capacity.'));

  sessionStore.set({ token: `fixture.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.unsigned`, username: 'staff-user', role: 'Staff' });
  const staffDashHtml = renderToStaticMarkup(<QueryClientProvider client={qc}><MemoryRouter><OperationalDashboard /></MemoryRouter></QueryClientProvider>);
  assert.ok(!staffDashHtml.includes(en.dashboard.executive.subtitle));
  qc.clear();

  const leaves = (obj: Record<string, any>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  assert.deepEqual(leaves(vi.dashboard.executive).sort(), leaves(en.dashboard.executive).sort());
  await i18n.changeLanguage('vi-VN');
});
test('K11 backend controllers and Program.cs enforce RBAC hardening, BinsController intersection fix, and Hangfire dashboard guard', () => {
  const products = readFileSync('../backend/src/SmartWMS.Api/Controllers/ProductsController.cs', 'utf8');
  assert.equal((products.match(/\[Authorize\(Roles = "Admin,WarehouseManager"\)\]/g) ?? []).length, 3);

  const customers = readFileSync('../backend/src/SmartWMS.Api/Controllers/CustomersController.cs', 'utf8');
  assert.equal((customers.match(/\[Authorize\(Roles = "Admin,WarehouseManager"\)\]/g) ?? []).length, 3);

  const inbound = readFileSync('../backend/src/SmartWMS.Api/Controllers/InboundReceiptsController.cs', 'utf8');
  assert.equal((inbound.match(/\[Authorize\(Roles = "Admin,WarehouseManager"\)\]/g) ?? []).length, 3);

  const outbound = readFileSync('../backend/src/SmartWMS.Api/Controllers/OutboundOrdersController.cs', 'utf8');
  assert.equal((outbound.match(/\[Authorize\(Roles = "Admin,WarehouseManager"\)\]/g) ?? []).length, 6);

  const bins = readFileSync('../backend/src/SmartWMS.Api/Controllers/BinsController.cs', 'utf8');
  assert.match(bins, /\[Authorize\]\r?\n\[ApiController\]/);
  assert.match(bins, /\[Authorize\(Roles = "Admin,WarehouseManager,Staff"\)\]\r?\n\s*\[HttpGet\("\{id:guid\}\/contents"\)\]/);
  assert.equal((bins.match(/\[Authorize\(Roles = "Admin,WarehouseManager"\)\]/g) ?? []).length, 6);

  const program = readFileSync('../backend/src/SmartWMS.Api/Program.cs', 'utf8');
  assert.match(program, /if\s*\(enableHangfireServer\)\s*\{\s*app\.UseHangfireDashboard\("\/hangfire"\);\s*\}/);
});
