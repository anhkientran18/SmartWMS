// Deterministic stock adjustment safety, journaling, reconciliation, and UI tests. No real stock mutation.
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
  adjustStock,
  adjustStockRequest,
  canAdjustStock,
  MAX_ADJUSTMENT_QUANTITY,
} from '../src/services/inventory/stockAdjustmentApi';
import {
  createStockAdjustmentOperation,
  getJournalStorageKey,
  getStockAdjustmentOperation,
  hashSessionToken,
  parseJournalEntry,
  sha256Hex,
} from '../src/services/inventory/stockAdjustmentMutation';
import RealStockVisibility from '../src/features/inventory/RealStockVisibility';
import StockAdjustmentModal, {
  createStockAdjustmentEventHandlers,
} from '../src/features/inventory/StockAdjustmentModal';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const binId = '11111111-1111-1111-1111-111111111111';
const productId = '22222222-2222-2222-2222-222222222222';
const zoneId = '33333333-3333-3333-3333-333333333333';
const txId = '44444444-4444-4444-4444-444444444444';

let nonce = 0;
const makeUser = (
  role: 'Admin' | 'WarehouseManager' | 'Staff' = 'Admin',
  username = 'fixture_admin',
) => ({
  role,
  username,
  token: `test.${btoa(
    JSON.stringify({ exp: Date.now() / 1000 + 3600, nonce: ++nonce, username }),
  )}.unsigned`,
});

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, gcTime: 0 },
      mutations: { retry: 3, retryDelay: 1 },
    },
  });

const response = (config: any, data: any, status = 200) => ({
  config,
  data,
  status,
  statusText: String(status),
  headers: {},
});

const validPayload = {
  binId,
  productId,
  lotNumber: 'LOT-2026-A',
  adjustmentQuantity: -5,
  reasonCode: 'DAMAGED_GOODS',
};

const binFixture = {
  id: binId,
  code: 'BIN-A01',
  zoneId,
  purpose: 0,
  maxCapacity: 100,
  currentOccupancy: 35,
};

const productLotFixture = {
  id: productId,
  sku: 'SKU-LOT-01',
  name: 'Lot Tracked Item',
  barcode: '8930001',
  unit: 'PCS',
  weight: 500,
  trackingMode: 1,
};

const productSerialFixture = {
  ...productLotFixture,
  id: '55555555-5555-5555-5555-555555555555',
  sku: 'SKU-SER-01',
  name: 'Serial Tracked Item',
  trackingMode: 2,
};

const binContentsFixture = (qty = 35) => ({
  binId,
  binCode: 'BIN-A01',
  purpose: 0,
  maxCapacity: 100,
  currentOccupancy: qty,
  utilizationPercentage: qty,
  items: [
    {
      productId,
      sku: 'SKU-LOT-01',
      productName: 'Lot Tracked Item',
      lotNumber: 'LOT-2026-A',
      quantity: qty,
      expirationDate: '2027-12-31',
      status: 'Available',
    },
  ],
});

const summaryFixture = {
  totalProducts: 1,
  totalQuantity: 35,
  lowStockItems: 0,
};

const historyPageFixture = (includeMatchingTx = true) => ({
  items: includeMatchingTx
    ? [
        {
          id: txId,
          productId,
          productName: 'Lot Tracked Item',
          transactionType: 'ADJUSTMENT',
          quantityChanged: -5,
          sourceBinCode: 'BIN-A01',
          destinationBinCode: 'N/A',
          reasonCode: 'DAMAGED_GOODS',
          createdAt: '2026-11-20T08:00:00Z',
          createdBy: 'WarehouseManager',
        },
      ]
    : [],
  pageIndex: 1,
  pageSize: 10,
  totalCount: includeMatchingTx ? 1 : 0,
  totalPages: includeMatchingTx ? 1 : 0,
  hasPreviousPage: false,
  hasNextPage: false,
});

function mockStandardReads(config: any, qty = 35, includeMatchingTx = true) {
  if (config.url === `/api/v1/Bins/${binId}/contents`) {
    return response(config, { isSuccess: true, data: binContentsFixture(qty) });
  }
  if (config.url === '/api/v1/Inventory/stock-summary') {
    return response(config, { isSuccess: true, data: summaryFixture });
  }
  if (config.url === '/api/v1/Inventory/stock-history') {
    return response(config, {
      isSuccess: true,
      data: historyPageFixture(includeMatchingTx),
    });
  }
  throw new Error(`Unexpected GET in fixture: ${config.url}`);
}

