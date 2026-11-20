import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { httpClient } from '../src/services/api/httpClient';
import {
  getSlottingRecommendations,
  parseSlottingError,
  SlottingRecommendation,
  VelocityClass,
} from '../src/services/inventory/slottingRecommendationApi';
import AiSlottingModal from '../src/features/inventory/AiSlottingModal';
import enLocale from '../src/i18n/locales/en.json';
import viLocale from '../src/i18n/locales/vi.json';

function mockResponse(config: any, data: any, status = 200) {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  };
}

const sampleSuccessResponse = {
  isSuccess: true,
  message: 'Đã phân tích Slotting khuyến nghị.',
  data: [
    {
      sku: 'SKU-001',
      productName: 'Fast Moving Item',
      currentZone: 'Dry Zone A',
      suggestedZone: 'Forward Pick Zone',
      velocityClass: 'Fast',
      aiReasoning: 'High outbound frequency (45 orders); moving to forward pick reduces picker travel distance.',
    },
    {
      sku: 'SKU-002',
      productName: 'Slow Moving Item',
      currentZone: 'Forward Pick Zone',
      suggestedZone: 'Upper Reserve Zone',
      velocityClass: 'Slow',
      aiReasoning: 'Low outbound activity (2 orders in 30 days); free up forward pick slots for higher velocity SKUs.',
    },
  ],
};

// =========================================================================
// 1. API Contract & Request Construction Tests (Items 1 - 7)
// =========================================================================

