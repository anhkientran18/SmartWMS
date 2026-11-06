// Controlled Axios/TanStack evidence; no real backend mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import axios from 'axios';
import { QueryClient, QueryClientProvider, QueryObserver, MutationObserver } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { inboundApi, receipt, receiveRequest, canReceive, canExecuteInbound, statusKey } from '../src/services/inbound/inboundApi';
import { inboundQueries, receiveMutationOptions, putawayMutationOptions } from '../src/services/inbound/inboundQueries';
import { inventoryQueries } from '../src/services/inventory/inventoryQueries';
import { createSubmissionGate } from '../src/services/inventory/replenishmentMutation';
import RealInbound, { InboundError } from '../src/features/inbound/RealInbound';
import RealOrders from '../src/features/orders/RealOrders';
import { outboundQueries } from '../src/services/outbound/outboundQueries';
import { httpClient } from '../src/services/api/httpClient';
import { sessionStore } from '../src/features/auth/session';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import vi from '../src/i18n/locales/vi.json';
globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
globalThis.document = { documentElement: { lang: '' } } as unknown as Document;
const id = '10000000-0000-0000-0000-000000000001';
const itemId = '20000000-0000-0000-0000-000000000001';
const productId = '30000000-0000-0000-0000-000000000001';
const sourceId = '40000000-0000-0000-0000-000000000001';
const destId = '50000000-0000-0000-0000-000000000001';
const value = { id, receiptNumber: 'PERSISTED-REF', status: 'Processing', supplierId: null, supplierName: '', binId: sourceId, expectedDeliveryDate: '2026-10-26T00:00:00', referenceDocument: '', notes: '', items: [{ id:itemId,productId,productName:'Persisted product',quantityExpected:10,quantityReceived:5,lotNumber:'LOT-A',expirationDate:null }] };
const body = receiveRequest(value, { [itemId]: 3 });
const transfer = { productId, sourceBinId:sourceId,destinationBinId:destId,transferQuantity:3,lotNumber:'LOT-A',reason:`INBOUND_PUTAWAY_${id}` };
const user = () => ({ token: `fixture.${btoa(JSON.stringify({exp:Date.now()/1000+3600}))}.unsigned`,role:'Admin' as const,username:'fixture',fullName:'' });
const response = (config, data, status=200) => ({config,data,status,headers:{},statusText:String(status)});
function ok(data: unknown) { sessionStore.set(user()); httpClient.defaults.adapter=async config=>response(config,{isSuccess:true,data}); }
function fail(status?: number) { httpClient.defaults.adapter=async config=>{throw new axios.AxiosError('controlled',undefined,config,undefined,status ? response(config,null,status) : undefined);}; }
const cache = () => new QueryClient({defaultOptions:{queries:{gcTime:0,retry:false},mutations:{gcTime:0}}});
const source = readFileSync('src/features/inbound/RealInbound.tsx','utf8');

