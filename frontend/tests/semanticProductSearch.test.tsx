import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { httpClient } from '../src/services/api/httpClient';
import {
  searchSemanticProducts,
  parseSemanticSearchError,
  SemanticProductDto,
} from '../src/services/products/semanticProductSearchApi';
import SemanticProductSearchModal, { SemanticSearchResults, semanticSearchErrorKey } from '../src/features/products/SemanticProductSearchModal';
import axios from 'axios';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';

const mockResponse = (config: any, data: any, status = 200, headers: any = {}) => ({
  config,
  data,
  status,
  statusText: String(status),
  headers,
});

const sampleProducts: SemanticProductDto[] = [
  {
    id: 'e28a5840-a359-42b7-a3f2-1a4e4d6d0001',
    sku: 'BOX-LRG-01',
    name: 'Heavy-Duty Storage Box',
    description: 'Double-walled corrugated cardboard storage box for heavy warehouse goods.',
    similarityScore: 88.42,
  },
  {
    id: 'e28a5840-a359-42b7-a3f2-1a4e4d6d0002',
    sku: 'TAPE-WTR-02',
    name: 'Reinforced Waterproof Tape',
    description: 'Moisture-resistant adhesive sealing tape.',
    similarityScore: 76.15,
  },
];

// --- 1 to 8: Endpoint & Query Validation ---