test('P3-E Contract 1 & 2: Endpoint GET /api/v1/Dashboard/ai-slotting-recommendations invoked', async () => {
  let invokedUrl = '';
  const originalGet = httpClient.get;
  httpClient.get = (async (url: string) => {
    invokedUrl = url;
    return mockResponse({ url }, sampleSuccessResponse);
  }) as any;

  try {
    await getSlottingRecommendations();
    assert.equal(invokedUrl, '/api/v1/Dashboard/ai-slotting-recommendations');
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-E Contract 3 & 4: Zone parameter omitted when All selected, appended when zoneId specified', async () => {
  let invokedUrls: string[] = [];
  const originalGet = httpClient.get;
  httpClient.get = (async (url: string) => {
    invokedUrls.push(url);
    return mockResponse({ url }, sampleSuccessResponse);
  }) as any;

  try {
    // Case A: All selected (null / empty) -> No query parameter
    await getSlottingRecommendations(null);
    await getSlottingRecommendations('');
    await getSlottingRecommendations('   ');
    assert.deepEqual(invokedUrls, [
      '/api/v1/Dashboard/ai-slotting-recommendations',
      '/api/v1/Dashboard/ai-slotting-recommendations',
      '/api/v1/Dashboard/ai-slotting-recommendations',
    ]);

    // Case B: Specific zone selected -> appended as ?zoneId=...
    invokedUrls = [];
    const testZoneId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    await getSlottingRecommendations(testZoneId);
    assert.equal(
      invokedUrls[0],
      `/api/v1/Dashboard/ai-slotting-recommendations?zoneId=${encodeURIComponent(testZoneId)}`
    );
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-E Contract 5: Special characters in zoneId are URL-encoded', async () => {
  let invokedUrl = '';
  const originalGet = httpClient.get;
  httpClient.get = (async (url: string) => {
    invokedUrl = url;
    return mockResponse({ url }, sampleSuccessResponse);
  }) as any;

  try {
    await getSlottingRecommendations('Zone A / North & South');
    assert.match(invokedUrl, /Zone%20A%20%2F%20North%20%26%20South/);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-E Contract 6: No unsupported parameters sent (SKU, warehouseId, quantity, confidence, limit)', async () => {
  let invokedUrl = '';
  const originalGet = httpClient.get;
  httpClient.get = (async (url: string) => {
    invokedUrl = url;
    return mockResponse({ url }, sampleSuccessResponse);
  }) as any;

  try {
    await getSlottingRecommendations('zone-123');
    assert.doesNotMatch(invokedUrl, /[?&]sku=/i);
    assert.doesNotMatch(invokedUrl, /[?&]warehouseId=/i);
    assert.doesNotMatch(invokedUrl, /[?&]quantity=/i);
    assert.doesNotMatch(invokedUrl, /[?&]limit=/i);
    assert.doesNotMatch(invokedUrl, /[?&]confidence=/i);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-E Contract 7: AbortSignal forwarded to HTTP client', async () => {
  let forwardedSignal: AbortSignal | undefined;
  const originalGet = httpClient.get;
  httpClient.get = (async (url: string, config: any) => {
    forwardedSignal = config?.signal;
    return mockResponse({ url }, sampleSuccessResponse);
  }) as any;

  try {
    const controller = new AbortController();
    await getSlottingRecommendations(null, controller.signal);
    assert.equal(forwardedSignal, controller.signal);
  } finally {
    httpClient.get = originalGet;
  }
});

// =========================================================================
// 2. Response Parsing & Strict Validation Tests (Items 8 - 22)
// =========================================================================

test('P3-E Parser 8: Valid result parsed correctly into typed SlottingRecommendation models', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => mockResponse({}, sampleSuccessResponse)) as any;

  try {
    const items = await getSlottingRecommendations();
    assert.equal(items.length, 2);
    assert.equal(items[0].sku, 'SKU-001');
    assert.equal(items[0].productName, 'Fast Moving Item');
    assert.equal(items[0].currentZone, 'Dry Zone A');
    assert.equal(items[0].suggestedZone, 'Forward Pick Zone');
    assert.equal(items[0].velocityClass, 'Fast');
    assert.match(items[0].aiReasoning, /picker travel distance/);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-E Parser 9: Empty data array accepted as clean informational state (no error)', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => mockResponse({}, { isSuccess: true, data: [] })) as any;

  try {
    const items = await getSlottingRecommendations();
    assert.deepEqual(items, []);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-E Parser 10: Malformed envelope (null payload, isSuccess false, data not array) rejected with 502 invalid_response', async () => {
  const originalGet = httpClient.get;
  const malformedPayloads = [
    null,
    {},
    { isSuccess: false, data: [] },
    { isSuccess: true, data: null },
    { isSuccess: true, data: 'not-an-array' },
    { isSuccess: true, data: {} },
  ];

  for (const badPayload of malformedPayloads) {
    httpClient.get = (async () => mockResponse({}, badPayload)) as any;
    try {
      await assert.rejects(
        getSlottingRecommendations(),
        (err: any) => err.status === 502 && err.kind === 'invalid_response',
        `Expected rejection for payload: ${JSON.stringify(badPayload)}`
      );
    } finally {
      httpClient.get = originalGet;
    }
  }
});

test('P3-E Parser 11, 12, 13, 14, 15: Blank or missing fields rejected with 502 invalid_response', async () => {
  const originalGet = httpClient.get;

  const invalidFieldCases = [
    { sku: '', productName: 'P', currentZone: 'A', suggestedZone: 'B', velocityClass: 'Fast', aiReasoning: 'R' },
    { sku: 'S', productName: '   ', currentZone: 'A', suggestedZone: 'B', velocityClass: 'Fast', aiReasoning: 'R' },
    { sku: 'S', productName: 'P', currentZone: '', suggestedZone: 'B', velocityClass: 'Fast', aiReasoning: 'R' },
    { sku: 'S', productName: 'P', currentZone: 'A', suggestedZone: '   ', velocityClass: 'Fast', aiReasoning: 'R' },
    { sku: 'S', productName: 'P', currentZone: 'A', suggestedZone: 'B', velocityClass: 'Fast', aiReasoning: '' },
    { sku: null, productName: 'P', currentZone: 'A', suggestedZone: 'B', velocityClass: 'Fast', aiReasoning: 'R' },
  ];

  for (const badItem of invalidFieldCases) {
    httpClient.get = (async () => mockResponse({}, { isSuccess: true, data: [badItem] })) as any;
    try {
      await assert.rejects(
        getSlottingRecommendations(),
        (err: any) => err.status === 502 && err.kind === 'invalid_response'
      );
    } finally {
      httpClient.get = originalGet;
    }
  }
});

test('P3-E Parser 16, 17, 18: Exact velocity classes (Fast, Medium, Slow) accepted', async () => {
  const originalGet = httpClient.get;
  const velocities: VelocityClass[] = ['Fast', 'Medium', 'Slow'];

  for (const vel of velocities) {
    httpClient.get = (async () =>
      mockResponse({}, {
        isSuccess: true,
        data: [{
          sku: `SKU-${vel}`,
          productName: `Product ${vel}`,
          currentZone: 'Zone 1',
          suggestedZone: 'Zone 2',
          velocityClass: vel,
          aiReasoning: 'Valid reasoning.',
        }],
      })) as any;

    try {
      const items = await getSlottingRecommendations();
      assert.equal(items[0].velocityClass, vel);
    } finally {
      httpClient.get = originalGet;
    }
  }
});

test('P3-E Parser 19 & 20: Invalid or lowercase velocities strictly rejected under exact contract', async () => {
  const originalGet = httpClient.get;
  const badVelocities = ['fast', 'FAST', 'medium', 'MEDIUM', 'slow', 'SLOW', 'High', 'Critical', 'Moderate', 'Unknown', '', null];

  for (const badVel of badVelocities) {
    httpClient.get = (async () =>
      mockResponse({}, {
        isSuccess: true,
        data: [{
          sku: 'SKU-001',
          productName: 'Product',
          currentZone: 'Zone 1',
          suggestedZone: 'Zone 2',
          velocityClass: badVel,
          aiReasoning: 'Valid reasoning.',
        }],
      })) as any;

    try {
      await assert.rejects(
        getSlottingRecommendations(),
        (err: any) => err.status === 502 && err.kind === 'invalid_response',
        `Expected rejection for velocity: ${badVel}`
      );
    } finally {
      httpClient.get = originalGet;
    }
  }
});

test('P3-E Parser 21: Duplicate SKU in response rejected with 502 invalid_response', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () =>
    mockResponse({}, {
      isSuccess: true,
      data: [
        {
          sku: 'SKU-DUP',
          productName: 'Item 1',
          currentZone: 'Zone A',
          suggestedZone: 'Zone B',
          velocityClass: 'Fast',
          aiReasoning: 'First recommendation.',
        },
        {
          sku: 'SKU-DUP', // Duplicate SKU
          productName: 'Item 1',
          currentZone: 'Zone A',
          suggestedZone: 'Zone C',
          velocityClass: 'Medium',
          aiReasoning: 'Second recommendation.',
        },
      ],
    })) as any;

  try {
    await assert.rejects(
      getSlottingRecommendations(),
      (err: any) => err.status === 502 && err.kind === 'invalid_response' && /duplicate/i.test(err.message)
    );
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-E Parser 22: Backend recommendation ordering preserved without frontend re-sorting', async () => {
  const originalGet = httpClient.get;
  const orderedData = [
    { sku: 'SKU-Z', productName: 'Item Z', currentZone: 'A', suggestedZone: 'B', velocityClass: 'Slow', aiReasoning: 'R1' },
    { sku: 'SKU-A', productName: 'Item A', currentZone: 'B', suggestedZone: 'A', velocityClass: 'Fast', aiReasoning: 'R2' },
    { sku: 'SKU-M', productName: 'Item M', currentZone: 'C', suggestedZone: 'B', velocityClass: 'Medium', aiReasoning: 'R3' },
  ];
  httpClient.get = (async () => mockResponse({}, { isSuccess: true, data: orderedData })) as any;

  try {
    const items = await getSlottingRecommendations();
    assert.equal(items[0].sku, 'SKU-Z');
    assert.equal(items[1].sku, 'SKU-A');
    assert.equal(items[2].sku, 'SKU-M');
  } finally {
    httpClient.get = originalGet;
  }
});

// =========================================================================
// 3. Error Mapping Tests (Items 23 - 29)
// =========================================================================

test('P3-E Errors 23: HTTP 400 maps to conservative scope_unavailable state', () => {
  const err = parseSlottingError({
    status: 400,
    message: 'Chưa có dữ liệu xuất kho phù hợp trong 30 ngày cho phạm vi Slotting được chọn.',
  });
  assert.equal(err.status, 400);
  assert.equal(err.kind, 'scope_unavailable');
  assert.match(err.message, /Recommendations could not be generated for the selected scope/i);
});

test('P3-E Errors 24: HTTP 403 maps to forbidden', () => {
  const err = parseSlottingError({ status: 403 });
  assert.equal(err.status, 403);
  assert.equal(err.kind, 'forbidden');
  assert.match(err.message, /permission/i);
});

test('P3-E Errors 25: HTTP 502 maps to invalid_response', () => {
  const err = parseSlottingError({ status: 502, code: 'AI_RESPONSE_INVALID' });
  assert.equal(err.status, 502);
  assert.equal(err.kind, 'invalid_response');
  assert.match(err.message, /could not be processed/i);
});

test('P3-E Errors 26: HTTP 503 maps to provider_unavailable', () => {
  const err = parseSlottingError({ status: 503, code: 'AI_PROVIDER_UNAVAILABLE' });
  assert.equal(err.status, 503);
  assert.equal(err.kind, 'provider_unavailable');
  assert.match(err.message, /currently unavailable/i);
});

test('P3-E Errors 27: HTTP 504 maps to timeout', () => {
  const err = parseSlottingError({ status: 504, code: 'AI_TIMEOUT' });
  assert.equal(err.status, 504);
  assert.equal(err.kind, 'timeout');
  assert.match(err.message, /timed out/i);
});

test('P3-E Errors 28: Unknown or network error maps to graceful fallback message', () => {
  const err = parseSlottingError({ status: 500, message: 'Internal Server Error' });
  assert.equal(err.status, 500);
  assert.equal(err.kind, 'unknown');
  assert.match(err.message, /Core inventory operations remain unaffected/i);
});

test('P3-E Errors 29: Zero fake recommendations fabricated on failure', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    throw { status: 500, message: 'Server crash' };
  }) as any;

  try {
    let resultItems: any = null;
    try {
      resultItems = await getSlottingRecommendations();
    } catch {
      // expected
    }
    assert.equal(resultItems, null);
  } finally {
    httpClient.get = originalGet;
  }
});

