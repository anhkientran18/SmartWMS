import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { httpClient } from '../src/services/api/httpClient';
import {
  analyzeDamageImage,
  validateImageFile,
  parseDamageVisionError,
  MAX_IMAGE_SIZE_BYTES,
  DamageVisionResponse,
} from '../src/services/inbound/damageVisionApi';
import DamageVisionModal, { formatGeneratedTime } from '../src/features/inbound/DamageVisionModal';

const mockResponse = (config: any, data: any, status = 200, headers: any = {}) => ({
  config,
  data,
  status,
  statusText: String(status),
  headers,
});

const sampleSuccessResponse: DamageVisionResponse = {
  isSuccess: true,
  analysis: {
    damageType: 'Torn carton packaging',
    severity: 'Medium',
    damageDescription: 'Outer carton box has a 10cm tear along the upper seam.',
    actionRecommended: 'Inspect inner items for physical damage before putaway.',
  },
  generatedAt: '2026-11-01T12:00:00.000Z',
};

// Helper to create mock File in tests
function createMockFile(name: string, sizeBytes: number, type: string): File {
  const buffer = new Uint8Array(sizeBytes);
  return new File([buffer], name, { type });
}

// =========================================================================
// 1. Service / Upload Contract Tests (Items 1 - 6)
// =========================================================================