test('P3-B 1 & 2: Endpoint GET /api/v1/Products/semantic-search with query parameter text', async () => {
  const originalGet = httpClient.get;
  let capturedUrl = '';

  httpClient.get = (async (url: string) => {
    capturedUrl = url;
    return mockResponse({ url }, {
      isSuccess: true,
      data: sampleProducts,
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    await searchSemanticProducts('storage boxes');
    assert.match(capturedUrl, /^\/api\/v1\/Products\/semantic-search\?text=/);
    assert.equal(capturedUrl, '/api/v1/Products/semantic-search?text=storage%20boxes');
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 3: Query parameter is properly URL-encoded', async () => {
  const originalGet = httpClient.get;
  let capturedUrl = '';

  httpClient.get = (async (url: string) => {
    capturedUrl = url;
    return mockResponse({ url }, {
      isSuccess: true,
      data: [],
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    await searchSemanticProducts('c++ tape & box #1?');
    assert.equal(
      capturedUrl,
      '/api/v1/Products/semantic-search?text=c%2B%2B%20tape%20%26%20box%20%231%3F'
    );
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 4: Leading and trailing whitespace is trimmed prior to sending', async () => {
  const originalGet = httpClient.get;
  let capturedUrl = '';

  httpClient.get = (async (url: string) => {
    capturedUrl = url;
    return mockResponse({ url }, {
      isSuccess: true,
      data: [],
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    await searchSemanticProducts('   waterproof packing   ');
    assert.equal(capturedUrl, '/api/v1/Products/semantic-search?text=waterproof%20packing');
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 5 & 6: Empty and whitespace-only queries rejected client-side without network call', async () => {
  let networkCalled = false;
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    networkCalled = true;
    return mockResponse({}, {});
  }) as any;

  try {
    await assert.rejects(
      searchSemanticProducts(''),
      (err: any) => err.status === 400 && err.code === 'VALIDATION_EMPTY'
    );
    await assert.rejects(
      searchSemanticProducts('    '),
      (err: any) => err.status === 400 && err.code === 'VALIDATION_EMPTY'
    );
    assert.equal(networkCalled, false);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 7: Query exceeding 200 characters rejected client-side without network call', async () => {
  let networkCalled = false;
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    networkCalled = true;
    return mockResponse({}, {});
  }) as any;

  const longQuery = 'A'.repeat(201);

  try {
    await assert.rejects(
      searchSemanticProducts(longQuery),
      (err: any) => err.status === 400 && err.code === 'VALIDATION_TOO_LONG'
    );
    assert.equal(networkCalled, false);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 8: Exact 200-character query permitted and dispatched', async () => {
  const originalGet = httpClient.get;
  let capturedUrl = '';

  httpClient.get = (async (url: string) => {
    capturedUrl = url;
    return mockResponse({ url }, {
      isSuccess: true,
      data: [],
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  const exact200 = 'B'.repeat(200);

  try {
    const res = await searchSemanticProducts(exact200);
    assert.deepEqual(res, []);
    assert.equal(capturedUrl, `/api/v1/Products/semantic-search?text=${exact200}`);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- 9 to 13: Result Envelope & Payload Handling ---

test('P3-B 9 & 10: Result envelope unwrapped and returns typed SemanticProductDto[]', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: sampleProducts,
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    const items = await searchSemanticProducts('storage box');
    assert.equal(items.length, 2);
    assert.equal(items[0].sku, 'BOX-LRG-01');
    assert.equal(items[0].similarityScore, 88.42);
    assert.equal(items[1].sku, 'TAPE-WTR-02');
    assert.equal(items[1].similarityScore, 76.15);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 11: Empty array payload yields empty array without error', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: [],
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    const items = await searchSemanticProducts('unmatched item');
    assert.deepEqual(items, []);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 12: Null or undefined data field rejected as invalid response (HTTP 502)', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: null,
      message: 'No data',
    });
  }) as any;

  try {
    await assert.rejects(
      searchSemanticProducts('box'),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 13: Server isSuccess=false payload rejected as invalid response (HTTP 502)', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: false,
      data: null,
      message: 'Embedding generation failed',
      error: 'PROVIDER_ERROR',
    });
  }) as any;

  try {
    await assert.rejects(
      searchSemanticProducts('box'),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.get = originalGet;
  }
});

// --- 14 to 18: Grounding & Defensive Data Integrity ---

test('P3-B 14, 15, 16, 17: Grounded fields (id, sku, name, similarityScore) retained unaltered', async () => {
  const originalGet = httpClient.get;
  const rawItem = {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    sku: 'SKU-EXACT-001',
    name: 'Precision Heavy Duty Pallet',
    description: 'Industrial warehouse pallet.',
    similarityScore: 92.75,
  };

  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: [rawItem],
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    const items = await searchSemanticProducts('pallet');
    assert.equal(items.length, 1);
    assert.equal(items[0].id, rawItem.id);
    assert.equal(items[0].sku, rawItem.sku);
    assert.equal(items[0].name, rawItem.name);
    // Score must NOT be multiplied by 100
    assert.equal(items[0].similarityScore, 92.75);
    assert.notEqual(items[0].similarityScore, 9275);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 18: Malformed or missing items filtered out defensively', async () => {
  const originalGet = httpClient.get;
  const dirtyData = [
    { id: '', sku: 'SKU-1', name: 'Name 1', similarityScore: 80 }, // empty id
    { id: 'id-2', sku: '', name: 'Name 2', similarityScore: 80 }, // empty sku
    { id: 'id-3', sku: 'SKU-3', name: '', similarityScore: 80 }, // empty name
    { id: 'id-4', sku: 'SKU-4', name: 'Name 4', similarityScore: NaN }, // non-finite score
    { id: 'id-5', sku: 'SKU-5', name: 'Name 5', similarityScore: 85.5 }, // valid
  ];

  httpClient.get = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: dirtyData,
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    const items = await searchSemanticProducts('test');
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'id-5');
    assert.equal(items[0].sku, 'SKU-5');
    assert.equal(items[0].name, 'Name 5');
    assert.equal(items[0].similarityScore, 85.5);
  } finally {
    httpClient.get = originalGet;
  }
});

// --- 19 to 23: Error Normalization ---

test('P3-B 19: HTTP 400 maps to validation error', () => {
  const parsed = parseSemanticSearchError({ status: 400, message: 'Search query invalid.' });
  assert.equal(parsed.status, 400);
  assert.equal(parsed.kind, 'validation');
  assert.equal(parsed.message, 'Search query invalid.');
});

test('P3-B 20: HTTP 502 maps to invalid_response error', () => {
  const parsed = parseSemanticSearchError({ status: 502, code: 'AI_RESPONSE_INVALID' });
  assert.equal(parsed.status, 502);
  assert.equal(parsed.kind, 'invalid_response');
  assert.match(parsed.message, /could not be processed/i);
});

test('P3-B 21: HTTP 503 maps to provider_unavailable error', () => {
  const parsed1 = parseSemanticSearchError({ status: 503, code: 'AI_CONFIGURATION_MISSING' });
  assert.equal(parsed1.status, 503);
  assert.equal(parsed1.kind, 'provider_unavailable');
  assert.match(parsed1.message, /currently unavailable/i);

  const parsed2 = parseSemanticSearchError({ status: 503, code: 'AI_PROVIDER_UNAVAILABLE' });
  assert.equal(parsed2.status, 503);
  assert.equal(parsed2.kind, 'provider_unavailable');
  assert.match(parsed2.message, /Standard product search remains available/i);
});

test('P3-B 22: HTTP 504 maps to timeout error', () => {
  const parsed = parseSemanticSearchError({ status: 504, code: 'AI_TIMEOUT' });
  assert.equal(parsed.status, 504);
  assert.equal(parsed.kind, 'timeout');
  assert.match(parsed.message, /timed out/i);
});

test('P3-B 23: Unknown status maps to fallback error with standard-search reminder', () => {
  const parsed = parseSemanticSearchError({ status: 500, message: 'Internal server error' });
  assert.equal(parsed.status, 500);
  assert.equal(parsed.kind, 'unknown');
  assert.match(parsed.message, /Standard product search remains available/i);
});

// --- 24 to 30: UI Rendering & Accessibility ---

test('P3-B 24: Modal renders advisory notice and standard-search authority wording', () => {
  const html = renderToStaticMarkup(
    <SemanticProductSearchModal onClose={() => {}} onOpen={() => {}} />
  );
  // Advisory notice presence
  assert.match(html, /role="note"/);
  assert.match(html, /AI embeddings/i);
  assert.match(html, /Standard product search remains authoritative|nguồn chuẩn xác cho tra cứu/i);
  assert.match(html, /exact SKU, barcode|tra cứu SKU, mã vạch/i);
});

test('P3-B 25: Modal input has maxLength 200 and character counter', () => {
  const html = renderToStaticMarkup(
    <SemanticProductSearchModal onClose={() => {}} onOpen={() => {}} />
  );
  assert.match(html, /maxLength="200"/i);
  assert.match(html, /0 \/ 200/);
});

test('P3-B 26 & 27: Rendered result contains genuine SKU, Name, and similarity badge (not multiplied by 100)', () => {
  const html = renderToStaticMarkup(<SemanticSearchResults results={sampleProducts} onOpen={() => {}} />);
  assert.match(html, /BOX-LRG-01/);
  assert.match(html, /Heavy-Duty Storage Box/);
  assert.match(html, /data-testid="similarity-badge"/);
  assert.doesNotMatch(html, /8842%/);
  assert.match(html, /88\.42%/);
});

test('P3-B 28: No search request during initial server rendering', () => {
  let networkCalled = false;
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    networkCalled = true;
    return mockResponse({}, {});
  }) as any;

  try {
    renderToStaticMarkup(
      <SemanticProductSearchModal onClose={() => {}} onOpen={() => {}} />
    );
    assert.equal(networkCalled, false);
  } finally {
    httpClient.get = originalGet;
  }
});

test('P3-B 29: Mutation boundary — semantic search never invokes POST, PUT, or DELETE', async () => {
  const originalGet = httpClient.get;
  const originalPost = httpClient.post;
  const originalPut = httpClient.put;
  const originalDelete = httpClient.delete;

  const mutationCalls: string[] = [];

  httpClient.get = (async (url: string) => {
    return mockResponse({ url }, {
      isSuccess: true,
      data: sampleProducts,
      message: null,
      error: null,
      errors: [],
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
    await searchSemanticProducts('industrial pallets');
    assert.deepEqual(mutationCalls, []);
  } finally {
    httpClient.get = originalGet;
    httpClient.post = originalPost;
    httpClient.put = originalPut;
    httpClient.delete = originalDelete;
  }
});

test('P3-B 30: Provider failure rejects instead of fabricating product records', async () => {
  const originalGet = httpClient.get;
  httpClient.get = (async () => {
    throw { status: 503, code: 'AI_PROVIDER_UNAVAILABLE' };
  }) as any;

  try {
    await assert.rejects(
      searchSemanticProducts('emergency safety gear'),
      (err: any) => err.kind === 'provider_unavailable'
    );
  } finally {
    httpClient.get = originalGet;
  }
});


test('real Axios wrapper sends one encoded GET with AbortSignal and preserves server ordering and scores', async () => {
  const adapter = httpClient.defaults.adapter;
  const controller = new AbortController();
  let calls = 0;
  httpClient.defaults.adapter = async config => {
    calls++;
    assert.equal(config.method, 'get');
    assert.equal(config.url, '/api/v1/Products/semantic-search?text=h%E1%BB%99p%20%26%20b%C4%83ng%20keo');
    assert.equal(config.signal, controller.signal);
    return mockResponse(config, { isSuccess: true, data: sampleProducts });
  };
  try {
    assert.deepEqual(await searchSemanticProducts('  hộp & băng keo  ', controller.signal), sampleProducts);
    assert.equal(calls, 1);
  } finally { httpClient.defaults.adapter = adapter; }
});

test('real Axios error normalization preserves auth/provider failures without retry or fake results', async () => {
  const adapter = httpClient.defaults.adapter;
  try {
    for (const [status, code, kind] of [
      [400, 'VALIDATION_ERROR', 'validation'], [401, 'UNAUTHORIZED', 'unknown'],
      [403, 'FORBIDDEN', 'unknown'], [502, 'AI_RESPONSE_INVALID', 'invalid_response'],
      [503, 'AI_PROVIDER_UNAVAILABLE', 'provider_unavailable'], [504, 'AI_TIMEOUT', 'timeout'],
    ] as const) {
      let calls = 0;
      httpClient.defaults.adapter = async config => {
        calls++;
        throw new axios.AxiosError('Fixture error', 'ERR_BAD_RESPONSE', config, undefined,
          mockResponse(config, { errorCode: code, message: 'Fixture error' }, status));
      };
      await assert.rejects(searchSemanticProducts('box'), (error: any) =>
        error.status === status && error.code === code && error.kind === kind);
      assert.equal(calls, 1);
    }
  } finally { httpClient.defaults.adapter = adapter; }
});

test('canceled request preserves Axios cancellation for caller cleanup', async () => {
  const adapter = httpClient.defaults.adapter;
  const controller = new AbortController();
  httpClient.defaults.adapter = async config => {
    assert.equal(config.signal, controller.signal);
    controller.abort();
    throw new axios.CanceledError('Fixture cancellation', config);
  };
  try {
    await assert.rejects(searchSemanticProducts('box', controller.signal), axios.isCancel);
  } finally { httpClient.defaults.adapter = adapter; }
});

test('fully malformed response is an error; genuine empty response remains valid', async () => {
  const adapter = httpClient.defaults.adapter;
  try {
    for (const data of [null, {}, [null], [{ ...sampleProducts[0], similarityScore: Infinity }]]) {
      httpClient.defaults.adapter = async config => mockResponse(config, { isSuccess: true, data });
      await assert.rejects(searchSemanticProducts('box'), (error: any) => error.kind === 'invalid_response');
    }
    httpClient.defaults.adapter = async config => mockResponse(config, { isSuccess: true, data: [] });
    assert.deepEqual(await searchSemanticProducts('box'), []);
  } finally { httpClient.defaults.adapter = adapter; }
});

test('results render backend text safely, including real percentage and empty state in both languages', async () => {
  const previous = i18n.language;
  try {
    for (const language of ['en-US', 'vi-VN']) {
      await i18n.changeLanguage(language);
      const html = renderToStaticMarkup(<SemanticSearchResults results={[
        { ...sampleProducts[0], name: '<script>fixture()</script>', description: '<img src=x onerror=fixture()>' },
      ]} onOpen={() => {}} />);
      assert.match(html, /BOX-LRG-01/);
      assert.match(html, /88\.42%/);
      assert.doesNotMatch(html, /8842%|<script>|<img src=x/);
      assert.match(html, /&lt;script&gt;/);
      assert.match(html, /&lt;img/);
      const empty = renderToStaticMarkup(<SemanticSearchResults results={[]} onOpen={() => {}} />);
      assert.match(empty, /role="status"/);
      assert.ok(empty.includes((language === 'en-US' ? en : vi).f8.semanticSearch.noMatches));
      assert.doesNotMatch(empty, /similarity-badge/);
    }
  } finally { await i18n.changeLanguage(previous); }
});

test('every displayed error has a translation; authentication errors retain their meaning', () => {
  const errors = [
    { status: 400, code: 'VALIDATION_EMPTY' }, { status: 400, code: 'VALIDATION_TOO_LONG' },
    { status: 400 }, { status: 401 }, { status: 403 }, { status: 502 }, { status: 503 }, { status: 504 }, {},
  ];
  for (const raw of errors) {
    const error: any = raw.code?.startsWith('VALIDATION_') ? { ...raw, kind: 'validation' } : parseSemanticSearchError(raw);
    const key = semanticSearchErrorKey(error);
    for (const resource of [en, vi]) assert.equal(typeof key.split('.').reduce((value: any, part) => value?.[part], resource), 'string', key);
  }
  assert.equal(semanticSearchErrorKey(parseSemanticSearchError({ status: 401 })), 'f8.errors.401');
  assert.equal(semanticSearchErrorKey(parseSemanticSearchError({ status: 403 })), 'f8.errors.403');
});