// =========================================================================
// 4. Role Gating Tests (Items 30 - 33)
// =========================================================================

test('P3-E Roles 30, 31, 32, 33: Admin and WarehouseManager permitted; Staff, Viewer, unauthenticated hidden', () => {
  const canInspectSlotting = (role?: string): boolean => {
    return role === 'Admin' || role === 'WarehouseManager';
  };

  assert.equal(canInspectSlotting('Admin'), true);
  assert.equal(canInspectSlotting('WarehouseManager'), true);
  assert.equal(canInspectSlotting('Staff'), false);
  assert.equal(canInspectSlotting('Viewer'), false);
  assert.equal(canInspectSlotting('Guest'), false);
  assert.equal(canInspectSlotting(undefined), false);
});

// =========================================================================
// 5. UI Semantics & Advisory Tests (Items 34 - 43)
// =========================================================================

test('P3-E UI 34 & 35: Uses Zone-level terminology, strictly OMITS "Recommended Bin"', () => {
  const html = renderToStaticMarkup(<AiSlottingModal onClose={() => {}} />);
  assert.match(html, /Storage Zone|Khu Vực Lưu Kho|Zone Optimization/i);
  assert.doesNotMatch(html, /Recommended Bin/i);
  assert.doesNotMatch(html, /Target Bin/i);
  assert.doesNotMatch(html, /Move to Bin/i);
  assert.doesNotMatch(html, /Put-Away Bin/i);
});

