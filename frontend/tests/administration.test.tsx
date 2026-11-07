import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { adminRead, adminWrite, adminDelete, validAdminData } from '../src/services/administration/adminApi';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import { safeAuditValues } from '../src/features/administration/AuditLogWorkspace';
import i18n from '../src/i18n';

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
