// Controlled frontend evidence only; never sends a real inventory mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryObserver, MutationObserver } from '@tanstack/react-query';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import { runAutoReplenishment, canReplenish } from '../src/services/inventory/replenishmentApi';
import { createSubmissionGate, replenishmentMutationOptions } from '../src/services/inventory/replenishmentMutation';
import { inventoryQueries as q } from '../src/services/inventory/inventoryQueries';
import RealReplenishment, { ReplenishmentFeedback } from '../src/features/replenishment/RealReplenishment';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';
import i18n from '../src/i18n';

globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
globalThis.document = { documentElement: { lang: '' } } as unknown as Document;
const user = (role: 'Admin' | 'WarehouseManager' | 'Staff' = 'Admin') => ({ token: `fixture.${btoa(JSON.stringify({ exp: Date.now()/1000 + 3600 }))}.unsigned`, role, username: 'fixture', fullName: '' });
const response = (config, data, status = 200) => ({ config, data, status, headers: {}, statusText: String(status) });
const success = (data: unknown) => { httpClient.defaults.adapter = async config => response(config, { isSuccess: true, data }); };
const fail = (status?: number) => { httpClient.defaults.adapter = async config => { throw new axios.AxiosError('controlled', undefined, config, undefined, status ? response(config, null, status) : undefined); }; };
const cache = () => new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false }, mutations: { gcTime: 0 } } });
const feedback = (props) => renderToStaticMarkup(<ReplenishmentFeedback {...props} />);
const source = readFileSync('src/features/replenishment/RealReplenishment.tsx', 'utf8');

test('both authorized roles see action; Staff has no enabled mutation entry', async () => {
  await i18n.changeLanguage('en-US');
  for (const role of ['Admin', 'WarehouseManager', 'Staff'] as const) {
    sessionStore.set(user(role)); const client = cache();
    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><RealReplenishment /></QueryClientProvider></MemoryRouter>);
    assert.equal(html.includes('>Run replenishment</button>'), role !== 'Staff');
    assert.equal(canReplenish(role), role !== 'Staff'); client.clear();
  }
  let requests = 0; httpClient.defaults.adapter = async config => { requests++; return response(config, { isSuccess: true, data: 1 }); };
  await assert.rejects(runAutoReplenishment(), e => e.status === 403); assert.equal(requests, 0);
});

test('exact bodyless POST uses canonical Bearer, no invented scope, forwards optional signal', async () => {
  const session = user(); sessionStore.set(session); const controller = new AbortController();
  httpClient.defaults.adapter = async config => {
    assert.equal(config.method, 'post'); assert.equal(config.url, '/api/v1/Inventory/run-auto-replenish');
    assert.equal(config.data, undefined); assert.equal(config.params, undefined); assert.equal(config.signal, controller.signal);
    assert.equal(config.headers.Authorization, `Bearer ${session.token}`);
    return response(config, { isSuccess: true, data: 3 });
  };
  assert.equal(await runAutoReplenishment(controller.signal), 3);
});

