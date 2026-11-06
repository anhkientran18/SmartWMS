// Controlled frontend tests only: no ASP.NET server, database, credentials or real JWTs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { httpClient, normalizeApiError } from '../src/services/api/httpClient';
import { login, logout } from '../src/features/auth/authApi';
import { SESSION_KEY, sessionStore, validSession } from '../src/features/auth/session';
import { bindAuthLifecycle } from '../src/features/auth/AuthProvider';

const values = new Map<string, string>();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => { values.set(key, value); },
  removeItem: key => { values.delete(key); },
  clear: () => values.clear(), key: index => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
const token = (exp = Date.now() / 1000 + 3600) => `test.${btoa(JSON.stringify({ exp }))}.unsigned`;
const user = () => ({ token: token(), username: 'contract-user', role: 'WarehouseManager' as const, fullName: '' });
const response = (config, data, status = 200) => ({ config, data, status, statusText: String(status), headers: {} });
const reject = (config, status, data?) => Promise.reject(new axios.AxiosError('controlled failure', undefined, config, undefined, response(config, data, status)));

test('login uses the exact contract, ignores legacy keys and establishes only canonical identity', async () => {
  values.set('token', 'legacy-token');
  const expected = user();
  httpClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/Auth/login');
    assert.equal(config.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(config.data), { username: 'input-user', password: 'input-password' });
    return response(config, { isSuccess: true, data: expected });
  };
  assert.deepEqual(await login({ username: 'input-user', password: 'input-password' }), expected);
  assert.deepEqual(JSON.parse(values.get(SESSION_KEY)!), expected);
  assert.equal(validSession({ ...expected, role: 'Manager' }), false);
  assert.equal(validSession({ ...expected, token: token(1) }), false);
});
test('invalid login and a failed Result never establish a session', async () => {
  sessionStore.set(null);
  httpClient.defaults.adapter = config => reject(config, 401, { isSuccess: false, errorCode: 'AUTH_401', message: 'Invalid credentials' });
  await assert.rejects(login({ username: 'wrong', password: 'wrong' }), error => error.code === 'AUTH_401' && error.message === 'Invalid credentials');
  assert.equal(sessionStore.get(), null);
  httpClient.defaults.adapter = async config => response(config, { isSuccess: false, message: 'Rejected' });
  await assert.rejects(login({ username: 'wrong', password: 'wrong' }));
  assert.equal(sessionStore.get(), null);
});
test('malformed login responses and unsupported roles fail closed', async () => {
  for (const data of [{}, { isSuccess: true, data: { ...user(), role: 'Manager' } }, { isSuccess: true, data: { ...user(), token: 'invalid' } }]) {
    httpClient.defaults.adapter = async config => response(config, data);
    await assert.rejects(login({ username: 'input', password: 'input' }));
    assert.equal(sessionStore.get(), null);
  }
});
test('bodyless protected GET attaches canonical Bearer and supports AbortSignal', async () => {
  const session = user(); sessionStore.set(session);
  const controller = new AbortController();
  httpClient.defaults.adapter = async config => {
    assert.equal(config.headers.Authorization, `Bearer ${session.token}`);
    assert.equal(config.data, undefined);
    assert.equal(config.signal, controller.signal);
    return response(config, { isSuccess: true, data: { totalProducts: 0, totalQuantity: 0, lowStockItems: 0 } });
  };
  const result = await httpClient.get('/api/v1/Inventory/stock-summary', { signal: controller.signal });
  assert.equal(result.data.data.totalQuantity, 0);
});
test('403 retains session and cache; protected 401 clears both private caches', async () => {
  const client = new QueryClient(); const stop = bindAuthLifecycle(client);
  const session = user(); sessionStore.set(session);
  client.setQueryData(['private'], { private: true });
  client.getMutationCache().build(client, { mutationKey: ['private'] });
  httpClient.defaults.adapter = config => reject(config, 403);
  await assert.rejects(httpClient.get('/api/v1/Inventory/stock-summary'), error => error.isForbidden && !error.isAuthError);
  assert.equal(sessionStore.get(), session);
  assert.ok(client.getQueryData(['private']));
  httpClient.defaults.adapter = config => reject(config, 401);
  await assert.rejects(httpClient.get('/api/v1/Inventory/stock-summary'), error => error.isAuthError);
  assert.equal(sessionStore.get(), null);
  assert.equal(values.get(SESSION_KEY), undefined);
  assert.equal(client.getQueryCache().getAll().length, 0);
  assert.equal(client.getMutationCache().getAll().length, 0);
  assert.equal(sessionStore.getReason(), 'expired'); stop();
});
test('late protected 401 cannot invalidate a newer session', async () => {
  const old = user(); sessionStore.set(old);
  httpClient.defaults.adapter = async config => {
    sessionStore.set({ ...user(), username: 'new-user', token: token(Date.now() / 1000 + 7200) });
    return reject(config, 401);
  };
  await assert.rejects(httpClient.get('/api/v1/Inventory/stock-summary'));
  assert.equal(sessionStore.get()?.username, 'new-user');
});
test('session changes cancel an in-flight private query before another user can reuse it', async () => {
  const client = new QueryClient(); const stop = bindAuthLifecycle(client);
  sessionStore.set(user());
  let requestSignal: AbortSignal | undefined;
  const pending = client.fetchQuery({ queryKey: ['private', 'pending'], queryFn: ({ signal }) => {
    requestSignal = signal;
    return new Promise(() => {});
  } }).catch(() => undefined);
  assert.equal(requestSignal?.aborted, false);
  sessionStore.set(null, 'logout');
  assert.equal(requestSignal?.aborted, true);
  await pending;
  assert.equal(client.getQueryCache().getAll().length, 0); stop();
});
test('logout immediately clears session/cache even when backend fails, sends captured token', async () => {
  const client = new QueryClient(); const stop = bindAuthLifecycle(client);
  const session = user(); sessionStore.set(session); client.setQueryData(['private'], 10);
  httpClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/Auth/logout');
    assert.equal(config.headers.Authorization, `Bearer ${session.token}`);
    assert.deepEqual(JSON.parse(config.data), { token: session.token });
    assert.equal(sessionStore.get(), null);
    return reject(config, 500);
  };
  const request = logout();
  assert.equal(sessionStore.get(), null);
  assert.equal(client.getQueryCache().getAll().length, 0);
  await assert.rejects(request); stop();
});
test('expired JWT clears state without issuing a protected request', async () => {
  sessionStore.set({ ...user(), token: token(1) });
  httpClient.defaults.adapter = async () => { assert.fail('must not send an expired JWT'); };
  await assert.rejects(httpClient.get('/api/v1/Inventory/stock-summary'), error => error.status === 401);
  assert.equal(sessionStore.get(), null);
});
test('expiry lifecycle clears cached data and network/cancellation stay truthful', async () => {
  const client = new QueryClient(); const stop = bindAuthLifecycle(client);
  sessionStore.set({ ...user(), token: token(Date.now() / 1000 + 0.04) });
  client.setQueryData(['private'], 'secret');
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(sessionStore.get(), null);
  assert.equal(client.getQueryData(['private']), undefined); stop();
  httpClient.defaults.adapter = async config => { throw new axios.AxiosError('Network Error', 'ERR_NETWORK', config); };
  await assert.rejects(httpClient.get('/api/v1/Inventory/stock-summary'), error => error.status === undefined && !!error.message);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(httpClient.get('/api/v1/Inventory/stock-summary', { signal: abort.signal }), axios.isCancel);
});
test('error normalization preserves structured codes/detail and distinguishes all required statuses', () => {
  for (const status of [400, 401, 403, 404, 409, 500, 502, 503, 504]) {
    const error = normalizeApiError(status, { code: 'TEST_CODE', detail: 'Backend detail', errors: { field: ['invalid'] } });
    assert.equal(error.status, status); assert.equal(error.code, 'TEST_CODE');
    assert.equal(error.message, 'Backend detail'); assert.deepEqual(error.errors, { field: ['invalid'] });
    assert.equal(error.isAuthError, status === 401); assert.equal(error.isForbidden, status === 403);
    assert.ok(normalizeApiError(status).message);
  }
});