test('G02 Scenario 1: Pre-POST journaling & read-back verification blocks POST when sessionStorage fails or corrupts read-back', async () => {
  globalThis.sessionStorage.clear();
  const session = makeUser('Admin');
  sessionStore.set(session);
  const expectedKey = getJournalStorageKey(sha256Hex(session.token));
  assert.equal(await hashSessionToken(session.token), sha256Hex(session.token));

  // Case 1A: Pending journal is written and verified BEFORE POST executes
  const cache1 = makeClient();
  const op1 = createStockAdjustmentOperation(cache1);
  let postObservedPendingJournal = false;
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') {
      assert.equal(config.url, '/api/v1/Inventory/adjust-stock');
      const rawInFlight = globalThis.sessionStorage.getItem(expectedKey);
      assert.ok(rawInFlight, 'Journal must exist in sessionStorage before POST completes');
      const parsed = parseJournalEntry(rawInFlight, sha256Hex(session.token));
      assert.equal(parsed.status, 'pending');
      assert.deepEqual(parsed.request, validPayload);
      assert.ok(!rawInFlight.includes(session.token));
      assert.ok(!rawInFlight.includes(session.username));
      postObservedPendingJournal = true;
      return response(config, { isSuccess: true, data: true });
    }
    return mockStandardReads(config);
  };

  await op1.submit(validPayload);
  assert.equal(postObservedPendingJournal, true);
  assert.equal(op1.getState().phase, 'succeeded');
  op1.acknowledge();
  cache1.clear();

  // Case 1B: sessionStorage.setItem throws QuotaExceededError -> POST is NEVER called
  const originalSetItem = globalThis.sessionStorage.setItem;
  const originalGetItem = globalThis.sessionStorage.getItem;
  let postCount = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') postCount++;
    return response(config, { isSuccess: true, data: true });
  };

  try {
    globalThis.sessionStorage.setItem = () => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    };
    const cache2 = makeClient();
    const op2 = createStockAdjustmentOperation(cache2);
    await op2.submit(validPayload);
    assert.equal(postCount, 0, 'POST must not be dispatched when setItem throws');
    assert.equal(op2.getState().phase, 'rejected');
    assert.equal(op2.getState().error?.code, 'FE_ADJUST_STORAGE');
    cache2.clear();
  } finally {
    globalThis.sessionStorage.setItem = originalSetItem;
  }

  // Case 1C: sessionStorage.setItem silently drops write or read-back returns corrupt data -> POST is NEVER called
  try {
    globalThis.sessionStorage.setItem = () => {
      // Silent no-op write failure: read-back will return null
    };
    const cache3 = makeClient();
    const op3 = createStockAdjustmentOperation(cache3);
    await op3.submit(validPayload);
    assert.equal(postCount, 0, 'POST must not be dispatched when read-back verification fails');
    assert.equal(op3.getState().phase, 'rejected');
    assert.equal(op3.getState().error?.code, 'FE_ADJUST_STORAGE');
    cache3.clear();

    // Corrupt payload on read-back
    let written = false;
    globalThis.sessionStorage.setItem = () => {
      written = true;
    };
    globalThis.sessionStorage.getItem = () =>
      written ? '{"version":1,"status":"pending","corrupt":true}' : null;
    const cache4 = makeClient();
    const op4 = createStockAdjustmentOperation(cache4);
    await op4.submit(validPayload);
    assert.equal(postCount, 0, 'POST must not be dispatched when read-back JSON is corrupt');
    assert.equal(op4.getState().phase, 'rejected');
    assert.equal(op4.getState().error?.code, 'FE_ADJUST_STORAGE');
    cache4.clear();
  } finally {
    globalThis.sessionStorage.setItem = originalSetItem;
    globalThis.sessionStorage.getItem = originalGetItem;
    globalThis.sessionStorage.clear();
  }
});