test('confirmation boundary and pending controls are wired before the mutation (source contract)', () => {
  assert.match(source, /if \(!confirming \|\| !canReplenish/);
  assert.match(source, /mutation.reset\(\); setConfirming\(true\)/);
  assert.match(source, /onClick=\{confirm\}/);
  assert.match(source, /disabled=\{mutation.isPending \|\| confirming\}/);
  assert.match(source, /disabled=\{mutation.isPending \|\| !allowed\}/);
  assert.match(source, /setConfirming\(false\)/);
  assert.doesNotMatch(source, /window.confirm|\bfetch\(/);
});

test('synchronous submission gate prevents duplicate pending POST, including same-tick clicks', async () => {
  sessionStore.set(user()); const client = cache(); let resolve; let calls = 0;
  httpClient.defaults.adapter = config => { calls++; return new Promise(done => { resolve = () => done(response(config, { isSuccess: true, data: 0 })); }); };
  const mutation = new MutationObserver(client, replenishmentMutationOptions(client));
  const gate = createSubmissionGate(); const first = gate(() => mutation.mutate());
  await gate(() => mutation.mutate());
  await new Promise(done => setImmediate(done));
  assert.equal(calls, 1); assert.equal(mutation.getCurrentResult().isPending, true);
  resolve(); await first; assert.equal(mutation.getCurrentResult().isSuccess, true); client.clear();
});

test('positive count is movement count only, zero is valid successful result', async () => {
  sessionStore.set(user());
  success(3); assert.equal(await runAutoReplenishment(), 3); assert.match(feedback({ count: 3 }), /3 inventory movements were created/);
  success(0); assert.equal(await runAutoReplenishment(), 0); const html = feedback({ count: 0 });
  assert.match(html, /No replenishment movement was required/); assert.doesNotMatch(html, /role="alert"/);
});

test('malformed int32 counts and failed envelopes never become success', async () => {
  for (const count of [null, undefined, '0', -1, 1.5, 2_147_483_648, {}, true]) { success(count); await assert.rejects(runAutoReplenishment(), e => e.code === 'FE_REPLENISHMENT_CONTRACT'); }
  httpClient.defaults.adapter = async config => response(config, { isSuccess: false, data: 0 });
  await assert.rejects(runAutoReplenishment());
});

test('400, 403 and 409 have distinct feedback; forbidden preserves session', async () => {
  const session = user(); sessionStore.set(session);
  for (const [status, expected] of [[400, en.f3.validation], [403, en.f3.forbidden], [409, en.f3.conflict]] as const) {
    fail(status); await assert.rejects(runAutoReplenishment(), error => {
      assert.equal(error.status, status); const html = feedback({ error, count: 3 });
      assert.ok(html.includes(expected)); assert.doesNotMatch(html, /movements were created/); return true;
    });
    assert.equal(sessionStore.get(), session);
  }
});

test('protected 401 uses F1 session invalidation', async () => {
  sessionStore.set(user()); fail(401); await assert.rejects(runAutoReplenishment()); assert.equal(sessionStore.get(), null);
});

test('network/server failure never retries, fakes success or changes cached reads', async () => {
  sessionStore.set(user());
  for (const status of [undefined, 500]) {
    const client = cache(); client.setQueryData(q.summary().queryKey, { totalQuantity: 22 });
    fail(status); const mutation = new MutationObserver(client, replenishmentMutationOptions(client));
    await assert.rejects(mutation.mutate()); assert.equal(mutation.getCurrentResult().isError, true);
    assert.equal(mutation.getCurrentResult().data, undefined); assert.equal(mutation.getCurrentResult().failureCount, 1);
    assert.deepEqual(client.getQueryData(q.summary().queryKey), { totalQuantity: 22 });
    assert.equal(replenishmentMutationOptions(client).retry, false); client.clear();
  }
});

test('success including zero refreshes affected active F2 keys and invalidates inactive pages only', async () => {
  for (const count of [0, 3]) {
    sessionStore.set(user()); const client = cache(); const seen: string[] = [];
    const options = [q.summary(), q.alerts(), q.history({ pageIndex: 1, pageSize: 10 }), q.bins(), q.bin('selected'), q.contents('selected'), q.products(), q.warehouses(), q.zones()];
    const stop = options.map(option => {
      client.setQueryData(option.queryKey, []);
      return new QueryObserver(client, { queryKey: option.queryKey, queryFn: async () => { seen.push(String(option.queryKey[2])); return []; }, staleTime: Infinity }).subscribe(() => {});
    });
    const inactive = q.history({ pageIndex: 2, pageSize: 10 }).queryKey; client.setQueryData(inactive, []);
    success(count); await new MutationObserver(client, replenishmentMutationOptions(client)).mutate();
    assert.deepEqual(seen.sort(), ['stock-summary','low-stock-alerts','stock-history','bins','bin','bin-contents'].sort());
    assert.equal(client.getQueryState(inactive)?.isInvalidated, true);
    stop.forEach(fn => fn()); client.clear();
  }
});

test('read refresh failure cannot reclassify a committed mutation as failed', async () => {
  sessionStore.set(user()); const client = cache(); client.setQueryData(q.summary().queryKey, {});
  const stop = new QueryObserver(client, { queryKey: q.summary().queryKey, staleTime: Infinity, queryFn: async () => { throw new Error('read failed'); } }).subscribe(() => {});
  success(2); const mutation = new MutationObserver(client, replenishmentMutationOptions(client)); await mutation.mutate();
  assert.equal(mutation.getCurrentResult().data, 2); assert.equal(client.getQueryState(q.summary().queryKey)?.status, 'error'); stop(); client.clear();
});

test('late success after session change cannot refresh another identity cache', async () => {
  sessionStore.set(user()); const client = cache(); const options = replenishmentMutationOptions(client);
  client.setQueryData(q.summary().queryKey, {}); sessionStore.set(user('Staff')); await options.onSuccess();
  assert.equal(client.getQueryState(q.summary().queryKey)?.isInvalidated, false); client.clear();
});

test('VI/EN cover the real surface without unsupported claims; Dashboard no longer dispatches legacy request', () => {
  assert.deepEqual(Object.keys(en.f3).sort(), Object.keys(vi.f3).sort());
  assert.doesNotMatch(JSON.stringify([en.f3, vi.f3]), /FEFO|\bAI\b|Gemini|autonomous|predictive|wave|machine learning/i);
  assert.doesNotMatch(source, /CounterReplenishment|mock|FEFO|Gemini|\bAI\b/);
  const dashboard = readFileSync('src/features/dashboard/WebDashboard.tsx', 'utf8');
  assert.doesNotMatch(dashboard, /fetch\("\/api\/v1\/Inventory\/run-auto-replenish/);
});
