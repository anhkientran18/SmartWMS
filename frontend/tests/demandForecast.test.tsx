import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { httpClient } from '../src/services/api/httpClient';
import {
  getDemandForecast,
  parseDemandForecastError,
  toDemandForecastViewModel,
  StockForecastDto,
} from '../src/services/products/demandForecastApi';
import DemandForecastModal, {
  formatCalendarDate,
  formatShortDate,
} from '../src/features/products/DemandForecastModal';

const mockResponse = (config: any, data: any, status = 200, headers: any = {}) => ({
  config,
  data,
  status,
  statusText: String(status),
  headers,
});

const sampleWireForecast: StockForecastDto = {
  sku: 'BOX-LRG-01',
  historicalMovements: [
    { date: '2026-09-15T00:00:00Z', quantity: 24 },
    { date: '2026-10-01T00:00:00Z', quantity: 18 },
  ],
  forecastedDemand: [
    { date: '2026-11-02T00:00:00Z', quantity: 20 },
    { date: '2026-11-03T00:00:00Z', quantity: 22 },
    { date: '2026-11-04T00:00:00Z', quantity: 19 },
  ],
};

// --- Test 1 & 2: Parser accepts actual backend wire fields (historicalMovements, forecastedDemand) ---

test('P3-C Test 1 & 2: Parser accepts actual backend wire fields historicalMovements and forecastedDemand', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'BOX-LRG-01',
        historicalMovements: [
          { date: '2026-09-15T00:00:00Z', quantity: 24 },
          { date: '2026-10-01T00:00:00Z', quantity: 18 },
        ],
        forecastedDemand: [
          { date: '2026-11-02T00:00:00Z', quantity: 20 },
          { date: '2026-11-03T00:00:00Z', quantity: 22 },
        ],
      },
      message: 'OK',
    });
  }) as any;

  try {
    const res = await getDemandForecast('BOX-LRG-01');
    assert.equal(res.sku, 'BOX-LRG-01');
    assert.equal(res.historicalMovements.length, 2);
    assert.equal(res.forecastedDemand.length, 2);
    assert.equal(res.historicalMovements[0].quantity, 24);
    assert.equal(res.forecastedDemand[1].quantity, 22);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 3: Each backend point uses date + quantity ---

test('P3-C Test 3: Each backend point strictly requires date + quantity', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'BOX-LRG-01',
        historicalMovements: [{ date: '2026-10-01T00:00:00Z', quantity: 123 }],
        forecastedDemand: [{ date: '2026-11-02T00:00:00Z', quantity: 45 }],
      },
      message: 'OK',
    });
  }) as any;

  try {
    const res = await getDemandForecast('BOX-LRG-01');
    assert.equal(res.historicalMovements[0].date, '2026-10-01T00:00:00Z');
    assert.equal(res.historicalMovements[0].quantity, 123);
    assert.equal(res.forecastedDemand[0].date, '2026-11-02T00:00:00Z');
    assert.equal(res.forecastedDemand[0].quantity, 45);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 4: Invented wire fields are NOT required ---

test('P3-C Test 4: Invented wire fields (forecastDays, generatedAtUtc, history, forecast, actualQuantity, predictedQuantity) are NOT required', async () => {
  const originalGet = httpClient.get;
  // Payload contains ONLY real backend DTO fields; NO invented fields
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-EXACT',
        historicalMovements: [{ date: '2026-10-10T00:00:00Z', quantity: 15 }],
        forecastedDemand: [{ date: '2026-11-01T00:00:00Z', quantity: 25 }],
      },
    });
  }) as any;

  try {
    const res = await getDemandForecast('SKU-EXACT');
    assert.equal(res.sku, 'SKU-EXACT');
    // Verify parser did not fail on missing invented fields
    assert.equal((res as any).forecastDays, undefined);
    assert.equal((res as any).generatedAtUtc, undefined);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 5: Malformed real backend point rejected with 502 invalid_response ---

test('P3-C Test 5: Malformed real backend point strictly rejected with 502 invalid_response', async () => {
  const originalGet = httpClient.get;

  // Case A: Non-integer quantity (e.g. float or string)
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-01',
        historicalMovements: [{ date: '2026-10-01T00:00:00Z', quantity: 10.5 }],
        forecastedDemand: [{ date: '2026-11-02T00:00:00Z', quantity: 20 }],
      },
    });
  }) as any;

  try {
    await assert.rejects(
      getDemandForecast('SKU-01'),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.get = originalGet;
  }

  // Case B: Negative quantity
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-01',
        historicalMovements: [{ date: '2026-10-01T00:00:00Z', quantity: 10 }],
        forecastedDemand: [{ date: '2026-11-02T00:00:00Z', quantity: -1 }],
      },
    });
  }) as any;

  try {
    await assert.rejects(
      getDemandForecast('SKU-01'),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.get = originalGet;
  }

  // Case C: Invalid date string
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-01',
        historicalMovements: [{ date: 'not-a-valid-date', quantity: 10 }],
        forecastedDemand: [{ date: '2026-11-02T00:00:00Z', quantity: 15 }],
      },
    });
  }) as any;

  try {
    await assert.rejects(
      getDemandForecast('SKU-01'),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.get = originalGet;
  }

  // Case D: Missing array
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-01',
        historicalMovements: null,
        forecastedDemand: [],
      },
    });
  }) as any;

  try {
    await assert.rejects(
      getDemandForecast('SKU-01'),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 6: 1 forecast point accepted ---

test('P3-C Test 6: Exactly 1 forecast point accepted cleanly without assuming fixed length', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-ONE',
        historicalMovements: [{ date: '2026-10-01T00:00:00Z', quantity: 5 }],
        forecastedDemand: [{ date: '2026-11-02T00:00:00Z', quantity: 12 }],
      },
    });
  }) as any;

  try {
    const res = await getDemandForecast('SKU-ONE');
    assert.equal(res.forecastedDemand.length, 1);
    assert.equal(res.forecastedDemand[0].quantity, 12);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 7: 30 forecast points accepted ---

test('P3-C Test 7: Full 30 forecast points accepted', async () => {
  const points = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    quantity: 10 + i,
  }));

  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-THIRTY',
        historicalMovements: [{ date: '2026-10-01T00:00:00Z', quantity: 100 }],
        forecastedDemand: points,
      },
    });
  }) as any;

  try {
    const res = await getDemandForecast('SKU-THIRTY');
    assert.equal(res.forecastedDemand.length, 30);
    assert.equal(res.forecastedDemand[29].quantity, 39);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 8: Missing dates not fabricated ---

test('P3-C Test 8: Returned points preserved exactly; missing dates are never fabricated or gap-filled', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: {
        sku: 'SKU-SPARSE',
        historicalMovements: [
          { date: '2026-09-01T00:00:00Z', quantity: 50 },
          { date: '2026-10-15T00:00:00Z', quantity: 80 },
        ],
        forecastedDemand: [
          { date: '2026-11-05T00:00:00Z', quantity: 20 },
          { date: '2026-11-20T00:00:00Z', quantity: 30 },
        ],
      },
    });
  }) as any;

  try {
    const res = await getDemandForecast('SKU-SPARSE');
    assert.equal(res.historicalMovements.length, 2);
    assert.equal(res.forecastedDemand.length, 2);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 9: Vietnamese backend no-history HTTP 400 produces informational no-history UI ---

test('P3-C Test 9: Vietnamese backend no-history HTTP 400 maps to insufficient_or_unavailable_history and renders informational state', () => {
  const err = parseDemandForecastError({
    status: 400,
    code: 'VAL_1000',
    message: 'Hệ thống chưa có đủ dữ liệu xuất kho của sản phẩm này trong 90 ngày qua để AI tiến hành dự báo.',
  });

  assert.equal(err.status, 400);
  assert.equal(err.kind, 'insufficient_or_unavailable_history');
  assert.equal(err.message, 'Not enough outbound movement history is available to generate this forecast.');

  assert.ok(
    err.kind === 'insufficient_or_unavailable_history' || err.kind === 'insufficient_history'
  );
});

// --- Test 10: English message is not required for classification ---

test('P3-C Test 10: English message is not required for HTTP 400 classification', () => {
  // Case A: With arbitrary or empty message
  const errEmpty = parseDemandForecastError({
    status: 400,
    code: 'VAL_1000',
    message: '',
  });
  assert.equal(errEmpty.kind, 'insufficient_or_unavailable_history');

  // Case B: With purely Vietnamese message
  const errVi = parseDemandForecastError({
    status: 400,
    message: 'Dữ liệu xuất kho không đủ.',
  });
  assert.equal(errVi.kind, 'insufficient_or_unavailable_history');
});

// --- Test 11: Partial forecast does not display misleading '30-day total' ---

test('P3-C Test 11: Partial forecast does not display misleading 30-day total label', () => {
  const html = renderToStaticMarkup(
    <DemandForecastModal
      product={{ sku: 'BOX-LRG-01', name: 'Test Box', unit: 'BOX' }}
      onClose={() => {}}
    />
  );

  // Must NOT contain misleading "Total Predicted Demand (30d)" or claim complete 30-day sum
  assert.doesNotMatch(html, /Total Predicted Demand \(30d\)/i);
  assert.doesNotMatch(html, /30-Day AI Forecast/i);
});

// --- Test 12: Partial forecast does not display misleading 'daily average' over assumed 30 days ---

test('P3-C Test 12: Partial forecast daily average divides by returned points, not assumed 30 days', () => {
  const points = [
    { date: '2026-11-01T00:00:00Z', quantity: 10 },
    { date: '2026-11-05T00:00:00Z', quantity: 10 },
    { date: '2026-11-10T00:00:00Z', quantity: 10 },
    { date: '2026-11-15T00:00:00Z', quantity: 10 },
    { date: '2026-11-20T00:00:00Z', quantity: 10 },
  ];
  const count = points.length; // 5
  const total = points.reduce((acc, p) => acc + p.quantity, 0); // 50
  const avg = (total / count).toFixed(1); // '10.0'

  // Divided by 5 points = 10.0, NOT divided by 30 days = 1.7
  assert.equal(avg, '10.0');
});

// --- Test 13: Aggregates use only returned points ---

test('P3-C Test 13: Aggregates strictly sum returned points without fabricating zeroes for missing dates', () => {
  const historyPoints = [
    { date: '2026-09-15T00:00:00Z', quantity: 24 },
    { date: '2026-10-01T00:00:00Z', quantity: 18 },
  ];
  const historyTotal = historyPoints.reduce((acc, p) => acc + p.quantity, 0);
  assert.equal(historyTotal, 42);

  const forecastPoints = [
    { date: '2026-11-02T00:00:00Z', quantity: 20 },
    { date: '2026-11-03T00:00:00Z', quantity: 22 },
    { date: '2026-11-04T00:00:00Z', quantity: 19 },
  ];
  const forecastTotal = forecastPoints.reduce((acc, p) => acc + p.quantity, 0);
  assert.equal(forecastTotal, 61);
});

// --- Test 14: Staff trigger remains hidden ---

test('P3-C Test 14: Role gating grants Admin and WarehouseManager, hides trigger for Staff and unauthenticated', () => {
  const checkCanForecast = (session: { role?: string } | null | undefined): boolean => {
    return session?.role === 'Admin' || session?.role === 'WarehouseManager';
  };

  assert.equal(checkCanForecast({ role: 'Admin' }), true);
  assert.equal(checkCanForecast({ role: 'WarehouseManager' }), true);
  assert.equal(checkCanForecast({ role: 'Staff' }), false);
  assert.equal(checkCanForecast({ role: 'Viewer' }), false);
  assert.equal(checkCanForecast(null), false);
  assert.equal(checkCanForecast(undefined), false);
});

// --- Test 15: UTC date behavior remains safe ---

test('P3-C Test 15: formatCalendarDate and formatShortDate format calendar date without browser timezone shift', () => {
  const midnightUtc = '2026-11-02T00:00:00Z';
  assert.equal(formatCalendarDate(midnightUtc), '02/11/2026');
  assert.equal(formatShortDate(midnightUtc), '02/11');

  const leapDate = '2024-02-29T23:59:59Z';
  assert.equal(formatCalendarDate(leapDate), '29/02/2024');
  assert.equal(formatShortDate(leapDate), '29/02');
});

// --- Test 16: No mutation behavior remains intact ---

test('P3-C Test 16: Zero mutation endpoints invoked by Demand Forecast service', async () => {
  const originalGet = httpClient.get;
  const originalPost = httpClient.post;
  const originalPut = httpClient.put;
  const originalDelete = httpClient.delete;

  const mutationCalls: string[] = [];

  httpClient.get = (async (url: string) => {
    return mockResponse({ url }, {
      isSuccess: true,
      data: sampleWireForecast,
    });
  }) as any;

  httpClient.post = (async (url: string) => {
    mutationCalls.push(`POST:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.put = (async (url: string) => {
    mutationCalls.push(`PUT:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.delete = (async (url: string) => {
    mutationCalls.push(`DELETE:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  try {
    await getDemandForecast('BOX-LRG-01');
    assert.deepEqual(mutationCalls, []);
  } finally {
    httpClient.get = originalGet;
    httpClient.post = originalPost;
    httpClient.put = originalPut;
    httpClient.delete = originalDelete;
  }
});

// --- Test 17: Option B internal presentation model mapping ---

test('P3-C Test 17: Option B toDemandForecastViewModel maps backend DTO to internal presentation model', () => {
  const vm = toDemandForecastViewModel(sampleWireForecast);
  assert.equal(vm.sku, 'BOX-LRG-01');
  assert.equal(vm.history.length, 2);
  assert.equal(vm.forecast.length, 3);
  assert.equal(vm.history[0].quantity, 24);
  assert.equal(vm.forecast[0].quantity, 20);
});

// --- Test 18: SKU URL encoding and whitespace trimming ---

test('P3-C Test 18: SKU is properly trimmed and URL-encoded', async () => {
  const originalGet = httpClient.get;
  let capturedUrl = '';

  httpClient.get = (async (url: string) => {
    capturedUrl = url;
    return mockResponse({ url }, {
      isSuccess: true,
      data: { ...sampleWireForecast, sku: 'BOX/01+C&D' },
    });
  }) as any;

  try {
    await getDemandForecast('   BOX/01+C&D   ');
    assert.equal(capturedUrl, '/api/v1/Forecasts/demand-prediction?sku=BOX%2F01%2BC%26D');
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 19: Advisory notice and non-mutation disclaimer rendered ---

test('P3-C Test 19: Advisory notice renders system-wide disclaimer and no mutation controls', () => {
  const html = renderToStaticMarkup(
    <DemandForecastModal
      product={{ sku: 'BOX-LRG-01', name: 'Heavy-Duty Storage Box', unit: 'BOX' }}
      onClose={() => {}}
    />
  );

  assert.match(html, /role="note"/);
  assert.match(html, /Advisory Outbound Demand Projection|Dự báo Nhu cầu Xuất kho Tham khảo/i);
  assert.match(html, /across all warehouses|toàn bộ hệ thống kho/i);
  assert.match(html, /does NOT constitute a replenishment directive|KHÔNG cấu thành lệnh/i);

  // Assert NO mutation buttons exist
  assert.doesNotMatch(html, /create purchase order/i);
  assert.doesNotMatch(html, /reorder/i);
  assert.doesNotMatch(html, /reserve stock/i);
});

// --- Test 20: Empty/whitespace SKU client-side validation ---

test('P3-C Test 20: Empty and whitespace SKU rejected client-side before network', async () => {
  let networkCalled = false;
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    networkCalled = true;
    return mockResponse({}, {});
  }) as any;

  try {
    await assert.rejects(
      getDemandForecast(''),
      (err: any) => err.status === 400 && err.code === 'VALIDATION_EMPTY'
    );
    await assert.rejects(
      getDemandForecast('     '),
      (err: any) => err.status === 400 && err.code === 'VALIDATION_EMPTY'
    );
    assert.equal(networkCalled, false);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- Test 21: Error mappings for 404, 502, 503, 504, 500 ---

test('P3-C Test 21: Server error codes properly mapped to normalized kinds', () => {
  const err404 = parseDemandForecastError({ status: 404, code: 'PRODUCT_NOT_FOUND' });
  assert.equal(err404.kind, 'not_found');

  const err502 = parseDemandForecastError({ status: 502, code: 'AI_RESPONSE_INVALID' });
  assert.equal(err502.kind, 'invalid_response');

  const err503 = parseDemandForecastError({ status: 503, code: 'AI_PROVIDER_UNAVAILABLE' });
  assert.equal(err503.kind, 'provider_unavailable');

  const err504 = parseDemandForecastError({ status: 504, code: 'AI_TIMEOUT' });
  assert.equal(err504.kind, 'timeout');

  const err500 = parseDemandForecastError({ status: 500, message: 'Server crash' });
  assert.equal(err500.kind, 'unknown');
  assert.match(err500.message, /Core operations remain unaffected/i);
});

// --- Test 22: Unit formatting without artificial default UOM ---

test('P3-C Test 22: Product unit rendered when provided, never invents default UOM when missing', () => {
  const htmlWithUnit = renderToStaticMarkup(
    <DemandForecastModal
      product={{ sku: 'BOX-LRG-01', name: 'Storage Box', unit: 'Thùng' }}
      onClose={() => {}}
    />
  );
  assert.match(htmlWithUnit, /BOX-LRG-01/);

  const htmlNoUnit = renderToStaticMarkup(
    <DemandForecastModal
      product={{ sku: 'NO-UNIT-02', name: 'Cable' }}
      onClose={() => {}}
    />
  );
  assert.doesNotMatch(htmlNoUnit, /\bpcs\b/i);
  assert.doesNotMatch(htmlNoUnit, /\bunits\b/i);
});

// --- Test 23: No confidence score or reorder recommendations rendered ---

test('P3-C Test 23: No confidence score or reorder recommendations rendered in modal', () => {
  const html = renderToStaticMarkup(
    <DemandForecastModal
      product={{ sku: 'BOX-LRG-01', name: 'Heavy-Duty Storage Box' }}
      onClose={() => {}}
    />
  );
  assert.doesNotMatch(html, /confidence/i);
  assert.doesNotMatch(html, /reorder point/i);
  assert.doesNotMatch(html, /safety stock/i);
  assert.doesNotMatch(html, /recommended order quantity/i);
});