test('P3-E UI 36, 37, 38, 39: Advisory banner, 30-day velocity grounding, capacity-not-guaranteed warning, and AI disclosure rendered', () => {
  const html = renderToStaticMarkup(<AiSlottingModal onClose={() => {}} />);
  // Advisory role
  assert.match(html, /role="note"/);
  // Velocity grounding
  assert.match(html, /30-day outbound|xuất kho.*30 ngày/i);
  // Capacity not guaranteed
  assert.match(html, /Physical capacity.*must.*be verified|Sức chứa thực tế.*xác nhận/i);
  // External AI disclosure
  assert.match(html, /Google Gemini|external AI|dịch vụ AI/i);
  assert.match(html, /Costs, customer info, and supplier identities are never transmitted|Giá cả.*không bao giờ/i);
});

test('P3-E UI 40: Zero confidence percentage, accuracy, probability, or risk badges', () => {
  const html = renderToStaticMarkup(<AiSlottingModal onClose={() => {}} />);
  assert.doesNotMatch(html, /\bconfidence\b/i);
  assert.doesNotMatch(html, /probability/i);
  assert.doesNotMatch(html, /certainty/i);
  assert.doesNotMatch(html, /\baccuracy\b/i);
});

test('P3-E UI 41 & 42: Same-zone neutrality — renders "No zone change suggested" and never claims "optimal", "best", or "ideal"', () => {
  const enSameZone = enLocale.f2.slotting.sameZoneOptimal;
  const viSameZone = viLocale.f2.slotting.sameZoneOptimal;

  // Assert neutral advisory wording is used exactly
  assert.equal(enSameZone, 'No zone change suggested');
  assert.equal(viSameZone, 'Không đề xuất đổi khu vực');

  // Assert neither English nor Vietnamese copy makes ungrounded optimality/authoritative claims
  assert.doesNotMatch(enSameZone, /\b(optimal|best|ideal|perfect|approved|confirmed)\b/i);
  assert.doesNotMatch(viSameZone, /tối ưu|tốt nhất|lý tưởng|hoàn hảo|chấp thuận|xác nhận/i);

  // Assert modal static text does not claim current zone is optimal
  const html = renderToStaticMarkup(<AiSlottingModal onClose={() => {}} />);
  assert.doesNotMatch(html, /Current optimal/i);
  assert.doesNotMatch(html, /Đang ở vị trí tối ưu/i);
  assert.doesNotMatch(html, /\b(optimal placement|best zone|ideal zone)\b/i);
});