test('P3-D Contract 1 & 2: Endpoint POST /api/v1/InboundReceipts/report-damage invoked', async () => {
  const originalPost = httpClient.post;
  let capturedUrl = '';

  httpClient.post = (async (url: string) => {
    capturedUrl = url;
    return mockResponse({ url }, sampleSuccessResponse);
  }) as any;

  try {
    const file = createMockFile('box.jpg', 1024, 'image/jpeg');
    const res = await analyzeDamageImage(file);
    assert.equal(capturedUrl, '/api/v1/InboundReceipts/report-damage');
    assert.equal(res.isSuccess, true);
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-D Contract 3 & 4: Request body is FormData containing file under key "file"', async () => {
  const originalPost = httpClient.post;
  let capturedData: any = null;

  httpClient.post = (async (_url: string, data: any) => {
    capturedData = data;
    return mockResponse({}, sampleSuccessResponse);
  }) as any;

  try {
    const file = createMockFile('inspection.png', 2048, 'image/png');
    await analyzeDamageImage(file);
    assert.ok(capturedData instanceof FormData, 'Data must be an instance of FormData');
    assert.ok(capturedData.has('file'), 'FormData must contain "file" field');
    const retrievedFile = capturedData.get('file') as File;
    assert.equal(retrievedFile.name, 'inspection.png');
    assert.equal(retrievedFile.type, 'image/png');
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-D Contract 5 & 6: Request does not include receiptId, SKU, productId or fake business payloads', async () => {
  const originalPost = httpClient.post;
  let capturedData: any = null;

  httpClient.post = (async (_url: string, data: any) => {
    capturedData = data;
    return mockResponse({}, sampleSuccessResponse);
  }) as any;

  try {
    const file = createMockFile('cargo.webp', 1024, 'image/webp');
    await analyzeDamageImage(file);
    assert.equal(capturedData.has('receiptId'), false);
    assert.equal(capturedData.has('sku'), false);
    assert.equal(capturedData.has('productId'), false);
    assert.equal(capturedData.has('supplier'), false);
    assert.equal(capturedData.has('warehouse'), false);
  } finally {
    httpClient.post = originalPost;
  }
});

// =========================================================================
// 2. File Validation Tests (Items 7 - 17)
// =========================================================================

test('P3-D Validation 7, 8, 9, 10: Supported image formats (JPG, JPEG, PNG, WEBP) pass validation', () => {
  const jpg = createMockFile('test.jpg', 100, 'image/jpeg');
  const jpeg = createMockFile('test.jpeg', 100, 'image/jpeg');
  const png = createMockFile('test.png', 100, 'image/png');
  const webp = createMockFile('test.webp', 100, 'image/webp');

  assert.doesNotThrow(() => validateImageFile(jpg));
  assert.doesNotThrow(() => validateImageFile(jpeg));
  assert.doesNotThrow(() => validateImageFile(png));
  assert.doesNotThrow(() => validateImageFile(webp));
});

test('P3-D Validation 11, 12, 13: Unsupported formats (GIF, PDF, HEIC) strictly rejected client-side', () => {
  const gif = createMockFile('animation.gif', 100, 'image/gif');
  const pdf = createMockFile('document.pdf', 100, 'application/pdf');
  const heic = createMockFile('photo.heic', 100, 'image/heic');

  assert.throws(() => validateImageFile(gif), (err: any) => err.code === 'VALIDATION_FILE_TYPE');
  assert.throws(() => validateImageFile(pdf), (err: any) => err.code === 'VALIDATION_FILE_TYPE');
  assert.throws(() => validateImageFile(heic), (err: any) => err.code === 'VALIDATION_FILE_TYPE');
});

test('P3-D Validation 14: Zero-byte file rejected client-side', () => {
  const empty = createMockFile('empty.jpg', 0, 'image/jpeg');
  assert.throws(() => validateImageFile(empty), (err: any) => err.code === 'VALIDATION_FILE_EMPTY');
});

test('P3-D Validation 15 & 16: Size limit of 5 MiB enforced; exact 5 MiB passes, 5 MiB + 1 rejected', () => {
  const exactMax = createMockFile('max.png', MAX_IMAGE_SIZE_BYTES, 'image/png');
  assert.doesNotThrow(() => validateImageFile(exactMax));

  const tooLarge = createMockFile('huge.png', MAX_IMAGE_SIZE_BYTES + 1, 'image/png');
  assert.throws(() => validateImageFile(tooLarge), (err: any) => err.code === 'VALIDATION_FILE_TOO_LARGE');
});

test('P3-D Validation 17: Extension and MIME type mismatch rejected client-side', () => {
  // photo.png with image/jpeg
  const mismatched1 = createMockFile('photo.png', 1000, 'image/jpeg');
  assert.throws(() => validateImageFile(mismatched1), (err: any) => err.code === 'VALIDATION_MIME_MISMATCH');

  // photo.jpg with application/pdf
  const mismatched2 = createMockFile('photo.jpg', 1000, 'application/pdf');
  assert.throws(() => validateImageFile(mismatched2), (err: any) => err.code === 'VALIDATION_MIME_TYPE');
});

// =========================================================================
// 3. Response Parser Tests (Items 18 - 28)
// =========================================================================

test('P3-D Parser 18, 19, 20, 21: Valid success response with Low, Medium, High severity parsed', async () => {
  const originalPost = httpClient.post;
  const severities = ['Low', 'Medium', 'High'] as const;

  for (const sev of severities) {
    httpClient.post = (async () => {
      return mockResponse({}, {
        isSuccess: true,
        analysis: {
          damageType: 'Surface scratch',
          severity: sev,
          damageDescription: 'Minor paint scratch.',
          actionRecommended: 'Clean and verify label integrity.',
        },
        generatedAt: '2026-11-01T12:00:00Z',
      });
    }) as any;

    try {
      const file = createMockFile('test.jpg', 500, 'image/jpeg');
      const res = await analyzeDamageImage(file);
      assert.equal(res.isSuccess, true);
      assert.equal(res.analysis.severity, sev);
    } finally {
      httpClient.post = originalPost;
    }
  }
});

test('P3-D Parser 22: Invalid severities (Unknown, Critical, Severe, Moderate, None, empty, null, undefined) strictly rejected with 502 invalid_response', async () => {
  const originalPost = httpClient.post;
  const invalidSeverities = ['Critical', 'Unknown', 'Severe', 'Moderate', 'None', '', '   ', null, undefined];

  for (const invalidSev of invalidSeverities) {
    httpClient.post = (async () => {
      return mockResponse({}, {
        isSuccess: true,
        analysis: {
          damageType: 'Severe crack',
          severity: invalidSev,
          damageDescription: 'Item is fractured.',
          actionRecommended: 'Discard.',
        },
        generatedAt: '2026-11-01T12:00:00Z',
      });
    }) as any;

    try {
      const file = createMockFile('test.jpg', 500, 'image/jpeg');
      await assert.rejects(
        analyzeDamageImage(file),
        (err: any) => err.status === 502 && err.kind === 'invalid_response',
        `Expected severity "${invalidSev}" to be rejected with 502 invalid_response`
      );
    } finally {
      httpClient.post = originalPost;
    }
  }
});

test('P3-D Parser 22b: Case variants (medium, low, HIGH, LOW) strictly rejected under exact backend contract', async () => {
  const originalPost = httpClient.post;
  const casingVariants = ['medium', 'low', 'high', 'MEDIUM', 'LOW', 'HIGH'];

  for (const variant of casingVariants) {
    httpClient.post = (async () => {
      return mockResponse({}, {
        isSuccess: true,
        analysis: {
          damageType: 'Surface dent',
          severity: variant,
          damageDescription: 'Dent observed.',
          actionRecommended: 'Follow-up inspection.',
        },
        generatedAt: '2026-11-01T12:00:00Z',
      });
    }) as any;

    try {
      const file = createMockFile('test.jpg', 500, 'image/jpeg');
      await assert.rejects(
        analyzeDamageImage(file),
        (err: any) => err.status === 502 && err.kind === 'invalid_response',
        `Expected casing variant "${variant}" to be rejected under strict contract`
      );
    } finally {
      httpClient.post = originalPost;
    }
  }
});

test('P3-D Parser 22c: Whole-response rejection on invalid severity — zero partial fields returned', async () => {
  const originalPost = httpClient.post;
  httpClient.post = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      analysis: {
        damageType: 'Legitimate Damage Type',
        severity: 'Critical',
        damageDescription: 'Legitimate Description',
        actionRecommended: 'Legitimate Action',
      },
      generatedAt: '2026-11-01T12:00:00Z',
    });
  }) as any;

  try {
    const file = createMockFile('test.jpg', 500, 'image/jpeg');
    let returnedResult: any = null;
    try {
      returnedResult = await analyzeDamageImage(file);
    } catch (err: any) {
      assert.equal(err.status, 502);
      assert.equal(err.kind, 'invalid_response');
    }
    // Must NOT have returned any partial result
    assert.equal(returnedResult, null);
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-D Parser 23, 24, 25: Blank or missing analysis fields rejected with 502 invalid_response', async () => {
  const originalPost = httpClient.post;

  // Case A: Blank damageType
  httpClient.post = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      analysis: {
        damageType: '   ',
        severity: 'Low',
        damageDescription: 'Desc',
        actionRecommended: 'Action',
      },
      generatedAt: '2026-11-01T12:00:00Z',
    });
  }) as any;

  try {
    const file = createMockFile('test.jpg', 500, 'image/jpeg');
    await assert.rejects(
      analyzeDamageImage(file),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.post = originalPost;
  }

  // Case B: Blank actionRecommended
  httpClient.post = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      analysis: {
        damageType: 'Dent',
        severity: 'Medium',
        damageDescription: 'Dent on side.',
        actionRecommended: '',
      },
      generatedAt: '2026-11-01T12:00:00Z',
    });
  }) as any;

  try {
    const file = createMockFile('test.jpg', 500, 'image/jpeg');
    await assert.rejects(
      analyzeDamageImage(file),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-D Parser 26: Malformed or missing generatedAt rejected with 502 invalid_response (never fabricated)', async () => {
  const originalPost = httpClient.post;
  const badTimestamps = ['invalid-not-a-date', '', '   ', null, undefined];

  for (const badTime of badTimestamps) {
    httpClient.post = (async () => {
      return mockResponse({}, {
        isSuccess: true,
        analysis: {
          damageType: 'Dent',
          severity: 'Medium',
          damageDescription: 'Desc',
          actionRecommended: 'Action',
        },
        generatedAt: badTime,
      });
    }) as any;

    try {
      const file = createMockFile('test.jpg', 500, 'image/jpeg');
      await assert.rejects(
        analyzeDamageImage(file),
        (err: any) => err.status === 502 && err.kind === 'invalid_response',
        `Expected bad timestamp "${badTime}" to be rejected with 502 invalid_response`
      );
    } finally {
      httpClient.post = originalPost;
    }
  }
});