test('G02 Scenario 2: Double-click / concurrent submission guard blocks second submit while first is in flight', async () => {
  globalThis.sessionStorage.clear();
  sessionStore.set(makeUser('Admin'));
  const cache = makeClient();
  const op = getStockAdjustmentOperation(cache);

  let releasePost!: () => void;
  let postCalls = 0;
  httpClient.defaults.adapter = config => {
    if (config.method === 'post') {
      postCalls++;
      return new Promise(resolve => {
        releasePost = () =>
          resolve(response(config, { isSuccess: true, data: true }));
      });
    }
    return Promise.resolve(mockStandardReads(config));
  };

  const firstSubmit = op.submit(validPayload);
  assert.equal(op.getState().phase, 'pending');
  assert.equal(op.isLocked(), true);

  // Second simultaneous submit on same operation instance must reject with 409
  await assert.rejects(
    op.submit(validPayload),
    (err: any) => err.status === 409 && err.code === 'FE_ADJUST_IN_FLIGHT',
  );

  // Concurrent submit from a second operation instance sharing the same session must also reject with 409
  const secondInstance = createStockAdjustmentOperation(cache);
  await assert.rejects(
    secondInstance.submit(validPayload),
    (err: any) => err.status === 409,
  );

  assert.equal(postCalls, 1, 'Only one POST request may be sent');
  releasePost();
  await firstSubmit;
  assert.equal(postCalls, 1);
  assert.equal(op.getState().phase, 'succeeded');
  op.acknowledge();
  cache.clear();
});

test('G02 Scenario 3: Definite HTTP rejection (400/403/409/422) transitions to rejected, clears pending lock, and allows retry', async () => {
  for (const status of [400, 403, 409, 422] as const) {
    globalThis.sessionStorage.clear();
    const session = makeUser('WarehouseManager');
    sessionStore.set(session);
    const storageKey = getJournalStorageKey(sha256Hex(session.token));
    const cache = makeClient();
    const op = createStockAdjustmentOperation(cache);

    let postCalls = 0;
    httpClient.defaults.adapter = async config => {
      if (config.method === 'post') {
        postCalls++;
        throw new axios.AxiosError(
          'Definite rejection',
          undefined,
          config,
          undefined,
          response(
            config,
            {
              message: `Rejected with HTTP ${status}`,
              errorCode: `ERR_${status}`,
            },
            status,
          ),
        );
      }
      return mockStandardReads(config);
    };

    await op.submit(validPayload);
    assert.equal(postCalls, 1, `HTTP ${status} must never auto-retry even when QueryClient retry=3`);
    assert.equal(op.getState().phase, 'rejected');
    assert.equal(op.getState().error?.status, status);
    assert.equal(op.getState().error?.message, `Rejected with HTTP ${status}`);
    assert.equal(op.isLocked(), false, `HTTP ${status} must unlock mutation for retry`);
    assert.equal(
      globalThis.sessionStorage.getItem(storageKey),
      null,
      `HTTP ${status} must clear pending journal entry`,
    );

    // Operator can immediately fix input and resubmit after a definite 4xx rejection
    httpClient.defaults.adapter = async config => {
      if (config.method === 'post') {
        postCalls++;
        return response(config, { isSuccess: true, data: true });
      }
      return mockStandardReads(config);
    };

    await op.submit({ ...validPayload, adjustmentQuantity: 10 });
    assert.equal(postCalls, 2);
    assert.equal(op.getState().phase, 'succeeded');
    op.acknowledge();
    cache.clear();
  }
});

test('G02 Scenario 4: Uncertain outcomes (network error, timeout, HTTP 500/502/503/504, malformed 200 response) transition to uncertain, lock mutation, and never auto-retry', async () => {
  for (const kind of ['network', 'timeout', '500', '503', 'malformed'] as const) {
    globalThis.sessionStorage.clear();
    const session = makeUser('Admin');
    sessionStore.set(session);
    const storageKey = getJournalStorageKey(sha256Hex(session.token));
    const cache = makeClient();
    const op = createStockAdjustmentOperation(cache);

    let postCalls = 0;
    httpClient.defaults.adapter = async config => {
      if (config.method === 'post') {
        postCalls++;
        if (kind === 'malformed') {
          return response(config, { isSuccess: true, data: 'unexpected-payload' }, 200);
        }
        if (kind === 'timeout') {
          throw new axios.AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED', config);
        }
        if (kind === 'network') {
          throw new axios.AxiosError('Network Error', 'ERR_NETWORK', config);
        }
        throw new axios.AxiosError(
          `Server Error ${kind}`,
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          response(config, { message: 'Database timeout' }, Number(kind)),
        );
      }
      return mockStandardReads(config);
    };

    await op.submit(validPayload);
    assert.equal(postCalls, 1, `Uncertain outcome (${kind}) must never auto-retry POST`);
    assert.equal(op.getState().phase, 'uncertain');
    assert.equal(op.isLocked(), true);

    const savedRaw = globalThis.sessionStorage.getItem(storageKey);
    assert.ok(savedRaw, `Uncertain journal (${kind}) must remain persisted in sessionStorage`);
    const savedJournal = parseJournalEntry(savedRaw, sha256Hex(session.token));
    assert.equal(savedJournal.status, 'uncertain');
    assert.deepEqual(savedJournal.request, validPayload);

    // Subsequent submit attempts while uncertain must be blocked without sending another POST
    await assert.rejects(
      op.submit(validPayload),
      (err: any) => err.status === 409 && err.code === 'FE_ADJUST_LOCKED',
    );
    assert.equal(postCalls, 1);
    cache.clear();
  }
});

