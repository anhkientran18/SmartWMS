// Deterministic tests for K8 StockStatusModal, changeStockStatus, and G16 Bin Capacity Excel Export Labeling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import { inventoryQueries } from '../src/services/inventory/inventoryQueries';
import {
  canMutateInventory,
  changeStockStatus,
  exportInventoryExcel,
  MAX_STATUS_REASON,
} from '../src/services/inventory/inventoryMutationApi';
import { InventoryStatus } from '../src/services/inventory/types';
import StockStatusModal, {
  canSubmitStockStatusChange,
  createStockStatusSubmissionGate,
  resolveInitialTargetStatus,
} from '../src/features/inventory/StockStatusModal';
import RealStockVisibility from '../src/features/inventory/RealStockVisibility';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const binId = '11111111-1111-1111-1111-111111111111';
const productId = '22222222-2222-2222-2222-222222222222';
const otherId = '33333333-3333-3333-3333-333333333333';

let tokenNonce = 0;
const makeUser = (
  role: 'Admin' | 'WarehouseManager' | 'Staff' = 'Admin',
) => ({
  token: `test.${btoa(
    JSON.stringify({ exp: Date.now() / 1000 + 3600, nonce: ++tokenNonce }),
  )}.unsigned`,
  username: 'fixture_k8',
  fullName: '',
  role,
});

const response = (
  config: any,
  data: any,
  status = 200,
  headers: Record<string, string> = {},
) => ({
  config,
  data,
  status,
  statusText: String(status),
  headers,
});

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, gcTime: 0 },
    },
  });

test('K8 Scenario 1: changeStockStatus RBAC & contract validation (Admin/WM allowed, Staff 403, Reserved/invalid enum/empty reason/invalid GUID rejected)', async () => {
  assert.equal(canMutateInventory('Admin'), true);
  assert.equal(canMutateInventory('WarehouseManager'), true);
  assert.equal(canMutateInventory('Staff'), false);
  assert.equal(canMutateInventory(undefined), false);

  // Staff is blocked with 403
  sessionStore.set(makeUser('Staff'));
  await assert.rejects(
    changeStockStatus({
      binId,
      productId,
      lotNumber: 'LOT-01',
      newStatus: InventoryStatus.QCHold,
      reasonCode: 'QC_INSPECTION',
    }),
    (err: any) => err.status === 403,
  );

  // Unauthenticated session is blocked with 403
  sessionStore.set(null);
  await assert.rejects(
    changeStockStatus({
      binId,
      productId,
      lotNumber: 'LOT-01',
      newStatus: InventoryStatus.QCHold,
      reasonCode: 'QC_INSPECTION',
    }),
    (err: any) => err.status === 403,
  );

  sessionStore.set(makeUser('WarehouseManager'));
  let postCalls = 0;
  httpClient.defaults.adapter = async config => {
    postCalls++;
    return response(config, { isSuccess: true, data: true });
  };

  // Client blocks InventoryStatus.Reserved (2) and out-of-range status values
  for (const invalidStatus of [
    InventoryStatus.Reserved,
    0 as InventoryStatus,
    6 as InventoryStatus,
    99 as InventoryStatus,
  ]) {
    await assert.rejects(
      changeStockStatus({
        binId,
        productId,
        lotNumber: 'LOT-01',
        newStatus: invalidStatus,
        reasonCode: 'QC_INSPECTION',
      }),
      (err: any) => err.status === 400 && err.code === 'FE_STATUS_CONTRACT',
    );
  }

  // Empty or overlong reasonCode rejected
  for (const invalidReason of ['', '   ', 'R'.repeat(MAX_STATUS_REASON + 1)]) {
    await assert.rejects(
      changeStockStatus({
        binId,
        productId,
        lotNumber: 'LOT-01',
        newStatus: InventoryStatus.QCHold,
        reasonCode: invalidReason,
      }),
      (err: any) => err.status === 400 && err.code === 'FE_STATUS_CONTRACT',
    );
  }

  // Invalid or zero GUIDs rejected
  for (const badId of [
    'not-a-guid',
    '00000000-0000-0000-0000-000000000000',
    '',
  ]) {
    await assert.rejects(
      changeStockStatus({
        binId: badId,
        productId,
        lotNumber: 'LOT-01',
        newStatus: InventoryStatus.QCHold,
        reasonCode: 'QC_INSPECTION',
      }),
      (err: any) => err.status === 400 && err.code === 'FE_STATUS_CONTRACT',
    );
    await assert.rejects(
      changeStockStatus({
        binId,
        productId: badId,
        lotNumber: 'LOT-01',
        newStatus: InventoryStatus.QCHold,
        reasonCode: 'QC_INSPECTION',
      }),
      (err: any) => err.status === 400 && err.code === 'FE_STATUS_CONTRACT',
    );
  }

  assert.equal(postCalls, 0, 'Invalid contract calls must never reach HTTP');
  sessionStore.set(null);
});