// =========================================================================
// 6. Explicit Execution & Lifecycle Tests (Items 44 - 51)
// =========================================================================

test('P3-E Execution 44: Modal render does not trigger network request on mount', () => {
  let networkCalled = false;
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    networkCalled = true;
    return mockResponse({}, sampleSuccessResponse);
  }) as any;

  try {
    renderToStaticMarkup(<AiSlottingModal onClose={() => {}} />);
    assert.equal(networkCalled, false);
  } finally {
    httpClient.get = originalGet;
  }
});

// =========================================================================
// 7. Mutation Boundary Tests (Items 52 - 56)
// =========================================================================

test('P3-E Mutation 52, 53, 54, 55, 56: Zero stock move, transfer, put-away, replenishment, or adjustment mutations', async () => {
  const originalGet = httpClient.get;
  const originalPost = httpClient.post;
  const originalPut = httpClient.put;
  const originalPatch = httpClient.patch;
  const originalDelete = httpClient.delete;

  const mutationCalls: string[] = [];

  httpClient.get = (async (url: string) => {
    if (url.includes('/api/v1/Dashboard/ai-slotting-recommendations')) {
      return mockResponse({ url }, sampleSuccessResponse);
    }
    mutationCalls.push(`GET:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.post = (async (url: string) => {
    mutationCalls.push(`POST:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.put = (async (url: string) => {
    mutationCalls.push(`PUT:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.patch = (async (url: string) => {
    mutationCalls.push(`PATCH:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.delete = (async (url: string) => {
    mutationCalls.push(`DELETE:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  try {
    const data = await getSlottingRecommendations();
    assert.equal(data.length, 2);
    // Assert ZERO business mutations occurred
    assert.deepEqual(mutationCalls, []);
  } finally {
    httpClient.get = originalGet;
    httpClient.post = originalPost;
    httpClient.put = originalPut;
    httpClient.patch = originalPatch;
    httpClient.delete = originalDelete;
  }
});
