// Small, resumable real-API demo setup. No database access, resets or global seed.
// Credentials are runtime environment variables only. Mutations are not retried.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const origin = process.env.SMARTWMS_DEMO_ORIGIN || 'http://localhost:5215';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local backend required');
const file = 'verification/f1/evidence/.f1-realistic-demo.json';
const record = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { batch: 'DEMO26', records: {}, calls: [], completed: false };
const save = () => writeFileSync(file, JSON.stringify(record, null, 2));
let token;
async function api(method, route, body) {
  let response;
  try { response = await fetch(`${origin}/api/v1/${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) }); }
  catch { record.calls.push({ method, route, status: null, uncertain: method !== 'GET' }); save(); throw new Error(`${method} ${route}: transport failure; inspect current state before resuming`); }
  const result = await response.json();
  record.calls.push({ method, route, status: response.status, code: result?.errorCode ?? result?.code ?? null }); save();
  if (!response.ok || result.isSuccess !== true) throw new Error(`${method} ${route}: HTTP${response.status} ${result?.errorCode ?? result?.code ?? ''} ${result?.message ?? result?.detail ?? ''}`);
  return result.data;
}
const login = await api('POST', 'Auth/login', { username: 'manager_demo', password: process.env.SMARTWMS_DEMO_MANAGER_PASSWORD });
assert.equal(login.role, 'WarehouseManager'); token = login.token;
const catalogs = {};
for (const resource of ['Warehouses', 'Zones', 'Bins', 'Suppliers', 'Products']) catalogs[resource] = await api('GET', `${resource}/list`);
async function master(key, resource, payload) {
  if (record.records[key]) return record.records[key].id;
  const codeField = resource === 'Products' ? 'sku' : 'code';
  const matches = catalogs[resource].filter(r => r[codeField] === payload[codeField]);
  if (matches.length > 1) throw new Error(`Ambiguous existing demo identity: ${payload[codeField]}`);
  let id;
  if (matches.length) {
    const existing = matches[0];
    assert.ok(resource === 'Bins' || resource === 'Zones' || existing.name?.startsWith('DEMO'), 'Existing non-demo record must not be overwritten');
    if (payload.warehouseId) assert.equal(existing.warehouseId, payload.warehouseId);
    if (payload.zoneId) assert.equal(existing.zoneId, payload.zoneId);
    id = existing.id;
  } else id = await api('POST', resource, payload);
  record.records[key] = { id, resource, ...payload }; save(); return id;
}
const id = key => record.records[key].id;
await master('warehouse', 'Warehouses', { code: 'DEMO26-THUDUC', name: 'DEMO · Trung tâm phân phối Thủ Đức', address: 'Khu logistics Thủ Đức, TP. Hồ Chí Minh — dữ liệu trình diễn' });
for (const [key, code, name] of [['zoneReceiving','DEMO26-RECV','DEMO · Khu tiếp nhận'], ['zoneDry','DEMO26-DRY','Khu Khô (Dry Zone)'], ['zonePicking','DEMO26-PICK','DEMO · Khu lấy hàng & đóng gói']]) await master(key, 'Zones', { code, name, warehouseId: id('warehouse') });
for (const [key, code, zone, capacity] of [['binReceiving','DEMO26-RECV-01','zoneReceiving',200], ['binBulk','DEMO26-BULK-A01','zoneDry',600], ['binPick','DEMO26-PICK-A01','zonePicking',20], ['binShip','DEMO26-PACK-A01','zonePicking',200], ['binKit','DEMO26-KIT-A01','zoneDry',100]]) await master(key, 'Bins', { code, zoneId: id(zone), maxCapacity: capacity, purpose: 0 });
for (const [key, code, name, email, phone] of [['supplierDrinks','DEMO26-SUP-MA','DEMO · Phân phối Minh An','minhan.demo@example.test','0901000001'], ['supplierMilk','DEMO26-SUP-DT','DEMO · Thực phẩm Đồng Tâm','dongtam.demo@example.test','0901000002'], ['supplierPack','DEMO26-SUP-AP','DEMO · Bao bì An Phúc','anphuc.demo@example.test','0901000003']]) await master(key,'Suppliers',{code,name,email,phone,address:'TP. Hồ Chí Minh — địa chỉ trình diễn'});
for (const [key, sku, name, unit, trackingMode, description] of [
  ['water','DEMO26-WATER-500','DEMO · Nước suối 500 ml (thùng 24 chai)','Thùng',0,'Nước uống đóng chai, bảo quản khô. Dữ liệu trình diễn.'],
  ['cashew','DEMO26-CASHEW-200','DEMO · Hạt điều rang 200 g','Hộp',0,'Hạt điều đóng hộp, bảo quản khô. Dữ liệu trình diễn.'],
  ['bag','DEMO26-GIFT-BAG','DEMO · Túi quà giấy kraft','Cái',0,'Bao bì cho bộ quà văn phòng. Dữ liệu trình diễn.'],
  ['milk','DEMO26-UHT-1L','DEMO · Sữa tiệt trùng 1 lít','Hộp',1,'Sữa UHT bảo quản ở nhiệt độ thường; quản lý lô và hạn dùng. Dữ liệu trình diễn.'],
  ['coffee','DEMO26-COFFEE-250','DEMO · Cà phê rang xay 250 g','Gói',0,'Gói cà phê dùng cho ví dụ tồn kho thấp. Dữ liệu trình diễn.'],
  ['kit','DEMO26-OFFICE-KIT','DEMO · Bộ quà văn phòng','Bộ',0,'Lắp ráp theo yêu cầu: 1 thùng nước + 1 hộp hạt điều + 1 túi giấy. Không phải BOM lưu trữ.'],
]) await master(key,'Products',{sku,barcode:sku,name,unit,trackingMode,description});
const today = `${new Date().toISOString().slice(0,10)}T00:00:00Z`;
const milkLot = { lotNumber: 'DEMO26-UHT-01', expirationDate: '2027-06-30T00:00:00Z' };
async function receipt(key, number, supplier, bin, items, received) {
  if (!record.records[key]) {
    const list = await api('GET', `InboundReceipts/list?searchKeyword=${encodeURIComponent(number)}`);
    const existing = list.filter(r => r.receiptNumber === number);
    assert.ok(existing.length <= 1, `Ambiguous receipt ${number}`);
    const payload = { receiptNumber:number, supplierId:id(supplier), binId:id(bin), expectedDeliveryDate:today, referenceDocument:`PO-${number}`, notes:`DEMO26 | ${key}`, items:items.map(([product, quantity])=>({productId:id(product),expectedQuantity:quantity,...(product === 'milk' ? milkLot : {lotNumber:'N/A',expirationDate:null})})) };
    let receiptId;
    if (existing.length) { const detail = await api('GET', `InboundReceipts/${existing[0].id}`); assert.equal(detail.notes,payload.notes); assert.equal(detail.binId,payload.binId); receiptId=detail.id; }
    else receiptId=await api('POST','InboundReceipts',payload);
    record.records[key]={id:receiptId,resource:'InboundReceipts',number,bin:id(bin),purpose:key}; save();
  }
  let detail=await api('GET',`InboundReceipts/${id(key)}`);
  const deltas=detail.items.flatMap(line=>{ const target=received === 'all' ? line.quantityExpected : (received[line.productId] ?? 0); return target>line.quantityReceived ? [{itemId:line.id,quantityReceived:target-line.quantityReceived,expectedReceivedQuantity:line.quantityReceived}] : []; });
  if(deltas.length) await api('POST','InboundReceipts/confirm-receipt',{inboundReceiptId:detail.id,receivedItems:deltas});
  detail=await api('GET',`InboundReceipts/${detail.id}`); record.records[key].status=detail.status; record.records[key].lines=detail.items.map(i=>({productId:i.productId,expected:i.quantityExpected,received:i.quantityReceived,lot:i.lotNumber,expiry:i.expirationDate})); save();
}
await receipt('receiptBulk','DEMO26-IN-001','supplierDrinks','binBulk',[['water',80],['cashew',40],['bag',40],['milk',30],['coffee',8]],'all');
await receipt('receiptShip','DEMO26-IN-002','supplierDrinks','binShip',[['water',20],['cashew',20]],'all');
await receipt('receiptPick','DEMO26-IN-003','supplierDrinks','binPick',[['water',3]],'all');
await receipt('receiptPartial','DEMO26-IN-004','supplierMilk','binReceiving',[['milk',50]],{[id('milk')]:20});
await receipt('receiptNew','DEMO26-IN-005','supplierDrinks','binReceiving',[['water',30],['cashew',10]],{});
if(!record.kittingCompleted) {
  const contents=await api('GET',`Bins/${id('binKit')}/contents`); const existing=contents.items.filter(i=>i.productId===id('kit')).reduce((n,i)=>n+i.quantity,0);
  if(existing===0) await api('POST','Kitting/assemble',{kitProductId:id('kit'),targetBinId:id('binKit'),assembleQuantity:3,components:['water','cashew','bag'].map(key=>({componentProductId:id(key),sourceBinId:id('binBulk'),quantityPerKit:1}))});
  else assert.ok(existing>=3,'Inspect partially prepared kit output before resuming');
  record.kittingCompleted=true; record.kitScenario={product:id('kit'),targetBin:id('binKit'),quantityPrepared:3,components:['water','cashew','bag'].map(k=>({product:id(k),sourceBin:id('binBulk'),quantityPerKit:1}))}; save();
}
async function order(key, number, product, quantity, target) {
  if(!record.records[key]) {
    const page=await api('GET',`OutboundOrders?pageNumber=1&pageSize=100&searchTerm=${encodeURIComponent(number)}`); const existing=page.items.filter(o=>o.orderNumber===number); assert.ok(existing.length<=1);
    const orderId=existing.length ? existing[0].id : await api('POST','OutboundOrders',{orderNumber:number,customerId:null,binId:id('binShip'),expectedShipDate:today,priority:key==='orderAllocated'?'High':'Normal',notes:`DEMO26 | ${key}`,items:[{productId:id(product),requestedQuantity:quantity}]});
    record.records[key]={id:orderId,resource:'OutboundOrders',number,target,product:id(product),quantity}; save();
  }
  const rank=['Pending','Allocated','Picked','Packed','Shipped'];
  for(let step=0;step<5;step++) {
    const current=await api('GET',`OutboundOrders/${id(key)}`); assert.equal(current.binId,id('binShip')); assert.ok(rank.includes(current.status));
    if(rank.indexOf(current.status)>=rank.indexOf(target)) { record.records[key].status=current.status; save(); return; }
    if(current.status==='Pending') await api('POST','OutboundOrders/allocate-pick-task',{outboundOrderId:current.id});
    else if(current.status==='Allocated') await api('POST',`OutboundOrders/${current.id}/pick`,{items:current.items.flatMap(i=>i.reservations.map(r=>({reservationId:r.id,quantity:r.quantity})))});
    else if(current.status==='Picked') await api('POST',`OutboundOrders/${current.id}/pack`);
    else if(current.status==='Packed') await api('POST',`OutboundOrders/${current.id}/ship`,{});
  }
}
await order('orderPending','DEMO26-OUT-001','water',4,'Pending');
await order('orderAllocated','DEMO26-OUT-002','cashew',5,'Allocated');
await order('orderPicked','DEMO26-OUT-003','water',2,'Picked');
await order('orderPacked','DEMO26-OUT-004','water',2,'Packed');
await order('orderShipped','DEMO26-OUT-005','cashew',3,'Shipped');
const assignees=await api('GET','CycleCounting/assignees'); const staff=assignees.find(u=>u.username==='staff_demo'); assert.ok(staff);
if(!record.records.countPending) { const countId=await api('POST','CycleCounting/create-sheet',{requestData:{binId:id('binKit'),zoneId:null,assignedUserId:staff.id,notes:'DEMO26 | Kiểm kê bộ quà văn phòng; nhập số thực đếm khi trình diễn'}}); record.records.countPending={id:countId,resource:'CycleCounting',assignedUserId:staff.id,binId:id('binKit')}; save(); }
const count=await api('GET',`CycleCounting/${id('countPending')}`); record.records.countPending.status=count.status; record.records.countPending.sheetNumber=count.sheetNumber;
record.inventory=[];
for(const key of ['binReceiving','binBulk','binPick','binShip','binKit']) { const content=await api('GET',`Bins/${id(key)}/contents`); record.inventory.push({binId:content.binId,binCode:content.binCode,occupancy:content.currentOccupancy,capacity:content.maxCapacity,items:content.items}); }
record.presentation={
  replenishment:'DEMO26-PICK-A01 starts with3 water units / capacity20 (15%); same-warehouse bulk donor has sufficient unreserved water. Global replenishment has deliberately NOT been executed by this dataset setup.',
  inbound:'DEMO26-IN-005 New; DEMO26-IN-004 partially received20/50; IN-001/002/003 fully received. Receiving recognizes physical stock.',
  outbound:'OUT-001 Pending, OUT-002 Allocated, OUT-003 Picked, OUT-004 Packed, OUT-005 Shipped. Advance only through the accepted B3 actions.',
  count:'Pending kit-bin count is assigned to staff_demo; no global listing/reassignment API was invented.',
  kit:'Three real kits already assembled from bulk components. A further1-unit request can demonstrate the same recipe in the normal UI.'
};
record.completed=true; record.completedAtUtc=new Date().toISOString(); save();
console.log(JSON.stringify({batch:record.batch,records:Object.entries(record.records).map(([key,r])=>({key,id:r.id,code:r.code||r.sku||r.number||r.sheetNumber,status:r.status})),calls:record.calls.length,completed:record.completed},null,2));