test('list/detail retain real IDs, statuses, empty list and omitted list lines',async()=>{
  ok([{...value,binId:null,items:[]}]); assert.deepEqual(await inboundApi.list(),[{...value,binId:null,items:[]}]);
  ok(value); assert.deepEqual(await inboundApi.detail(id),value); ok([]); assert.deepEqual(await inboundApi.list(),[]);
  assert.equal(statusKey('Unexpected'),undefined); assert.equal(statusKey('Completed'),'completed');
});
test('malformed DTO and mismatched detail identities are rejected',async()=>{
  for(const invalid of [{...value,id:'SKU'}, {...value,items:null}, {...value,items:[{...value.items[0],quantityReceived:'5'}]}, {...value,items:[{...value.items[0],quantityReceived:11}]}]) {
    ok(invalid); await assert.rejects(inboundApi.detail(id),e=>e.code==='FE_INBOUND_CONTRACT');
  }
  ok({...value,id:destId});await assert.rejects(inboundApi.detail(id));
  ok({});await assert.rejects(inboundApi.list());
});
test('no fallback on API/network error',async()=>{
  sessionStore.set(user()); for(const status of [undefined,500,404]) {fail(status);await assert.rejects(inboundApi.list());await assert.rejects(inboundApi.detail(id));}
  assert.doesNotMatch(source,/\/api\/wms|setTimeout|Mock|mockProvider|putAwayQty/);
});
test('partial receiving exact delta and precondition, never cumulative',async()=>{
  assert.deepEqual(body,{inboundReceiptId:id,receivedItems:[{itemId,quantityReceived:3,expectedReceivedQuantity:5}]});
  sessionStore.set(user());httpClient.defaults.adapter=async config=>{
    assert.equal(config.url,'/api/v1/InboundReceipts/confirm-receipt');assert.equal(config.method,'post');assert.deepEqual(JSON.parse(config.data),body);assert.ok(config.headers.Authorization);
    return response(config,{isSuccess:true,data:true});};await inboundApi.receive(body);
  assert.equal(value.items[0].quantityReceived,5);
});
test('known receive validation and completed states',()=>{
  for(const n of [-1,0,6,1.5,NaN,Infinity]) assert.throws(()=>receiveRequest(value,{[itemId]:n}));
  assert.throws(()=>receiveRequest(value,{foreign:1}));assert.equal(canReceive({...value,status:'Completed'}),false);
  assert.equal(canReceive({...value,binId:null}),false);assert.equal(canReceive({...value,status:'Unknown'}),false);
});
test('receive and put-away require explicit dialog confirmation (source wiring)',()=>{
  assert.match(source,/if \(!confirmation \|\| !allowed \|\| busy \|\| fetching\) return/);
  assert.match(source,/dialog.current\?\.showModal/);assert.match(source,/open\(\{ kind: 'receive', body: receiveRequest\(latest, deltas\) \}\)/);
  assert.match(source,/await client.fetchQuery\(inboundQueries.detail\(r.id\)\)/);
  assert.match(source,/open\(\{ kind: 'putaway', body:/);assert.match(source,/onClick=\{\(\) => void confirm\(\)\}/);
  assert.match(source,/disabled=\{busy/);assert.match(source,/useIsMutating/);
});
test('same-tick duplicate submissions cause only one POST',async()=>{
  sessionStore.set(user());let done;let calls=0;httpClient.defaults.adapter=config=>{calls++;return new Promise(resolve=>{done=()=>resolve(response(config,{isSuccess:true,data:true}));});};
  const client=cache();const m=new MutationObserver(client,receiveMutationOptions(client));const gate=createSubmissionGate();const first=gate(()=>m.mutate(body));await gate(()=>m.mutate(body));await new Promise(r=>setImmediate(r));assert.equal(calls,1);done();await first;client.clear();
});
test('receive400 and403 remain errors;403 preserves session',async()=>{
  await i18n.changeLanguage('en-US');sessionStore.set(user());const owner=sessionStore.get();
  for(const status of [400,403]) {fail(status);await assert.rejects(inboundApi.receive(body),e=>{assert.equal(e.status,status);const html=renderToStaticMarkup(<InboundError error={e}/>);assert.ok(html.includes(status===403?en.f4.forbidden:en.f4.validation));return true;});assert.equal(sessionStore.get(),owner);}
});
test('protected401 remains owned by F1',async()=>{sessionStore.set(user());fail(401);await assert.rejects(inboundApi.receive(body));assert.equal(sessionStore.get(),null);});
async function verifyRefresh(kind:'receive'|'putaway', status?:number) {
  sessionStore.set(user());const client=cache();let reads=0;let posts=0;
  const keys=[inboundQueries.detail(id).queryKey,inboundQueries.list().queryKey,inventoryQueries.summary().queryKey,inventoryQueries.alerts().queryKey,inventoryQueries.history({pageIndex:1,pageSize:10}).queryKey,inventoryQueries.bins().queryKey,inventoryQueries.bin(sourceId).queryKey,inventoryQueries.contents(destId).queryKey];
  const stops=keys.map(queryKey=>{client.setQueryData(queryKey,0);const observer=new QueryObserver(client,{queryKey,queryFn:async()=>++reads,staleTime:Infinity});return observer.subscribe(()=>{});});
  const inactive=inventoryQueries.contents(sourceId).queryKey;client.setQueryData(inactive,0);
  httpClient.defaults.adapter=async config=>{posts++;if(status) throw new axios.AxiosError('controlled',undefined,config,undefined,response(config,null,status));return response(config,{isSuccess:true,data:kind==='receive'?true:destId});};
  const options=kind==='receive'?receiveMutationOptions(client):putawayMutationOptions(client);
  const m=new MutationObserver(client,options as any);
  if(status) await assert.rejects(m.mutate(kind==='receive'?body:transfer),e=>e.status===status);else await m.mutate(kind==='receive'?body:transfer);
  assert.equal(posts,1);assert.equal(reads,keys.length);assert.equal(client.getQueryState(inactive)?.isInvalidated,true);
  stops.forEach(stop=>stop());client.clear();
}
test('latest detail/list and affected F2 reads refresh after receive',()=>verifyRefresh('receive'));
test('receive409 distinct feedback and authoritative refetch without retry',async()=>{await verifyRefresh('receive',409);assert.match(renderToStaticMarkup(<InboundError error={{status:409}}/>),/Conflict/);});
test('suggestion is GET only with exact query and cancellable signal',async()=>{
  sessionStore.set(user());const signal=new AbortController().signal;const suggestion={binId:destId,binCode:'REAL-BIN',zoneName:'Persisted zone',availableSpaceBeforePutaway:7};
  httpClient.defaults.adapter=async config=>{assert.equal(config.method,'get');assert.equal(config.url,'/api/v1/InboundReceipts/putaway-suggestion');assert.deepEqual(config.params,{sku:'REAL-SKU',quantity:3});assert.equal(config.signal,signal);return response(config,{isSuccess:true,data:suggestion});};assert.deepEqual(await inboundApi.suggestion('REAL-SKU',3,signal),suggestion);
});
test('put-away exact transfer request; same-bin invalid',async()=>{
  sessionStore.set(user());httpClient.defaults.adapter=async config=>{assert.equal(config.method,'post');assert.equal(config.url,'/api/v1/InventoryTransfers');assert.deepEqual(JSON.parse(config.data),transfer);return response(config,{isSuccess:true,data:destId});};assert.equal(await inboundApi.putaway(transfer),destId);await assert.rejects(inboundApi.putaway({...transfer,destinationBinId:sourceId}));
});
test('put-away409 refetches reads without replay',()=>verifyRefresh('putaway',409));
test('put-away refreshes detail, summary, alerts, history, bin and contents keys',()=>verifyRefresh('putaway'));
test('invalid mutation successes never become confirmation',async()=>{ok(false);await assert.rejects(inboundApi.receive(body));ok('not-guid');await assert.rejects(inboundApi.putaway(transfer));});
test('all backend execution roles admitted; same-warehouse context required in UI',()=>{
  for(const role of ['Admin','WarehouseManager','Staff'])assert.equal(canExecuteInbound(role),true);assert.equal(canExecuteInbound('Other'),false);
  assert.match(source,/const validContext = contextAllowed &&/);assert.match(source,/sameWarehouse && quantity <= physical/);assert.match(source,/confirmation.kind === 'putaway' && !canPutaway/);
});
test('VI/EN parity, supported real UI and preservation of inbound in shared orders',async()=>{
  const keys=(o:any,p=''):string[]=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?keys(v,`${p}${k}.`):[p+k]);assert.deepEqual(keys(en.f4).sort(),keys(vi.f4).sort());
  assert.doesNotMatch(source,/LPN|cross.?dock|serial allocation|WaitingForPutaway|setReceiptStatus|setTimeout/i);
  // F4.5 production subtitles describe the workflow, without internal phase labels.
  for (const copy of [en.f4.scope, vi.f4.scope]) { assert.ok(copy.trim()); assert.doesNotMatch(copy, /F[0-9]|API|backend|deferred/i); }
  const app=readFileSync('src/app/App.tsx','utf8');const real=app.split('!isDemoMode ? <Routes>')[1].split('</Routes>')[0];assert.match(real,/OrderManagement/);assert.doesNotMatch(real,/CreateInboundVoucher|CreateOutboundVoucher/);
  const orders=readFileSync('src/features/orders/OrderManagement.tsx','utf8');assert.match(orders,/return isDemoMode \? <DemoOrderManagement \{\.\.\.props\} \/> : <RealOrders \/>/);
  for (const [language, labels] of [['vi-VN', vi], ['en-US', en]] as const) {
    await i18n.changeLanguage(language); sessionStore.set(user());
    const client=cache();
    client.setQueryData(inboundQueries.list().queryKey,[value]);
    client.setQueryData(outboundQueries.list({pageNumber:1,pageSize:10}).queryKey,{items:[],pageIndex:1,pageSize:10,totalCount:0,totalPages:0});
    client.setQueryData(outboundQueries.customers().queryKey,[]);
    for (const [route,title] of [['/dashboard/orders',labels.f4.title],['/dashboard/orders?flow=outbound',labels.f5.title]]) {
      const html=renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}><RealOrders /></MemoryRouter></QueryClientProvider>);
      assert.ok(html.includes(title));
      assert.equal(html.split(`aria-label="${labels.f5.orderFlows}"`).length-1,1);
      assert.ok(html.includes('aria-pressed="true"'));
      if (!route.includes('outbound')) assert.ok(html.includes('PERSISTED-REF'));
    }
    client.clear();
  }
  assert.match(source, /<InboundReceivingModal mode="api"/);assert.match(source, /<StatusBadge/);assert.match(source, /<KPICard/);assert.match(source, /remainingAfter/);
});
test('late mutation does not refresh another session cache',async()=>{sessionStore.set(user());const client=cache();const options=receiveMutationOptions(client);let calls=0;client.invalidateQueries=async()=>{calls++;};sessionStore.set(user());await options.onSuccess();assert.equal(calls,0);client.clear();});

test('enterprise list renders persisted reference and backend status in VI and EN without demo actions', async()=>{
  for (const [language, labels] of [['vi-VN', vi.f4], ['en-US', en.f4]] as const) {
    await i18n.changeLanguage(language);
    const client=cache();
    client.setQueryData(inboundQueries.list().queryKey,[{...value, status:'BackendUnknownState'}]);
    const html=renderToStaticMarkup(<QueryClientProvider client={client}><RealInbound /></QueryClientProvider>);
    assert.ok(html.includes('PERSISTED-REF'));assert.ok(html.includes('BackendUnknownState'));
    assert.ok(html.includes(labels.totalReceipts));assert.ok(html.includes(labels.expectedDate));
    assert.ok(html.includes(labels.detail));assert.ok(html.includes(labels.allStatuses));
    assert.doesNotMatch(html,/WaitingForPutaway|Put-away completed|Create outbound|Tạo phiếu xuất/);
    client.clear();
  }
});