test('K8 Scenario 2: changeStockStatus API execution, lotNumber/reason trimming, envelope validation, and 409 Conflict propagation', async () => {
  sessionStore.set(makeUser('Admin'));

  let capturedBody: any = null;
  httpClient.defaults.adapter = async config => {
    assert.equal(config.method, 'post');
    assert.equal(config.url, '/api/v1/Inventory/change-status');
    capturedBody =
      typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    return response(config, { isSuccess: true, data: true });
  };

  const ok = await changeStockStatus({
    binId,
    productId,
    lotNumber: '  LOT-2026-X  ',
    newStatus: InventoryStatus.Damaged,
    reasonCode: '  DEFECT_FOUND  ',
  });
  assert.equal(ok, true);
  assert.deepEqual(capturedBody, {
    binId,
    productId,
    lotNumber: 'LOT-2026-X',
    newStatus: InventoryStatus.Damaged,
    reasonCode: 'DEFECT_FOUND',
  });

  // Malformed 200 OK envelope rejected with 502 FE_STATUS_CONTRACT
  httpClient.defaults.adapter = async config =>
    response(config, { isSuccess: true, data: false });
  await assert.rejects(
    changeStockStatus({
      binId,
      productId,
      lotNumber: 'LOT-2026-X',
      newStatus: InventoryStatus.Available,
      reasonCode: 'QC_PASSED',
    }),
    (err: any) => err.status === 502 && err.code === 'FE_STATUS_CONTRACT',
  );

  // HTTP 409 Conflict propagates with server message preserved
  httpClient.defaults.adapter = async config => {
    throw new axios.AxiosError(
      'Conflict',
      undefined,
      config,
      undefined,
      response(
        config,
        {
          message:
            'Không thể đổi trạng thái khi có reservation/workflow hoặc chuyển sang Reserved.',
        },
        409,
      ),
    );
  };
  await assert.rejects(
    changeStockStatus({
      binId,
      productId,
      lotNumber: 'LOT-2026-X',
      newStatus: InventoryStatus.QCHold,
      reasonCode: 'QC_INSPECTION',
    }),
    (err: any) =>
      err.status === 409 &&
      /reservation\/workflow/.test(err.message),
  );

  sessionStore.set(null);
});