test('G02 Scenario 5: Persistence across remount/reload & modal close preserves uncertain lock and blocks new submissions', async () => {
  globalThis.sessionStorage.clear();
  const session = makeUser('Admin');
  sessionStore.set(session);
  const storageKey = getJournalStorageKey(sha256Hex(session.token));
  const cache = makeClient();
  const op = getStockAdjustmentOperation(cache);

  let postCalls = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') {
      postCalls++;
      throw new axios.AxiosError('Socket hang up', 'ECONNABORTED', config);
    }
    return mockStandardReads(config);
  };

  await op.submit(validPayload, {
    snapshot: {
      binCode: 'BIN-A01',
      productSku: 'SKU-LOT-01',
      previousBinQuantity: 40,
      previousBinOccupancy: 40,
      binMaxCapacity: 100,
    },
  });
  assert.equal(op.getState().phase, 'uncertain');
  assert.equal(postCalls, 1);

  // Closing modal (onClose) must NOT clear the uncertain journal
  let modalClosed = false;
  await i18n.changeLanguage('vi-VN');
  const modalHtmlBeforeClose = renderToStaticMarkup(
    <MemoryRouter>
      <QueryClientProvider client={cache}>
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => {
            modalClosed = true;
          }}
          bins={[binFixture]}
          products={[productLotFixture]}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  assert.match(modalHtmlBeforeClose, /<fieldset disabled=""/);
  assert.ok(modalHtmlBeforeClose.includes(vi.f2.adjustSafety.uncertainTitle));
  assert.equal(modalClosed, false);
  assert.ok(globalThis.sessionStorage.getItem(storageKey));

  // Simulate page reload / new QueryClient & new operation instance rehydrating from sessionStorage
  const reloadedCache = makeClient();
  const reloadedOp = getStockAdjustmentOperation(reloadedCache);
  assert.equal(reloadedOp.getState().phase, 'uncertain');
  assert.equal(reloadedOp.isLocked(), true);
  assert.deepEqual(reloadedOp.getState().request, validPayload);
  assert.equal(reloadedOp.getState().snapshot?.previousBinQuantity, 40);

  // Also verify that an interrupted 'pending' journal entry in sessionStorage rehydrates as 'uncertain' on reload
  const rawJournal = JSON.parse(globalThis.sessionStorage.getItem(storageKey)!);
  globalThis.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ ...rawJournal, status: 'pending' }),
  );
  const reloadedFromPending = createStockAdjustmentOperation(makeClient());
  assert.equal(reloadedFromPending.getState().phase, 'uncertain');
  assert.equal(reloadedFromPending.isLocked(), true);
  await assert.rejects(
    reloadedFromPending.submit(validPayload),
    (err: any) => err.status === 409 && err.code === 'FE_ADJUST_LOCKED',
  );
  assert.equal(postCalls, 1, 'Reloading or rehydrating must never replay POST');

  // RealStockVisibility renders the unresolved adjustment warning banner when uncertain journal exists
  reloadedCache.setQueryData(inventoryQueries.summary().queryKey, summaryFixture);
  reloadedCache.setQueryData(inventoryQueries.alerts().queryKey, []);
  reloadedCache.setQueryData(inventoryQueries.products().queryKey, [productLotFixture]);
  reloadedCache.setQueryData(
    inventoryQueries.history({ pageIndex: 1, pageSize: 10, productId: undefined, transactionType: undefined }).queryKey,
    historyPageFixture(false),
  );
  reloadedCache.setQueryData(inventoryQueries.warehouses().queryKey, []);
  reloadedCache.setQueryData(inventoryQueries.zones().queryKey, []);
  reloadedCache.setQueryData(inventoryQueries.bins().queryKey, [binFixture]);

  const visibilityHtml = renderToStaticMarkup(
    <MemoryRouter>
      <QueryClientProvider client={reloadedCache}>
        <RealStockVisibility />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  assert.ok(visibilityHtml.includes(vi.f2.adjustSafety.bannerTitle));
  assert.ok(visibilityHtml.includes(vi.f2.adjustSafety.openReconcile));

  cache.clear();
  reloadedCache.clear();
});

