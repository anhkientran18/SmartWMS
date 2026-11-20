import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { httpClient } from '../src/services/api/httpClient';
import {
  askAiGuidance,
  parseAiChatError,
  AiChatError,
} from '../src/services/chat/aiChatApi';
import AiChatDrawer from '../src/features/chat/AiChatDrawer';

// Helper to mock httpClient calls
const mockResponse = (config: any, data: any, status = 200, headers: any = {}) => ({
  config,
  data,
  status,
  statusText: String(status),
  headers,
});

test('P3-A API: 1 & 2. Valid message trims surrounding whitespace and sends POST /api/v1/Chat/ask with exact payload', async () => {
  const originalPost = httpClient.post;
  let capturedUrl = '';
  let capturedPayload: any = null;

  httpClient.post = (async (url: string, data: any) => {
    capturedUrl = url;
    capturedPayload = data;
    return mockResponse({ url }, {
      isSuccess: true,
      data: 'FIFO (First-In, First-Out) ensures oldest stock is picked first.',
      message: 'OK',
      error: null,
      errors: [],
    });
  }) as any;

  try {
    const reply = await askAiGuidance('   What is FIFO?   ');
    assert.equal(capturedUrl, '/api/v1/Chat/ask');
    assert.deepEqual(capturedPayload, { message: 'What is FIFO?' });
    assert.equal(reply, 'FIFO (First-In, First-Out) ensures oldest stock is picked first.');
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-A API: 3. Empty or whitespace-only message rejected client-side before network', async () => {
  let networkCalled = false;
  const originalPost = httpClient.post;
  httpClient.post = (async () => {
    networkCalled = true;
    return mockResponse({}, {});
  }) as any;

  try {
    await assert.rejects(
      askAiGuidance('   '),
      (err: any) => err.status === 400 && err.code === 'VALIDATION_EMPTY'
    );
    assert.equal(networkCalled, false);
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-A API: 4. Message > 2000 chars rejected client-side before network', async () => {
  let networkCalled = false;
  const originalPost = httpClient.post;
  httpClient.post = (async () => {
    networkCalled = true;
    return mockResponse({}, {});
  }) as any;

  const longMessage = 'A'.repeat(2001);

  try {
    await assert.rejects(
      askAiGuidance(longMessage),
      (err: any) => err.status === 400 && err.code === 'VALIDATION_TOO_LONG'
    );
    assert.equal(networkCalled, false);
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-A API: 5. Payload never includes transcript history, previous messages, or warehouse context', async () => {
  const originalPost = httpClient.post;
  let capturedPayload: any = null;

  httpClient.post = (async (url: string, data: any) => {
    capturedPayload = data;
    return mockResponse({ url }, {
      isSuccess: true,
      data: 'FEFO picks items closest to expiry date.',
      message: 'OK',
      error: null,
      errors: [],
    });
  }) as any;

  try {
    await askAiGuidance('How does FEFO work?');
    assert.equal(Object.keys(capturedPayload).length, 1);
    assert.equal(capturedPayload.message, 'How does FEFO work?');
    assert.equal('history' in capturedPayload, false);
    assert.equal('previousMessages' in capturedPayload, false);
    assert.equal('warehouseId' in capturedPayload, false);
    assert.equal('context' in capturedPayload, false);
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-A API: 6. Success Result envelope correctly unwraps string data', async () => {
  const originalPost = httpClient.post;
  httpClient.post = (async () => {
    return mockResponse({}, {
      isSuccess: true,
      data: 'Put-away guidance: prioritize fast-movers near dispatch doors.',
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    const data = await askAiGuidance('Put-away tips');
    assert.equal(data, 'Put-away guidance: prioritize fast-movers near dispatch doors.');
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-A API: 7. Malformed success payload is rejected as invalid_response rather than fabricated', async () => {
  const originalPost = httpClient.post;
  httpClient.post = (async () => {
    return mockResponse({}, {
      isSuccess: false,
      data: null,
      message: 'Failed to generate',
      error: 'ERR',
    });
  }) as any;

  try {
    await assert.rejects(
      askAiGuidance('Query'),
      (err: any) => err.status === 502 && err.kind === 'invalid_response'
    );
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-A API: 8. HTTP 400 validation error normalized', () => {
  const parsed = parseAiChatError({ status: 400, message: 'Message exceeds maximum length.' });
  assert.equal(parsed.status, 400);
  assert.equal(parsed.kind, 'validation');
  assert.equal(parsed.message, 'Message exceeds maximum length.');
});

test('P3-A API: 9. HTTP 502 AI_RESPONSE_INVALID normalized', () => {
  const parsed = parseAiChatError({ status: 502, code: 'AI_RESPONSE_INVALID' });
  assert.equal(parsed.status, 502);
  assert.equal(parsed.kind, 'invalid_response');
  assert.match(parsed.message, /could not be processed/i);
});

test('P3-A API: 10. HTTP 503 AI_CONFIGURATION_MISSING / AI_PROVIDER_UNAVAILABLE normalized', () => {
  const parsedMissing = parseAiChatError({ status: 503, code: 'AI_CONFIGURATION_MISSING' });
  assert.equal(parsedMissing.status, 503);
  assert.equal(parsedMissing.kind, 'provider_unavailable');
  assert.match(parsedMissing.message, /currently unavailable/i);

  const parsedUnavail = parseAiChatError({ status: 503, code: 'AI_PROVIDER_UNAVAILABLE' });
  assert.equal(parsedUnavail.status, 503);
  assert.equal(parsedUnavail.kind, 'provider_unavailable');
  assert.match(parsedUnavail.message, /currently unavailable/i);
});

test('P3-A API: 11. HTTP 504 Timeout normalized', () => {
  const parsed = parseAiChatError({ status: 504, code: 'AI_TIMEOUT' });
  assert.equal(parsed.status, 504);
  assert.equal(parsed.kind, 'timeout');
  assert.match(parsed.message, /timed out/i);
});

test('P3-A UI: 12 & 13. Authoritative-data disclaimer and stateless/single-turn notice rendered', () => {
  const html = renderToStaticMarkup(<AiChatDrawer isOpen={true} onClose={() => {}} />);
  // Check disclaimer presence
  assert.match(html, /Advisory Notice|Lưu ý về nguồn dữ liệu/);
  assert.match(html, /authoritative source of truth|nguồn thông tin chuẩn xác/);
  // Check single-turn stateless notice
  assert.match(html, /processed independently|xử lý độc lập/);
  assert.match(html, /does not retain|không lưu giữ/);
});

test('P3-A UI: 14. Initial welcome message rendered in drawer', () => {
  const html = renderToStaticMarkup(<AiChatDrawer isOpen={true} onClose={() => {}} />);
  assert.match(html, /SmartWMS Operational Advisor|Trợ lý Tư vấn Nghiệp vụ/);
  assert.match(html, /FIFO\/FEFO/);
});

test('P3-A UI: 15. HTML-like output in messages remains escaped / inert text', () => {
  // Directly verify React JSX escaping by simulating message rendering
  const maliciousText = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
  const html = renderToStaticMarkup(
    <div className="whitespace-pre-wrap">{maliciousText}</div>
  );
  assert.match(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('P3-A UI: 16. Drawer closed returns null without mounting DOM overlay', () => {
  const html = renderToStaticMarkup(<AiChatDrawer isOpen={false} onClose={() => {}} />);
  assert.equal(html, '');
});

test('P3-A UI: 17. Quick prompts contain strictly generic operational topics, zero live SKU/order references', () => {
  const html = renderToStaticMarkup(<AiChatDrawer isOpen={true} onClose={() => {}} />);
  // Must contain generic guidance
  assert.match(html, /FIFO|FEFO/i);
  assert.match(html, /discrepancy|sai lệch/i);
  assert.match(html, /put-away|sắp xếp/i);
  assert.match(html, /cycle count|kiểm kê/i);
  // Must NOT contain specific product stock queries
  assert.doesNotMatch(html, /SKU-/);
  assert.doesNotMatch(html, /how much stock/i);
  assert.doesNotMatch(html, /which bins are almost full/i);
});

test('P3-A Multi-turn API isolation: Sequential inquiries each transmit only current message', async () => {
  const originalPost = httpClient.post;
  const payloads: any[] = [];

  httpClient.post = (async (url: string, data: any) => {
    payloads.push(data);
    return mockResponse({ url }, {
      isSuccess: true,
      data: `Reply to: ${data.message}`,
      message: null,
      error: null,
      errors: [],
    });
  }) as any;

  try {
    // Turn 1
    const reply1 = await askAiGuidance('How does FEFO differ from FIFO?');
    assert.equal(reply1, 'Reply to: How does FEFO differ from FIFO?');
    assert.deepEqual(payloads[0], { message: 'How does FEFO differ from FIFO?' });

    // Turn 2
    const reply2 = await askAiGuidance('When should I use FEFO?');
    assert.equal(reply2, 'Reply to: When should I use FEFO?');
    // Turn 2 must NOT contain Turn 1 text
    assert.deepEqual(payloads[1], { message: 'When should I use FEFO?' });
    assert.equal('How does FEFO differ' in payloads[1], false);
  } finally {
    httpClient.post = originalPost;
  }
});

test('P3-A Mutation boundary: AI chat service never invokes mutation endpoints', async () => {
  const originalPost = httpClient.post;
  const originalPut = httpClient.put;
  const originalDelete = httpClient.delete;

  const mutationCalls: string[] = [];

  httpClient.post = (async (url: string, data: any) => {
    mutationCalls.push(url);
    return mockResponse({ url }, {
      isSuccess: true,
      data: 'Guidance',
      message: null,
      error: null,
      errors: [],
    });
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
    await askAiGuidance('Explain slotting optimization principles');
    // Ensure only /api/v1/Chat/ask was called
    assert.deepEqual(mutationCalls, ['/api/v1/Chat/ask']);
  } finally {
    httpClient.post = originalPost;
    httpClient.put = originalPut;
    httpClient.delete = originalDelete;
  }
});