test('K8 Scenario 3: StockStatusModal guards Reserved rows, prevents no-op targetStatus === currentStatus, blocks double-click, and isolates post-commit refresh failure', async () => {
  sessionStore.set(makeUser('Admin'));

  // Initial target status selection avoids no-op
  assert.equal(
    resolveInitialTargetStatus('Available'),
    InventoryStatus.QCHold,
  );
  assert.equal(
    resolveInitialTargetStatus('QCHold'),
    InventoryStatus.Available,
  );
  assert.equal(
    resolveInitialTargetStatus(InventoryStatus.Damaged),
    InventoryStatus.Available,
  );

  // canSubmitStockStatusChange guards
  assert.equal(
    canSubmitStockStatusChange({
      submitting: false,
      binId,
      productId,
      currentStatus: 'Available',
      targetStatus: InventoryStatus.QCHold,
      effectiveReason: 'QC_INSPECTION',
    }),
    true,
  );
  // Blocked when currentStatus is Reserved (string or enum 2)
  assert.equal(
    canSubmitStockStatusChange({
      submitting: false,
      binId,
      productId,
      currentStatus: 'Reserved',
      targetStatus: InventoryStatus.Available,
      effectiveReason: 'QC_PASSED',
    }),
    false,
  );
  assert.equal(
    canSubmitStockStatusChange({
      submitting: false,
      binId,
      productId,
      currentStatus: InventoryStatus.Reserved,
      targetStatus: InventoryStatus.QCHold,
      effectiveReason: 'QC_INSPECTION',
    }),
    false,
  );
  // Blocked when targetStatus equals currentStatus (no-op)
  assert.equal(
    canSubmitStockStatusChange({
      submitting: false,
      binId,
      productId,
      currentStatus: 'QCHold',
      targetStatus: InventoryStatus.QCHold,
      effectiveReason: 'QC_INSPECTION',
    }),
    false,
  );
  // Blocked when reason is empty
  assert.equal(
    canSubmitStockStatusChange({
      submitting: false,
      binId,
      productId,
      currentStatus: 'Available',
      targetStatus: InventoryStatus.QCHold,
      effectiveReason: '   ',
    }),
    false,
  );

  // Submission gate: blocks Reserved rows & no-op targetStatus without calling HTTP
  let postCount = 0;
  httpClient.defaults.adapter = async config => {
    postCount++;
    return response(config, { isSuccess: true, data: true });
  };

  const gate = createStockStatusSubmissionGate();
  const reservedOutcome = await gate.submit({
    binId,
    productId,
    lotNumber: 'LOT-1',
    currentStatus: 'Reserved',
    targetStatus: InventoryStatus.Available,
    reasonCode: 'QC_PASSED',
  });
  assert.equal(reservedOutcome.committed, false);
  assert.equal(reservedOutcome.error?.code, 'FE_STATUS_RESERVED_LOCKED');
  assert.equal(postCount, 0);

  const noopOutcome = await gate.submit({
    binId,
    productId,
    lotNumber: 'LOT-1',
    currentStatus: 'QCHold',
    targetStatus: InventoryStatus.QCHold,
    reasonCode: 'QC_INSPECTION',
  });
  assert.equal(noopOutcome.committed, false);
  assert.equal(noopOutcome.error?.code, 'FE_STATUS_NOOP');
  assert.equal(postCount, 0);

  // Submission gate: double-click / concurrent submission guard
  let releasePost!: () => void;
  httpClient.defaults.adapter = config => {
    postCount++;
    return new Promise(resolve => {
      releasePost = () =>
        resolve(response(config, { isSuccess: true, data: true }));
    });
  };

  const firstCall = gate.submit({
    binId,
    productId,
    lotNumber: 'LOT-1',
    currentStatus: 'Available',
    targetStatus: InventoryStatus.QCHold,
    reasonCode: 'QC_INSPECTION',
  });
  assert.equal(gate.isInFlight(), true);

  const secondCall = await gate.submit({
    binId,
    productId,
    lotNumber: 'LOT-1',
    currentStatus: 'Available',
    targetStatus: InventoryStatus.QCHold,
    reasonCode: 'QC_INSPECTION',
  });
  assert.equal(secondCall.committed, false);
  assert.equal(secondCall.error?.code, 'FE_STATUS_IN_FLIGHT');
  while (!releasePost) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(postCount, 1, 'Second concurrent click must not dispatch a second POST');

  releasePost();
  const firstOutcome = await firstCall;
  assert.equal(postCount, 1);
  assert.equal(firstOutcome.committed, true);
  assert.equal(firstOutcome.refreshWarning, false);

  // Submission gate: separates post-commit refresh failure from mutation failure
  httpClient.defaults.adapter = async config =>
    response(config, { isSuccess: true, data: true });
  let closed = false;
  let capturedWarning = '';
  const refreshFailOutcome = await gate.submit({
    binId,
    productId,
    lotNumber: 'LOT-1',
    currentStatus: 'Available',
    targetStatus: InventoryStatus.Expired,
    reasonCode: 'EXPIRY_APPROACH',
    onClose: () => {
      closed = true;
    },
    onSuccess: async () => {
      throw new Error('Inventory query refetch failed');
    },
    onRefreshWarning: msg => {
      capturedWarning = msg;
    },
  });
  assert.equal(refreshFailOutcome.committed, true);
  assert.equal(refreshFailOutcome.refreshWarning, true);
  assert.equal(closed, true);
  assert.ok(capturedWarning.length > 0);

  // SSR render of StockStatusModal: Reserved row shows lock alert and disables fieldset
  await i18n.changeLanguage('vi-VN');
  const reservedModalHtml = renderToStaticMarkup(
    <StockStatusModal
      isOpen={true}
      onClose={() => {}}
      onSuccess={() => {}}
      binId={binId}
      binCode="BIN-01"
      productId={productId}
      productName="Item Reserved"
      sku="SKU-RES"
      lotNumber="LOT-RES"
      currentStatus="Reserved"
    />,
  );
  assert.ok(reservedModalHtml.includes(vi.f2.errors.reservedLocked));
  assert.ok(reservedModalHtml.includes(vi.f2.reservedNotice));
  assert.match(reservedModalHtml, /<fieldset disabled=""/);
  assert.doesNotMatch(
    reservedModalHtml,
    /<option value="2">/,
    'Reserved (2) must never appear as a selectable target option',
  );

  sessionStore.set(null);
});