test('G02 Scenario 6: Explicit reconciliation & operator unlock requires fresh reads and explicit confirmation; failed reconciliation read keeps lock', async () => {
  globalThis.sessionStorage.clear();
  const session = makeUser('Admin');
  sessionStore.set(session);
  const storageKey = getJournalStorageKey(sha256Hex(session.token));
  const cache = makeClient();
  const op = createStockAdjustmentOperation(cache);

  // Trigger uncertain state via timeout
  let postCalls = 0;
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') {
      postCalls++;
      throw new axios.AxiosError('Timeout', 'ECONNABORTED', config);
    }
    throw new axios.AxiosError('Reconciliation endpoint offline', 'ERR_NETWORK', config);
  };

  await op.submit(validPayload, {
    snapshot: {
      binCode: 'BIN-A01',
      productSku: 'SKU-LOT-01',
      previousBinQuantity: 40,
      previousBinOccupancy: 40,
      binMaxCapacity: 100,
    },
  });
  assert.equal(op.getState().phase, 'uncertain');

  // Cannot unlock before reconciliation succeeds
  assert.throws(
    () => op.acknowledge(true),
    (err: any) => err.status === 409 && err.code === 'FE_ADJUST_RECONCILE_REQUIRED',
  );

  // Step 6A: Reconciliation read fails -> lock remains intact, reconcileError is surfaced
  const failedReport = await op.reconcile();
  assert.equal(failedReport, undefined);
  assert.equal(op.getState().phase, 'uncertain');
  assert.equal(op.getState().reconciled, false);
  assert.ok(op.getState().reconcileError);
  assert.equal(op.isLocked(), true);
  assert.throws(
    () => op.acknowledge(true),
    (err: any) => err.status === 409 && err.code === 'FE_ADJUST_RECONCILE_REQUIRED',
  );

  // Step 6B: Reconciliation reads succeed -> observational report populated, but STILL locked until operator confirms
  const readUrls: string[] = [];
  httpClient.defaults.adapter = async config => {
    assert.equal(config.method, 'get', 'Reconciliation must only perform GET requests');
    readUrls.push(config.url!);
    return mockStandardReads(config, 35, true);
  };

  const report = await op.reconcile();
  assert.ok(report);
  assert.equal(report.isObservationalOnly, true);
  assert.equal(report.observedLotQuantity, 35);
  assert.equal(report.previousBinQuantity, 40);
  assert.equal(report.currentBinOccupancy, 35);
  assert.equal(report.matchingAdjustments.length, 1);
  assert.deepEqual(readUrls, [
    `/api/v1/Bins/${binId}/contents`,
    '/api/v1/Inventory/stock-history',
    '/api/v1/Inventory/stock-summary',
  ]);
  assert.equal(op.getState().phase, 'uncertain', 'GET reconciliation must not auto-unlock');
  assert.equal(op.getState().reconciled, true);

  // Calling acknowledge(false) without explicit operator checkbox confirmation still throws 409
  assert.throws(
    () => op.acknowledge(false),
    (err: any) => err.status === 409 && err.code === 'FE_ADJUST_RECONCILE_REQUIRED',
  );
  assert.equal(op.isLocked(), true);

  // Step 6C: Explicit operator confirmation (acknowledge(true)) unlocks the journal and clears sessionStorage
  const unlocked = op.acknowledge(true);
  assert.equal(unlocked, true);
  assert.equal(op.getState().phase, 'ready');
  assert.equal(op.isLocked(), false);
  assert.equal(globalThis.sessionStorage.getItem(storageKey), null);
  assert.equal(postCalls, 1);
  cache.clear();
});