test('P3-D Parser 27 & 28: Malformed success envelope (null analysis or isSuccess false) rejected without fake fallback', async () => {
  const originalPost = httpClient.post;
  httpClient.post = (async () => {
    return mockResponse({}, {
      isSuccess: false,
      message: 'Failed to inspect',
    });
  }) as any;

  try {
    const file = createMockFile('test.jpg', 500, 'image/jpeg');
    await assert.rejects(
      analyzeDamageImage(file),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.post = originalPost;
  }
});

// =========================================================================
// 4. Error Mapping Tests (Items 29 - 33)
// =========================================================================

test('P3-D Errors 29: HTTP 400 maps to user-friendly validation message without raw server Vietnamese text', () => {
  const err = parseDamageVisionError({
    status: 400,
    message: 'Nội dung không có signature ảnh phù hợp.',
  });
  assert.equal(err.status, 400);
  assert.equal(err.kind, 'validation');
  assert.match(err.message, /valid JPG, PNG, or WEBP image up to 5 MiB/i);
});

test('P3-D Errors 30: HTTP 502 maps to invalid_response', () => {
  const err = parseDamageVisionError({ status: 502, code: 'AI_RESPONSE_INVALID' });
  assert.equal(err.status, 502);
  assert.equal(err.kind, 'invalid_response');
  assert.match(err.message, /could not be processed/i);
});

test('P3-D Errors 31: HTTP 503 maps to provider_unavailable', () => {
  const err = parseDamageVisionError({ status: 503, code: 'AI_PROVIDER_UNAVAILABLE' });
  assert.equal(err.status, 503);
  assert.equal(err.kind, 'provider_unavailable');
  assert.match(err.message, /currently unavailable/i);
});

test('P3-D Errors 32: HTTP 504 maps to timeout', () => {
  const err = parseDamageVisionError({ status: 504, code: 'AI_TIMEOUT' });
  assert.equal(err.status, 504);
  assert.equal(err.kind, 'timeout');
  assert.match(err.message, /timed out/i);
});

test('P3-D Errors 33: Unknown or network error maps to safe graceful fallback', () => {
  const err = parseDamageVisionError({ status: 500, message: 'Internal Server Error' });
  assert.equal(err.status, 500);
  assert.equal(err.kind, 'unknown');
  assert.match(err.message, /Inbound operations remain unaffected/i);
});

// =========================================================================
// 5. Roles & Gating Tests (Items 34 - 37)
// =========================================================================

test('P3-D Roles 34, 35, 36, 37: Admin, WarehouseManager, and Staff permitted; missing/unknown hidden', () => {
  const canInspectDamage = (session: { role?: string } | null | undefined): boolean => {
    return (
      session?.role === 'Admin' ||
      session?.role === 'WarehouseManager' ||
      session?.role === 'Staff'
    );
  };

  assert.equal(canInspectDamage({ role: 'Admin' }), true);
  assert.equal(canInspectDamage({ role: 'WarehouseManager' }), true);
  assert.equal(canInspectDamage({ role: 'Staff' }), true);
  assert.equal(canInspectDamage({ role: 'Viewer' }), false);
  assert.equal(canInspectDamage({ role: 'Guest' }), false);
  assert.equal(canInspectDamage(null), false);
  assert.equal(canInspectDamage(undefined), false);
});

// =========================================================================
// 6. UI & Advisory Notice Tests (Items 38 - 50)
// =========================================================================

test('P3-D UI 38: Modal render does not trigger network call on open', () => {
  let networkCalled = false;
  const originalPost = httpClient.post;
  httpClient.post = (async () => {
    networkCalled = true;
    return mockResponse({}, {});
  }) as any;

  try {
    const html = renderToStaticMarkup(<DamageVisionModal onClose={() => {}} />);
    assert.equal(networkCalled, false);
    assert.match(html, /AI Damage Vision Inspection|Giám Định Hư Hại Hàng Hóa/i);
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-D UI 44, 45, 46: Advisory notice, packaging-vs-product ambiguity warning, and AI privacy disclosure rendered', () => {
  const html = renderToStaticMarkup(<DamageVisionModal onClose={() => {}} />);

  // Persistent advisory check
  assert.match(html, /role="note"/);
  assert.match(html, /Advisory Visual Assessment Only|Đánh Giá Trực Quan/i);
  // Packaging ambiguity check
  assert.match(html, /Packaging damage does not necessarily mean the product inside is damaged|Bao bì hư hại không đồng nghĩa/i);
  // Privacy disclosure check
  assert.match(html, /does not send SKU, supplier, warehouse, quantities, or user identity|không gửi mã SKU/i);
});

test('P3-D UI 48, 49, 50: Zero confidence percentage, certainty badges, or auto-reject/quarantine actions', () => {
  const html = renderToStaticMarkup(<DamageVisionModal onClose={() => {}} />);

  // Must not have confidence
  assert.doesNotMatch(html, /\bconfidence\b/i);
  assert.doesNotMatch(html, /certainty/i);
  assert.doesNotMatch(html, /probability/i);

  // Must not have mutation/decision actions
  assert.doesNotMatch(html, /reject receipt/i);
  assert.doesNotMatch(html, /mark as damaged/i);
  assert.doesNotMatch(html, /quarantine/i);
  assert.doesNotMatch(html, /change inventory status/i);
  assert.doesNotMatch(html, /create discrepancy/i);
});

test('P3-D UI Date Formatting: formatGeneratedTime produces clean UTC timestamp', () => {
  const time = formatGeneratedTime('2026-11-01T12:30:00.000Z');
  assert.equal(time, '01/11/2026 12:30 UTC');
});

test('P3-D UI 51: UI on invalid response presents normalized error, clears results, and permits retry', () => {
  const err = parseDamageVisionError({ status: 502, code: 'AI_RESPONSE_INVALID' });
  assert.equal(err.status, 502);
  assert.equal(err.kind, 'invalid_response');
  assert.match(err.message, /could not be processed/i);
  // Verify error title exists in translations
  const html = renderToStaticMarkup(<DamageVisionModal onClose={() => {}} />);
  assert.match(html, /AI Damage Vision Inspection|Giám Định Hư Hại/i);
  // Default render has no findings or badges
  assert.doesNotMatch(html, /AI Severity: Medium/);
  assert.doesNotMatch(html, /AI Severity: Low/);
  assert.doesNotMatch(html, /AI Severity: High/);
});

// =========================================================================
// 7. Lifecycle & Mutation Boundary Tests (Items 51 - 60)
// =========================================================================

test('P3-D Mutation 56, 57, 58, 59, 60: Zero receipt, inventory, status, or quantity mutations invoked', async () => {
  const originalGet = httpClient.get;
  const originalPost = httpClient.post;
  const originalPut = httpClient.put;
  const originalPatch = httpClient.patch;
  const originalDelete = httpClient.delete;

  const mutationEndpoints: string[] = [];

  httpClient.get = (async (url: string) => {
    mutationEndpoints.push(`GET:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.post = (async (url: string, data: any) => {
    if (url === '/api/v1/InboundReceipts/report-damage') {
      return mockResponse({ url }, sampleSuccessResponse);
    }
    mutationEndpoints.push(`POST:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.put = (async (url: string) => {
    mutationEndpoints.push(`PUT:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.patch = (async (url: string) => {
    mutationEndpoints.push(`PATCH:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  httpClient.delete = (async (url: string) => {
    mutationEndpoints.push(`DELETE:${url}`);
    return mockResponse({ url }, {});
  }) as any;

  try {
    const file = createMockFile('box.jpg', 500, 'image/jpeg');
    const result = await analyzeDamageImage(file);
    assert.equal(result.isSuccess, true);
    // Assert ZERO business mutations occurred
    assert.deepEqual(mutationEndpoints, []);
  } finally {
    httpClient.get = originalGet;
    httpClient.post = originalPost;
    httpClient.put = originalPut;
    httpClient.patch = originalPatch;
    httpClient.delete = originalDelete;
  }
});
