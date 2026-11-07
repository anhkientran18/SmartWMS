// Real local HTTP rehearsal. Credentials are supplied only through process environment.
// Never run against a deployment: this creates identifiable local demo business records.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const origin = process.env.SMARTWMS_DEMO_ORIGIN || 'http://localhost:5215';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local backend required');
const evidencePath = 'verification/shared/evidence/.f1-sprint-real-local.json';
const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, 'utf8')) : { prefix: `DEMO-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Date.now().toString(36)}`, ids: {}, stages: {}, calls: [] };
const { ids, prefix } = evidence;
const save = () => writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
const tokens = {};
async function call(role, method, route, body, expected = 200) {
  const response = await fetch(`${origin}/api/v1/${route}`, { method, headers: { ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const raw = await response.text(); let result; try { result = JSON.parse(raw); } catch {}
  evidence.calls.push({ role, method, route, status: response.status, expected, success: response.status === expected, code: result?.errorCode ?? result?.code ?? null }); save();
  if (response.status !== expected) throw new Error(`${method} ${route}: ${response.status} ${result?.errorCode ?? result?.code ?? ''}`);
  if (expected !== 200) return result;
  assert.equal(result?.isSuccess, true, `${route}: success envelope`);
  return result.data;
}
async function create(key, resource, body) {
  if (!ids[key]) { ids[key] = await call('manager', 'POST', resource, body); save(); }
  return ids[key];
}
async function stage(name, action) {
  if (evidence.stages[name]?.success) { console.log(`${name}: previously verified`); return; }
  try { const detail = await action(); evidence.stages[name] = { success: true, detail }; console.log(`${name}: PASS`); }
  catch (e) { evidence.stages[name] = { success: false, error: e.message }; console.log(`${name}: BLOCKED ${e.message}`); }
  save();
}
for (const [role, username, password] of [['manager', 'manager_demo', process.env.SMARTWMS_DEMO_MANAGER_PASSWORD], ['staff', 'staff_demo', process.env.SMARTWMS_DEMO_STAFF_PASSWORD]]) {
  if (!password) throw new Error(`Missing ${role} runtime password`);
  const result = await call(null, 'POST', 'Auth/login', { username, password });
  assert.equal(result.role, role === 'manager' ? 'WarehouseManager' : 'Staff');
  assert.equal(result.username, username); tokens[role] = result.token;
  evidence.stages[`login-${role}`] = { success: true, username: result.username, role: result.role, fullName: result.fullName }; save();
}
await stage('role-boundaries', async () => {
  for (const route of ['Users', 'AuditLogs']) await call('manager', 'GET', route, undefined, 403);
  for (const route of ['Users', 'AuditLogs', 'Warehouses/list', 'Zones/list', 'Bins/list', 'Suppliers/list', 'CycleCounting/assignees']) await call('staff', 'GET', route, undefined, 403);
  await call('staff', 'POST', 'Inventory/run-auto-replenish', undefined, 403);
  await call('staff', 'GET', 'Inventory/stock-summary'); await call('staff', 'GET', 'Products/list');
  return 'Manager cannot access Admin resources; Staff management controls reject403 while permitted reads succeed.';
});
await stage('warehouse-zone-bin-administration', async () => {
  await create('warehouse', 'Warehouses', { code: `${prefix}-W`, name: `${prefix} Demo warehouse`, address: 'Local submission demo' });
  await create('zoneSource', 'Zones', { code: `${prefix}-ZS`, name: 'Demo source zone', warehouseId: ids.warehouse });
  await create('zoneTarget', 'Zones', { code: `${prefix}-ZT`, name: 'Demo target zone', warehouseId: ids.warehouse });
  for (const [key, suffix, zone] of [['binSource', 'BS', 'zoneSource'], ['binTarget', 'BT', 'zoneTarget']]) await create(key, 'Bins', { code: `${prefix}-${suffix}`, zoneId: ids[zone], maxCapacity: 1000, purpose: 0 });
  await call('manager', 'PUT', `Warehouses/${ids.warehouse}`, { id: ids.warehouse, code: `${prefix}-W`, name: `${prefix} Demo warehouse updated`, address: 'Local submission demo' });
  await call('manager', 'PUT', `Zones/${ids.zoneSource}`, { id: ids.zoneSource, code: `${prefix}-ZS`, name: 'Demo source zone updated' });
  await call('manager', 'PUT', `Bins/${ids.binTarget}`, { id: ids.binTarget, code: `${prefix}-BT`, maxCapacity: 1200, purpose: 0 });
  const w = await call('manager', 'GET', `Warehouses/${ids.warehouse}`); assert.equal(w.name, `${prefix} Demo warehouse updated`);
  const b = await call('manager', 'GET', `Bins/${ids.binTarget}`); assert.equal(b.zoneId, ids.zoneTarget); assert.equal(b.maxCapacity, 1200);
  await call('manager', 'DELETE', `Zones/${ids.zoneSource}`, undefined, 409);
  return { warehouse: ids.warehouse, source: ids.binSource, target: ids.binTarget, dependencyGuard: 409 };
});
await stage('supplier-administration', async () => {
  await create('supplier', 'Suppliers', { code: `${prefix}-S`, name: `${prefix} Demo supplier`, email: 'local.demo@example.test', phone: '0900000000', address: 'Local demo' });
  await call('manager', 'PUT', `Suppliers/${ids.supplier}`, { id: ids.supplier, code: `${prefix}-S`, name: `${prefix} Demo supplier updated`, email: 'local.demo@example.test', phone: '0900000001', address: 'Local demo' });
  const s = await call('manager', 'GET', `Suppliers/${ids.supplier}`); assert.equal(s.phone, '0900000001'); return { id: s.id };
});
await stage('demo-product-setup', async () => {
  for (const [key, suffix] of [['productA', 'A'], ['productB', 'B'], ['productKit', 'KIT']]) await create(key, 'Products', { sku: `${prefix}-${suffix}`, barcode: `${prefix}-${suffix}`, name: `${prefix} ${suffix}`, description: 'Clearly identifiable local submission demo', unit: 'Pcs', trackingMode: 0, width: 1, height: 1, depth: 1 });
  return 'None-tracked components/output created through Products API; no direct database writes.';
});
await stage('receipt-create-receive-transfer', async () => {
  const today = `${new Date().toISOString().slice(0,10)}T00:00:00Z`;
  await create('receipt', 'InboundReceipts', { receiptNumber: `${prefix}-IN`, supplierId: ids.supplier, binId: ids.binSource, expectedDeliveryDate: today, referenceDocument: prefix, notes: 'Local submission demo', items: [ids.productA, ids.productB].map(productId => ({ productId, expectedQuantity: 30, lotNumber: 'N/A', expirationDate: null })) });
  let receipt = await call('manager', 'GET', `InboundReceipts/${ids.receipt}`);
  const remaining = receipt.items.filter(i => i.quantityReceived < i.quantityExpected);
  if (remaining.length) await call('manager', 'POST', 'InboundReceipts/confirm-receipt', { inboundReceiptId: ids.receipt, receivedItems: remaining.map(i => ({ itemId: i.id, quantityReceived: i.quantityExpected - i.quantityReceived, expectedReceivedQuantity: i.quantityReceived })) });
  receipt = await call('manager', 'GET', `InboundReceipts/${ids.receipt}`); assert.equal(receipt.status, 'Completed');
  if (!ids.transfer) { ids.transfer = await call('manager', 'POST', 'InventoryTransfers', { productId: ids.productA, sourceBinId: ids.binSource, destinationBinId: ids.binTarget, transferQuantity: 20, lotNumber: 'N/A', reason: `${prefix} put-away` }); save(); }
  const contents = await call('manager', 'GET', `Bins/${ids.binTarget}/contents`); assert.ok(contents.items.some(i => i.productId === ids.productA && i.quantity === 20));
  const list = await call('manager', 'GET', 'InboundReceipts/list'); assert.ok(list.some(r => r.id === ids.receipt));
  await call('manager', 'DELETE', `Suppliers/${ids.supplier}`, undefined, 400);
  await call('manager', 'DELETE', `Bins/${ids.binTarget}`, undefined, 400);
  return { receipt: ids.receipt, status: receipt.status, transfer: ids.transfer };
});
await stage('outbound-direct-pick-pack-ship', async () => {
  await create('outbound', 'OutboundOrders', { orderNumber: `${prefix}-OUT`, customerId: null, binId: ids.binTarget, expectedShipDate: new Date().toISOString(), priority: 'Normal', notes: 'Local submission demo', items: [{ productId: ids.productA, requestedQuantity: 3 }] });
  let order = await call('manager', 'GET', `OutboundOrders/${ids.outbound}`);
  if (order.status === 'Pending') await call('manager', 'POST', 'OutboundOrders/allocate-pick-task', { outboundOrderId: ids.outbound });
  order = await call('manager', 'GET', `OutboundOrders/${ids.outbound}`);
  if (order.status === 'Allocated') await call('manager', 'POST', `OutboundOrders/${ids.outbound}/pick`, { items: order.items.flatMap(l => l.reservations.map(r => ({ reservationId: r.id, quantity: r.quantity }))) });
  order = await call('manager', 'GET', `OutboundOrders/${ids.outbound}`);
  if (order.status === 'Picked') await call('manager', 'POST', `OutboundOrders/${ids.outbound}/pack`);
  order = await call('manager', 'GET', `OutboundOrders/${ids.outbound}`);
  if (order.status === 'Packed') await call('manager', 'POST', `OutboundOrders/${ids.outbound}/ship`, {});
  order = await call('manager', 'GET', `OutboundOrders/${ids.outbound}`); assert.equal(order.status, 'Shipped');
  return { id: order.id, status: order.status, picked: order.items[0].pickedQuantity, shipped: order.items[0].shippedQuantity };
});
await stage('request-defined-kit-assembly', async () => {
  await call('manager', 'POST', 'Kitting/assemble', { kitProductId: ids.productKit, targetBinId: ids.binTarget, assembleQuantity: 2, components: [{ componentProductId: ids.productA, sourceBinId: ids.binTarget, quantityPerKit: 1 }, { componentProductId: ids.productB, sourceBinId: ids.binSource, quantityPerKit: 1 }] });
  const contents = await call('manager', 'GET', `Bins/${ids.binTarget}/contents`); assert.ok(contents.items.some(i => i.productId === ids.productKit && i.quantity === 2));
  return { kit: ids.productKit, assembledQuantity: 2 };
});
await stage('assigned-cycle-count', async () => {
  const assignees = await call('manager', 'GET', 'CycleCounting/assignees'); const staff = assignees.find(a => a.username === 'staff_demo'); assert.ok(staff); ids.staff = staff.id;
  if (!ids.count) { ids.count = await call('manager', 'POST', 'CycleCounting/create-sheet', { requestData: { binId: ids.binTarget, zoneId: null, assignedUserId: staff.id, notes: prefix } }); save(); }
  const sheet = await call('staff', 'GET', `CycleCounting/${ids.count}`); assert.equal(sheet.assignedUserId, staff.id);
  if (['Pending', 'Counting'].includes(sheet.status)) {
    const pending = await call('staff', 'GET', 'CycleCounting/pending-tasks'); assert.ok(pending.some(t => t.countSheetId === sheet.id));
    await call('staff', 'POST', 'CycleCounting/confirm', { countSheetId: sheet.id, notes: 'Demo matched physical count', countedItems: sheet.items.map(i => ({ itemId: i.id, countedQuantity: i.systemQuantity })) });
  }
  const complete = await call('staff', 'GET', `CycleCounting/${ids.count}`); assert.equal(complete.status, 'Completed'); return { id: complete.id, status: complete.status };
});
await stage('replenishment-and-dashboard-reads', async () => {
  const movements = await call('manager', 'POST', 'Inventory/run-auto-replenish'); assert.ok(Number.isInteger(movements) && movements >= 0);
  const chart = await call('manager', 'GET', 'Dashboard/inbound-outbound-chart?days=7'); assert.equal(chart.length, 7);
  const occupancy = await call('manager', 'GET', 'Dashboard/warehouse-occupancy'); assert.ok(occupancy.some(w => w.warehouseId === ids.warehouse));
  await call('manager', 'GET', 'Inventory/stock-summary'); await call('manager', 'GET', 'Inventory/low-stock-alerts'); await call('manager', 'GET', 'Inventory/stock-history?pageIndex=1&pageSize=20');
  return { movements, chartDays: chart.length };
});
await stage('product-qr-barcode', async () => {
  const product = await call('staff', 'GET', `Products/${ids.productA}`); const qr = await call('staff', 'GET', `Products/${encodeURIComponent(product.sku)}/qrcode`); assert.ok(qr.startsWith('data:image/png;base64,'));
  const parsed = await call('staff', 'POST', 'Products/parse-barcode', { rawBarcodeData: product.barcode }); assert.equal(parsed.productId, product.id); return { product: product.id, qrReadable: true, barcodeResolved: true };
});
console.log(JSON.stringify({ prefix, stages: evidence.stages, ids, calls: evidence.calls.length }, null, 2));
process.exitCode = Object.values(evidence.stages).some(s => !s.success) ? 1 : 0;