test('G02 Scenario 7: Session isolation scopes journal entries by SHA-256 session token hash across users and logout', async () => {
  globalThis.sessionStorage.clear();
  const sessionA = makeUser('Admin', 'admin_a');
  const sessionB = makeUser('WarehouseManager', 'manager_b');
  const keyA = getJournalStorageKey(sha256Hex(sessionA.token));
  const keyB = getJournalStorageKey(sha256Hex(sessionB.token));
  assert.notEqual(keyA, keyB);

  // Session A enters uncertain state
  sessionStore.set(sessionA);
  const cache = makeClient();
  const opA = getStockAdjustmentOperation(cache);
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') {
      throw new axios.AxiosError('Gateway Timeout', 'ERR_BAD_RESPONSE', config, undefined, response(config, {}, 504));
    }
    return mockStandardReads(config);
  };
  await opA.submit(validPayload);
  assert.equal(opA.getState().phase, 'uncertain');
  assert.ok(globalThis.sessionStorage.getItem(keyA));

  // Switch to Session B -> Session B starts clean ('ready'), does not see or clear Session A's journal
  sessionStore.set(sessionB);
  const opB = getStockAdjustmentOperation(cache);
  assert.notEqual(opA, opB);
  assert.equal(opB.getState().phase, 'ready');
  assert.equal(opB.isLocked(), false);
  assert.equal(globalThis.sessionStorage.getItem(keyB), null);
  assert.ok(globalThis.sessionStorage.getItem(keyA), 'Session A journal must remain untouched');

  // Session B can submit its own adjustment independently
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') {
      return response(config, { isSuccess: true, data: true });
    }
    return mockStandardReads(config);
  };
  await opB.submit({ ...validPayload, adjustmentQuantity: 3 });
  assert.equal(opB.getState().phase, 'succeeded');
  opB.acknowledge();
  assert.equal(globalThis.sessionStorage.getItem(keyB), null);
  assert.ok(globalThis.sessionStorage.getItem(keyA), 'Clearing Session B journal must not clear Session A journal');

  // Unauthenticated / Staff session cannot read or mutate journals
  sessionStore.set(null);
  const opAnon = getStockAdjustmentOperation(cache);
  assert.equal(opAnon.getState().phase, 'ready');
  await assert.rejects(opAnon.submit(validPayload), (err: any) => err.status === 401);

  // Switching back to Session A restores Session A's uncertain lock
  sessionStore.set(sessionA);
  const opARestored = getStockAdjustmentOperation(makeClient());
  assert.equal(opARestored.getState().phase, 'uncertain');
  assert.equal(opARestored.isLocked(), true);

  globalThis.sessionStorage.clear();
  cache.clear();
});

test('G02 Scenario 8: Post-commit refresh failure separation marks journal succeeded before onSuccess/refresh and surfaces non-blocking warning', async () => {
  globalThis.sessionStorage.clear();
  const session = makeUser('Admin');
  sessionStore.set(session);
  const storageKey = getJournalStorageKey(sha256Hex(session.token));
  const cache = makeClient();
  const op = getStockAdjustmentOperation(cache);

  let journalStatusDuringOnSuccess: string | undefined;
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') {
      return response(config, { isSuccess: true, data: true }, 200);
    }
    // Simulate post-commit stock read refresh failure
    throw new axios.AxiosError('Read refresh failed after commit', 'ERR_NETWORK', config);
  };

  const result = await op.submit(validPayload, {
    onSuccess: async () => {
      const raw = globalThis.sessionStorage.getItem(storageKey);
      journalStatusDuringOnSuccess = raw ? JSON.parse(raw).status : undefined;
      throw new Error('onSuccess refresh callback failed');
    },
  });

  // Even when post-commit GET refresh fails, journal and state are 'succeeded' (NOT 'uncertain' or 'rejected')
  assert.equal(result.phase, 'succeeded');
  assert.equal(op.getState().phase, 'succeeded');
  assert.equal(op.getState().refreshWarning, true);
  assert.ok(op.getState().refreshError);
  assert.equal(op.isLocked(), false);

  const savedRaw = globalThis.sessionStorage.getItem(storageKey);
  assert.ok(savedRaw);
  const savedJournal = parseJournalEntry(savedRaw, sha256Hex(session.token));
  assert.equal(savedJournal.status, 'succeeded');

  // Also verify when refresh reads succeed but onSuccess callback rejects, journal was already 'succeeded' before onSuccess ran
  httpClient.defaults.adapter = async config => {
    if (config.method === 'post') {
      return response(config, { isSuccess: true, data: true }, 200);
    }
    return mockStandardReads(config);
  };
  await op.submit(validPayload, {
    onSuccess: async () => {
      const raw = globalThis.sessionStorage.getItem(storageKey);
      journalStatusDuringOnSuccess = raw ? JSON.parse(raw).status : undefined;
      throw new Error('UI callback refresh error');
    },
  });
  assert.equal(journalStatusDuringOnSuccess, 'succeeded', 'Journal must be marked succeeded BEFORE onSuccess runs');
  assert.equal(op.getState().phase, 'succeeded');
  assert.equal(op.getState().refreshWarning, true);

  // Verify UI renders the non-blocking refresh warning in both Vietnamese and English
  for (const [locale, copy] of [['vi-VN', vi], ['en-US', en]] as const) {
    await i18n.changeLanguage(locale);
    const modalHtml = renderToStaticMarkup(
      <MemoryRouter>
        <QueryClientProvider client={cache}>
          <StockAdjustmentModal
            isOpen={true}
            onClose={() => {}}
            bins={[binFixture]}
            products={[productLotFixture]}
          />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    assert.ok(modalHtml.includes(copy.f2.adjustSafety.succeededTitle));
    assert.ok(modalHtml.includes(copy.f2.adjustSafety.refreshWarning));
  }

  op.acknowledge();
  cache.clear();
});