test('K8 Scenario 4: exportInventoryExcel enforces RBAC, GETs binary blob from /api/v1/Reports/export/excel, parses filename, and rejects empty response', async () => {
  // Staff cannot export
  sessionStore.set(makeUser('Staff'));
  await assert.rejects(
    exportInventoryExcel(),
    (err: any) => err.status === 403,
  );

  // Admin can export
  sessionStore.set(makeUser('Admin'));
  httpClient.defaults.adapter = async config => {
    assert.equal(config.method, 'get');
    assert.equal(config.url, '/api/v1/Reports/export/excel');
    assert.equal(config.responseType, 'blob');
    return response(
      config,
      new Blob(['fake-bin-capacity-xlsx-bytes'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      200,
      {
        'content-disposition':
          'attachment; filename="BaoCaoTonKho_20261120_173000.xlsx"',
      },
    );
  };

  const result = await exportInventoryExcel();
  assert.equal(result.filename, 'BaoCaoTonKho_20261120_173000.xlsx');
  assert.ok(result.size > 0);

  // Fallback filename when content-disposition header is omitted
  httpClient.defaults.adapter = async config =>
    response(config, new Blob(['xlsx-data']), 200, {});
  const fallbackResult = await exportInventoryExcel();
  assert.match(fallbackResult.filename, /^BaoCaoSucChuaOLuuTru_.*\.xlsx$/);
  assert.equal(fallbackResult.size, 9);

  // Empty blob rejected with 502 FE_EXPORT_CONTRACT
  httpClient.defaults.adapter = async config =>
    response(config, new Blob([]), 200, {});
  await assert.rejects(
    exportInventoryExcel(),
    (err: any) => err.status === 502 && err.code === 'FE_EXPORT_CONTRACT',
  );

  sessionStore.set(null);
});

test('K8 Scenario 5: G16 truthful Bin Capacity Excel Export labeling & RealStockVisibility integration (Admin/WM vs Staff, Reserved row disabled)', async () => {
  // Verify VI/EN key parity for f2 and accurate G16 bin capacity description
  const flattenKeys = (obj: Record<string, any>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flattenKeys(v, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    );
  assert.deepEqual(flattenKeys(en.f2).sort(), flattenKeys(vi.f2).sort());
  assert.equal(vi.f2.exportExcel, 'Xuất Excel sức chứa ô kệ');
  assert.equal(en.f2.exportExcel, 'Export Bin Capacity Excel');
  assert.match(vi.f2.exportExcelHint, /Sức chứa tối đa.*Đang chứa.*Tỷ lệ lấp đầy/i);
  assert.match(vi.f2.exportExcelHint, /không phải sổ cái tồn kho theo SKU\/Lô/i);
  assert.match(en.f2.exportExcelHint, /Max Capacity.*Current Occupancy.*Utilization/i);
  assert.match(en.f2.exportExcelHint, /not a SKU\/Lot stock ledger/i);

  const cache = makeClient();
  cache.setQueryData(inventoryQueries.summary().queryKey, {
    totalProducts: 2,
    totalQuantity: 25,
    lowStockItems: 0,
  });
  cache.setQueryData(inventoryQueries.alerts().queryKey, []);
  cache.setQueryData(inventoryQueries.products().queryKey, [
    {
      id: productId,
      sku: 'SKU-AVAIL',
      name: 'Available Item',
      barcode: '111',
      unit: 'PCS',
      weight: 100,
      trackingMode: 1,
    },
    {
      id: otherId,
      sku: 'SKU-RES',
      name: 'Reserved Item',
      barcode: '222',
      unit: 'PCS',
      weight: 100,
      trackingMode: 1,
    },
  ]);
  cache.setQueryData(
    inventoryQueries.history({
      pageIndex: 1,
      pageSize: 10,
      productId: undefined,
      transactionType: undefined,
    }).queryKey,
    {
      items: [],
      pageIndex: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  );
  cache.setQueryData(inventoryQueries.warehouses().queryKey, []);
  cache.setQueryData(inventoryQueries.zones().queryKey, []);
  cache.setQueryData(inventoryQueries.bins().queryKey, [
    {
      id: binId,
      code: 'BIN-01',
      zoneId: otherId,
      purpose: 0,
      maxCapacity: 100,
      currentOccupancy: 25,
    },
  ]);
  cache.setQueryData(inventoryQueries.bin(binId).queryKey, {
    id: binId,
    code: 'BIN-01',
    zoneId: otherId,
    purpose: 0,
    maxCapacity: 100,
    currentOccupancy: 25,
  });
  cache.setQueryData(inventoryQueries.contents(binId).queryKey, {
    binId,
    binCode: 'BIN-01',
    purpose: 0,
    maxCapacity: 100,
    currentOccupancy: 25,
    utilizationPercentage: 25,
    items: [
      {
        productId,
        sku: 'SKU-AVAIL',
        productName: 'Available Item',
        quantity: 15,
        status: 'Available',
        lotNumber: 'LOT-A1',
        expirationDate: '2027-06-01',
      },
      {
        productId: otherId,
        sku: 'SKU-RES',
        productName: 'Reserved Item',
        quantity: 10,
        status: 'Reserved',
        lotNumber: 'LOT-R1',
        expirationDate: '2027-06-01',
      },
    ],
  });

  const renderWithBin = (c: QueryClient) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/?binId=${binId}`]}>
        <QueryClientProvider client={c}>
          <RealStockVisibility />
        </QueryClientProvider>
      </MemoryRouter>,
    );

  // Admin sees truthful G16 Export Bin Capacity Excel button, hint text, Adjust Stock, and drawer Change Status (with Reserved row disabled)
  sessionStore.set(makeUser('Admin'));
  for (const [locale, copy] of [
    ['vi-VN', vi],
    ['en-US', en],
  ] as const) {
    await i18n.changeLanguage(locale);
    const adminHtml = renderWithBin(cache);
    assert.ok(adminHtml.includes(copy.f2.exportExcel));
    assert.ok(adminHtml.includes(copy.f2.exportExcelHint));
    assert.ok(adminHtml.includes(copy.f2.adjustStock));
    assert.ok(adminHtml.includes(copy.f2.changeStatus));
    assert.ok(adminHtml.includes(copy.transfer.title));
    // The Reserved row's Change Status button has disabled="" and title={copy.f2.reservedNotice}
    assert.ok(adminHtml.includes(`title="${copy.f2.reservedNotice}"`));
    assert.ok(adminHtml.includes(`title="${copy.f2.changeStatus}"`));
  }

  // Staff never sees Export Bin Capacity Excel, Adjust Stock, or drawer Change Status / Adjust buttons
  sessionStore.set(makeUser('Staff'));
  await i18n.changeLanguage('vi-VN');
  const staffHtml = renderWithBin(cache);
  assert.ok(!staffHtml.includes(vi.f2.exportExcel));
  assert.ok(!staffHtml.includes(vi.f2.adjustStock));
  assert.ok(!staffHtml.includes(vi.f2.changeStatus));
  assert.ok(!staffHtml.includes(`title="${vi.f2.adjust}"`));

  cache.clear();
  sessionStore.set(null);
});