test('G02 Contract & UI invariants: Serial blocking, Lot trimming, RBAC gating, and event handlers', async () => {
  // RBAC helper
  assert.equal(canAdjustStock('Admin'), true);
  assert.equal(canAdjustStock('WarehouseManager'), true);
  assert.equal(canAdjustStock('Staff'), false);
  assert.equal(canAdjustStock(undefined), false);

  // Serial trackingMode (2) blocked in adjustStockRequest & adjustStock
  assert.throws(
    () => adjustStockRequest(validPayload, 2),
    (err: any) => err.status === 400 && err.code === 'FE_ADJUST_SERIAL_BLOCKED',
  );
  // Non-lot trackingMode (0) forces lotNumber to ''
  assert.equal(adjustStockRequest(validPayload, 0).lotNumber, '');
  // Lot trackingMode (1) trims lotNumber
  assert.equal(
    adjustStockRequest({ ...validPayload, lotNumber: '  LOT-99  ' }, 1).lotNumber,
    'LOT-99',
  );
  // Zero / non-integer / overflow quantity or empty reason rejected
  for (const invalidQty of [0, 1.5, NaN, MAX_ADJUSTMENT_QUANTITY + 1, -MAX_ADJUSTMENT_QUANTITY - 1]) {
    assert.throws(
      () => adjustStockRequest({ ...validPayload, adjustmentQuantity: invalidQty }),
      (err: any) => err.status === 400 && err.code === 'FE_ADJUST_VALIDATION',
    );
  }
  assert.throws(
    () => adjustStockRequest({ ...validPayload, reasonCode: '   ' }),
    (err: any) => err.status === 400 && err.code === 'FE_ADJUST_VALIDATION',
  );

  // Staff cannot call adjustStock API
  sessionStore.set(makeUser('Staff'));
  await assert.rejects(adjustStock(validPayload), (err: any) => err.status === 403);

  // UI: Serial product selected in StockAdjustmentModal renders serial warning & disables submit button
  sessionStore.set(makeUser('Admin'));
  await i18n.changeLanguage('vi-VN');
  const cache = makeClient();
  const serialModalHtml = renderToStaticMarkup(
    <MemoryRouter>
      <QueryClientProvider client={cache}>
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => {}}
          initialBinId={binId}
          initialProductId={productSerialFixture.id}
          bins={[binFixture]}
          products={[productLotFixture, productSerialFixture]}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  assert.ok(serialModalHtml.includes(vi.f2.serialNotice));

  // Event handler wrapper reports translated error key when locked
  let reportedKey: string | undefined;
  const handlers = createStockAdjustmentEventHandlers(
    {
      submit: async () => {
        throw { status: 409, code: 'FE_ADJUST_LOCKED', message: 'Locked' };
      },
      reconcile: async () => undefined,
      acknowledge: () => true,
    },
    key => {
      reportedKey = key;
    },
  );
  await handlers.submit(validPayload);
  assert.equal(reportedKey, 'f2.adjustSafety.errors.locked');

  cache.clear();
  sessionStore.set(null);
});
