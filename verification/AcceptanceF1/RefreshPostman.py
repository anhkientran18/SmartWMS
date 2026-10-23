"""Read and refresh the existing WORKING collection; output review copies under obj/F1.
No credentials, existing business IDs, saved response evidence or external writes.
"""
import copy, json, pathlib, re, sys
from AnnotatePostman import annotate
root = pathlib.Path(__file__).resolve().parents[2]
original = pathlib.Path(sys.argv[1])
environment = pathlib.Path(sys.argv[2])
out = root / 'obj/F1/postman'; out.mkdir(parents=True, exist_ok=True)
c = json.loads(original.read_text(encoding='utf-8-sig'))
e = json.loads(environment.read_text(encoding='utf-8-sig'))
def flatten(items):
    for i in items:
        if 'request' in i: yield i
        yield from flatten(i.get('item', []))
old = list(flatten(c['item']))
def norm(url):
    if isinstance(url, dict): url = url['raw']
    url = re.sub(r'^\{\{[^}]+\}\}', '', url).split('?')[0]
    url = re.sub(r'\{\{[^}]+\}\}', '{id}', url)
    return re.sub(r'\{[^}]+\}', '{id}', url).lower()
lookup = {(i['request']['method'], norm(i['request']['url'])):i for i in old}
folders = []
def folder(name):
    f = {'name':name,'item':[]}; folders.append(f); return f['item']
def add(f, method, path, body=None, capture=None, js='', name=None, expected=200, ai=False, binary=False, pre='', upload=None):
    i = copy.deepcopy(lookup.get((method,norm(path)), {}))
    i['name'] = name or method+' '+path
    i['response'] = []
    req = {'method':method,'header':[], 'url':'{{baseUrl}}'+path,
           'description':'F1 runtime assertions; saved examples are not evidence. Run from Authentication in order on an isolated local fixture server.'}
    if body is not None:
        req['header']=[{'key':'Content-Type','value':'application/json'}]
        raw = json.dumps(body, ensure_ascii=False) if not isinstance(body,str) else body
        req['body']={'mode':'raw','raw':raw,'options':{'raw':{'language':'json'}}}
    if upload:
        req['body']={'mode':'formdata','formdata':[{'key':'file','type':'file','src':'verification/AcceptanceF1/fixtures/'+upload}]}
        req['description'] += ' Newman workingDir must be repository root. In Desktop Postman select the named repository fixture if local file access is restricted.'
    if path.endswith('/Auth/login'): req['auth']={'type':'noauth'}
    i['request']=req
    script = [f'const expected = {expected};',
              'pm.test("HTTP expected contract", () => pm.expect(pm.response.code).eq(expected));']
    if ai:
        script = ['if ([502,503,504].includes(pm.response.code)) {',
                  ' pm.test("EXTERNAL DEPENDENCY BLOCKED: live happy path required", () => pm.expect.fail("Provider unavailable HTTP "+pm.response.code));',
                  '} else {']+script
    if binary:
        script += ['pm.test("XLSX bytes", () => pm.expect(pm.response.text().slice(0,2)).eq("PK"));']
    elif expected == 200:
        script += ['const j=pm.response.json(); const d=j.data; const cv=pm.collectionVariables;',
                   'pm.test("Result success and payload", () => {pm.expect(j.isSuccess).eq(true); pm.expect(j.data === undefined ? j.analysis : j.data).not.eq(undefined);});']
        if capture:
            script += [f'const id=typeof d==="string"?d:d.id; pm.test("Created ID",()=>pm.expect(id).match(/^[a-f0-9-]{{36}}$/i)); cv.set("{capture}",id);']
        script += js.splitlines()
    else:
        script += ['pm.test("Safe rejection",()=> {const s=pm.response.text(); pm.expect(s).not.include("StackTrace"); pm.expect(s).not.include("AIza");});']
    if ai: script += ['}']
    i['event']=[{'listen':'test','script':{'type':'text/javascript','exec':script}}]
    if pre: i['event'].insert(0,{'listen':'prerequest','script':{'type':'text/javascript','exec':pre.splitlines()}})
    f.append(i); return i

f=folder('01 Authentication — start a new isolated fixture run')
add(f,'POST','/api/v1/Auth/login',{'username':'{{username}}','password':'{{password}}'},js='pm.test("JWT",()=>pm.expect(d.token).to.be.a("string").and.have.length.above(20)); cv.set("token",d.token);', pre='''const cv=pm.collectionVariables;
for (const k of Object.keys(cv.toObject())) cv.unset(k);
const p="F1_"+Date.now().toString(36)+"_"+pm.variables.replaceIn("{{$guid}}").slice(0,8);
cv.set("prefix",p); cv.set("productSku",p+"_P"); cv.set("lotNumber",p+"_LOT");
cv.set("futureDate",new Date(Date.now()+7*86400000).toISOString());
cv.set("expiry",new Date(Date.now()+365*86400000).toISOString());
cv.set("fixturePassword","F1!"+pm.variables.replaceIn("{{$guid}}"));''')
f=folder('02 Users — disposable API fixture')
user={'username':'{{prefix}}_user','email':'{{prefix}}@example.invalid','password':'{{fixturePassword}}','firstName':'F1','lastName':'Fixture','role':'Staff'}
add(f,'POST','/api/v1/Users',user,'userId')
for path in ['/api/v1/Users/list','/api/v1/Users','/api/v1/Users/{{userId}}']: add(f,'GET',path)
add(f,'PUT','/api/v1/Users/{{userId}}',{'id':'{{userId}}','firstName':'F1Updated','lastName':'Fixture','role':'Staff','isActive':True})

f=folder('03 Warehouse / Zone / Bins')
wh={'code':'{{prefix}}_W','name':'{{prefix}} Warehouse','address':'Fixture'}
add(f,'POST','/api/v1/Warehouses',wh,'warehouseId')
for p in ['/api/v1/Warehouses/list','/api/v1/Warehouses','/api/v1/Warehouses/{{warehouseId}}']: add(f,'GET',p)
add(f,'PUT','/api/v1/Warehouses/{{warehouseId}}',dict(wh,id='{{warehouseId}}'))
zone={'code':'{{prefix}}_Z','name':'Khu Khô (Dry Zone)','warehouseId':'{{warehouseId}}'}
add(f,'POST','/api/v1/Zones',zone,'zoneId')
for p in ['/api/v1/Zones/list','/api/v1/Zones','/api/v1/Zones/warehouse/{{warehouseId}}']: add(f,'GET',p)
add(f,'PUT','/api/v1/Zones/{{zoneId}}',dict(zone,id='{{zoneId}}'))
def binbody(suffix,cap): return {'code':'{{prefix}}_'+suffix,'zoneId':'{{zoneId}}','purpose':0,'width':10,'height':10,'depth':10,'maxCapacity':cap}
for suffix,cap,var in [('SOURCE',500,'sourceBinId'),('TARGET',10,'destinationBinId'),('KIT',100,'kitBinId')]:
    add(f,'POST','/api/v1/Bins',binbody(suffix,cap),var)
for p in ['/api/v1/Bins/list','/api/v1/Bins','/api/v1/Bins/{{sourceBinId}}','/api/v1/Bins/{{sourceBinId}}/contents']: add(f,'GET',p)
add(f,'PUT','/api/v1/Bins/{{kitBinId}}',dict(binbody('KIT',100),id='{{kitBinId}}'))

f=folder('04 Product / Supplier / Customer')
def product(suffix): return {'sku':'{{productSku}}'+suffix,'barcode':'{{productSku}}'+suffix,'name':'F1 warehouse component '+suffix,'description':'Warehouse stock component for fixture acceptance','unit':'Pcs','trackingMode':1,'width':1,'height':1,'depth':1}
add(f,'POST','/api/v1/Products',product(''),'productId', ai=True)
add(f,'POST','/api/v1/Products',product('_KIT'),'kitProductId',ai=True)
for p in ['/api/v1/Products/list','/api/v1/Products','/api/v1/Products/{{productId}}','/api/v1/Products/{{productSku}}/qrcode']: add(f,'GET',p)
add(f,'PUT','/api/v1/Products/{{productId}}',dict(product(''),id='{{productId}}'))
add(f,'POST','/api/v1/Products/parse-barcode',{'rawBarcodeData':'{{productSku}}'})
supplier={'code':'{{prefix}}_SUP','name':'F1 Supplier','email':'{{prefix}}_sup@example.invalid','phone':'0900000000','address':'Fixture'}
customer={'code':'{{prefix}}_CUS','name':'F1 Customer','email':'{{prefix}}_cus@example.invalid','phone':'0900000000','deliveryAddress':'Fixture'}
for group,b,var in [('Suppliers',supplier,'supplierId'),('Customers',customer,'customerId')]:
    add(f,'POST',f'/api/v1/{group}',b,var)
    for p in [f'/api/v1/{group}/list',f'/api/v1/{group}',f'/api/v1/{group}/{{{{{var}}}}}']: add(f,'GET',p)
    add(f,'PUT',f'/api/v1/{group}/{{{{{var}}}}}',dict(b,id='{{'+var+'}}'))

f=folder('05 Inbound — GET detail captures optimistic receive items')
inbound={'receiptNumber':'{{prefix}}_IN','supplierId':'{{supplierId}}','binId':'{{sourceBinId}}','expectedDeliveryDate':'{{futureDate}}','referenceDocument':'{{prefix}}','notes':'F1','items':[{'productId':'{{productId}}','expectedQuantity':120,'lotNumber':'{{lotNumber}}','expirationDate':'{{expiry}}'}]}
add(f,'POST','/api/v1/InboundReceipts',inbound,'inboundReceiptId')
add(f,'GET','/api/v1/InboundReceipts/{{inboundReceiptId}}',js='''pm.test("Inbound items",()=>pm.expect(d.items).to.have.length(1));
cv.set("inboundItemId",d.items[0].id);
cv.set("receiveItems",JSON.stringify(d.items.map(x=>({itemId:x.id,quantityReceived:x.quantityExpected-x.quantityReceived,expectedReceivedQuantity:x.quantityReceived}))));''')
add(f,'POST','/api/v1/InboundReceipts/confirm-receipt','{"inboundReceiptId":"{{inboundReceiptId}}","receivedItems":{{receiveItems}}}')
add(f,'GET','/api/v1/InboundReceipts/{{inboundReceiptId}}',js='pm.test("Fully received",()=>pm.expect(d.items.every(x=>x.quantityReceived===x.quantityExpected)).eq(true));',name='Verify received quantities')
for p in ['/api/v1/InboundReceipts/list','/api/v1/InboundReceipts','/api/v1/InboundReceipts/putaway-suggestion?sku={{productSku}}&quantity=1']: add(f,'GET',p)
# An unused draft permits update/delete without changing received identity.
add(f,'POST','/api/v1/InboundReceipts',dict(inbound,receiptNumber='{{prefix}}_DRAFT'),'draftReceiptId')
add(f,'PUT','/api/v1/InboundReceipts/{{draftReceiptId}}',{'id':'{{draftReceiptId}}','binId':'{{sourceBinId}}','supplierId':'{{supplierId}}','expectedDeliveryDate':'{{futureDate}}','referenceDocument':'{{prefix}}','notes':'Updated','items':[{'productId':'{{productId}}','expectedQuantity':1}]})
add(f,'DELETE','/api/v1/InboundReceipts/{{draftReceiptId}}')

f=folder('06 Inventory / Transfer')
for p in ['/api/v1/Inventory/stock-summary','/api/v1/Inventory/low-stock-alerts','/api/v1/Inventory/stock-history']: add(f,'GET',p)
add(f,'POST','/api/v1/Inventory/adjust-stock',{'binId':'{{sourceBinId}}','productId':'{{productId}}','lotNumber':'{{lotNumber}}','adjustmentQuantity':1,'reasonCode':'{{prefix}}_ADJUST'})
add(f,'POST','/api/v1/Inventory/change-status',{'binId':'{{sourceBinId}}','productId':'{{productId}}','lotNumber':'{{lotNumber}}','newStatus':1,'reasonCode':'{{prefix}}_STATUS'})
add(f,'POST','/api/v1/InventoryTransfers',{'sourceBinId':'{{sourceBinId}}','destinationBinId':'{{destinationBinId}}','productId':'{{productId}}','lotNumber':'{{lotNumber}}','transferQuantity':1,'reason':'{{prefix}}'},'transferId')
for p in ['/api/v1/InventoryTransfers/list','/api/v1/InventoryTransfers','/api/v1/InventoryTransfers/{{transferId}}']: add(f,'GET',p)
add(f,'GET','/api/v1/Bins/{{sourceBinId}}/contents',js='''cv.set("stockIdentities",JSON.stringify(d.items.map(x=>({productId:x.productId,lotNumber:x.lotNumber,binId:d.binId}))));''',name='Capture stock business identities (contents DTO omits inventory PK)')
f=folder('07 Cycle Count — detail supplies all count item IDs')
add(f,'POST','/api/v1/CycleCounting/create-sheet',{'requestData':{'binId':'{{sourceBinId}}','notes':'{{prefix}}'}},'cycleCountSheetId')
add(f,'GET','/api/v1/CycleCounting/{{cycleCountSheetId}}',js='cv.set("countedItems",JSON.stringify(d.items.map(x=>({itemId:x.id,countedQuantity:x.systemQuantity})))); cv.set("countItemIds",JSON.stringify(d.items.map(x=>x.id)));')
add(f,'GET','/api/v1/CycleCounting/pending-tasks')
add(f,'POST','/api/v1/CycleCounting/confirm','{"countSheetId":"{{cycleCountSheetId}}","notes":"F1 zero variance","countedItems":{{countedItems}}}')
f=folder('08 Kitting K1')
add(f,'POST','/api/v1/Kitting/assemble',{'kitProductId':'{{kitProductId}}','targetBinId':'{{kitBinId}}','assembleQuantity':2,'components':[{'componentProductId':'{{productId}}','sourceBinId':'{{sourceBinId}}','quantityPerKit':2}]})
add(f,'GET','/api/v1/Bins/{{kitBinId}}/contents',name='Verify K1 kit output',js='pm.test("Kit stock exists",()=>pm.expect(JSON.stringify(d)).include(cv.get("kitProductId")));')
f=folder('09 AutoReplenishment R1')
add(f,'POST','/api/v1/Inventory/run-auto-replenish',{},js='pm.test("Refill movement count",()=>pm.expect(d).to.be.a("number").and.be.above(0));')
add(f,'POST','/api/v1/Inventory/run-auto-replenish',{},js='pm.test("No duplicate refill",()=>pm.expect(d).eq(0));',name='R1 repeat rechecks live capacity')
f=folder('10 Outbound B3 whole order direct pick')
ob={'orderNumber':'{{prefix}}_OUT','customerId':'{{customerId}}','binId':'{{sourceBinId}}','expectedShipDate':'{{futureDate}}','priority':'Normal','notes':'F1 B3','items':[{'productId':'{{productId}}','requestedQuantity':3}]}
add(f,'POST','/api/v1/OutboundOrders',ob,'outboundOrderId')
add(f,'PUT','/api/v1/OutboundOrders/{{outboundOrderId}}',dict(ob,id='{{outboundOrderId}}'))
for p in ['/api/v1/OutboundOrders/list','/api/v1/OutboundOrders']: add(f,'GET',p)
add(f,'POST','/api/v1/OutboundOrders/allocate-pick-task',{'outboundOrderId':'{{outboundOrderId}}'})
add(f,'GET','/api/v1/OutboundOrders/{{outboundOrderId}}',js='''const reservations=d.items.flatMap(x=>x.reservations||[]); pm.test("Allocated reservations",()=>pm.expect(reservations.length).above(0));
cv.set("outboundItemIds",JSON.stringify(d.items.map(x=>x.id))); cv.set("pickItems",JSON.stringify(reservations.map(x=>({reservationId:x.id,quantity:x.quantity}))));
cv.set("inventoryIds",JSON.stringify(reservations.map(x=>x.sourceBinInventoryId)));cv.set("allocationIds",JSON.stringify(reservations.map(x=>x.allocationId)));cv.set("reservationIds",JSON.stringify(reservations.map(x=>x.id)));''')
add(f,'POST','/api/v1/OutboundOrders/{{outboundOrderId}}/pick','{"items":{{pickItems}}}')
add(f,'POST','/api/v1/OutboundOrders/{{outboundOrderId}}/pack',{})
add(f,'POST','/api/v1/OutboundOrders/{{outboundOrderId}}/ship',{})
add(f,'GET','/api/v1/OutboundOrders/{{outboundOrderId}}',js='pm.test("Shipped terminal state",()=>pm.expect(String(d.status).toLowerCase()).eq("shipped"));',name='Verify B3 shipped')
add(f,'GET','/api/v1/Inventory/stock-history?productId={{productId}}&pageSize=100',js='''const rows=d.items||d.data||[]; cv.set("transactionIds",JSON.stringify(rows.map(x=>x.id))); cv.set("referenceCodes",JSON.stringify(rows.map(x=>x.reasonCode))); cv.set("kittingTransactionIds",JSON.stringify(rows.filter(x=>x.transactionType.startsWith("KITTING_")).map(x=>x.id))); cv.set("replenishmentTransactionIds",JSON.stringify(rows.filter(x=>(x.reasonCode||"").startsWith("AUTO_REPLENISHMENT:")).map(x=>x.id)));''',name='Capture workflow ledger/correlation IDs')
add(f,'POST','/api/v1/OutboundOrders',dict(ob,orderNumber='{{prefix}}_CANCEL'),'cancelOrderId')
add(f,'POST','/api/v1/InboundReceipts/process-crossdock',{'productId':'{{productId}}','incomingQuantity':1,'sourceDockCode':'{{prefix}}_DOCK'},expected=409,name='Pending B3 order blocks legacy crossdock without mutation')
add(f,'DELETE','/api/v1/OutboundOrders/{{cancelOrderId}}')
f=folder('11 Dashboard / Audit / Reports')
for p in ['/api/v1/Dashboard/inbound-outbound-chart?days=7','/api/v1/Dashboard/warehouse-occupancy','/api/v1/Dashboard/ai-agent-metrics','/api/v1/AuditLogs']: add(f,'GET',p)
add(f,'GET','/api/v1/Reports/export/excel',binary=True)
f=folder('12 AI — real provider required, no synthetic success')
add(f,'POST','/api/v1/Chat/ask',{'message':'Describe how warehouse staff should verify stock before picking. Do not execute any business actions.'},js='pm.test("Nonempty chat",()=>pm.expect(d).to.be.a("string").and.have.length.above(0));',ai=True)
add(f,'GET','/api/v1/Forecasts/demand-prediction?sku={{productSku}}',ai=True,js='''pm.test("Forecast matches SKU and authoritative outbound3",()=>{pm.expect(d.sku).eq(cv.get("productSku"));pm.expect(d.historicalMovements.reduce((a,x)=>a+x.quantity,0)).eq(3);pm.expect(d.forecastedDemand.length).within(1,30);const now=new Date();const day=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());d.forecastedDemand.forEach(x=>{pm.expect(new Date(x.date).getTime()).above(day).and.at.most(day+30*86400000);pm.expect(x.quantity).at.least(0);});});''')
add(f,'GET','/api/v1/Dashboard/executive',js='pm.test("Core plus live AI available",()=>{pm.expect(d).to.have.property("warehouse");pm.expect(d).to.have.property("inventory");pm.expect(d.aiInsight.aiAvailable).eq(true);pm.expect(d.aiInsight.aiExecutiveSummary).to.be.a("string").and.have.length.above(0);});')
add(f,'GET','/api/v1/Dashboard/ai-slotting-recommendations?zoneId={{zoneId}}',ai=True,js='pm.test("Slotting only current scoped SKU and zones",()=>{pm.expect(d).to.be.an("array");d.forEach(x=>{pm.expect(x.sku).eq(cv.get("productSku"));pm.expect(x.currentZone).eq("Khu Khô (Dry Zone)");pm.expect(x.suggestedZone).eq("Khu Khô (Dry Zone)");pm.expect(["Fast","Medium","Slow"]).include(x.velocityClass);});});')
add(f,'GET','/api/v1/Products/semantic-search?text=warehouse%20stock%20component',js='pm.test("Semantic active fixture identities",()=>{pm.expect(d).to.be.an("array");d.forEach(x=>pm.expect([cv.get("productId"),cv.get("kitProductId")]).include(x.id));});',ai=True)
f=folder('13 Upload / Vision — repository files')
for action,file in [('scan-invoice','invoice.png'),('report-damage','damage.png')]: add(f,'POST','/api/v1/InboundReceipts/'+action,upload=file,ai=True)
f=folder('14 Negative and deferred legacy contracts')
add(f,'POST','/api/v1/Chat/ask',{'message':''},expected=400,name='Empty chat rejected')
add(f,'GET','/api/v1/Products/semantic-search?text=',expected=400,name='Empty semantic query rejected')
add(f,'POST','/api/v1/InboundReceipts/confirm-receipt','{"inboundReceiptId":"{{inboundReceiptId}}","receivedItems":{{receiveItems}}}',expected=409,name='Duplicate receive rejected')
add(f,'POST','/api/v1/OutboundOrders/{{outboundOrderId}}/pick','{"items":{{pickItems}}}',expected=409,name='Duplicate terminal pick rejected')
add(f,'POST','/api/v1/InboundReceipts/process-crossdock',{'productId':'{{productId}}','incomingQuantity':1,'sourceDockCode':'{{prefix}}_DOCK'},name='Legacy crossdock no pending demand — advisory only')
for action,b in [('create-wave-pick',{'outboundOrderIds':['{{outboundOrderId}}','{{cancelOrderId}}']}),('pick-verify',{'orderId':'{{outboundOrderId}}','productId':'{{productId}}','binId':'{{sourceBinId}}','scannedSerials':['F1-NO-SERIAL']})]:
    add(f,'POST','/api/v1/OutboundOrders/'+action,b,expected=409,name='B3 rejects legacy '+action)
add(f,'POST','/api/v1/OutboundOrders/validate-weight',{'orderId':'{{outboundOrderId}}','sku':'{{productSku}}','quantity':3,'actualWeightGrams':900},js='pm.test("Advisory weight within tolerance",()=>pm.expect(d.isValid).eq(true));',name='Weight advisory valid900g')
add(f,'POST','/api/v1/OutboundOrders/validate-weight',{'orderId':'{{outboundOrderId}}','sku':'{{productSku}}','quantity':3,'actualWeightGrams':1},js='pm.test("Advisory weight rejects mismatch",()=>pm.expect(d.isValid).eq(false));',name='Weight advisory mismatch isValid false')
f=folder('15 Cleanup — delete unused fixtures, retain referenced business history')
# Create disposable records; referenced workflow data is intentionally retained for inspection.
for group,b,var in [('Products',product('_DELETE'),'deleteProductId'),('Customers',dict(customer,code='{{prefix}}_DC',email='{{prefix}}_dc@example.invalid'),'deleteCustomerId'),('Suppliers',dict(supplier,code='{{prefix}}_DS',email='{{prefix}}_ds@example.invalid'),'deleteSupplierId'),('Bins',binbody('DELETE',1),'deleteBinId')]:
    add(f,'POST',f'/api/v1/{group}',b,var,ai=(group=='Products'))
    add(f,'DELETE',f'/api/v1/{group}/{{{{{var}}}}}')
add(f,'DELETE','/api/v1/Users/{{userId}}')
add(f,'POST','/api/v1/Zones',dict(zone,code='{{prefix}}_DZ'),'deleteZoneId')
add(f,'DELETE','/api/v1/Zones/{{deleteZoneId}}')
add(f,'POST','/api/v1/Warehouses',dict(wh,code='{{prefix}}_DW'),'deleteWarehouseId')
add(f,'DELETE','/api/v1/Warehouses/{{deleteWarehouseId}}')
add(f,'POST','/api/v1/Auth/logout',{},js='cv.unset("token");')

c['item']=folders
c['auth']={'type':'bearer','bearer':[{'key':'token','value':'{{token}}','type':'string'}]}
c['variable']=[]
c['event']=[{'listen':'prerequest','script':{'type':'text/javascript','exec':[
    'const base=String(pm.environment.get("baseUrl")||"").replace(/\\/+$/,"");',
    'if (!/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/i.test(base)) throw new Error("F1 requires an isolated local server baseUrl");',
    'pm.variables.set("baseUrl",base);']}}]
c['info']['description']='F1 refresh of existing WORKING collection. Import; set baseUrl, username, password for an Admin on an isolated local fixture server; run in folder order. IDs/tokens/generated fixture data are runtime collection variables. K1/R1/B3 enabled. Live AI failures remain failed tests, not happy-path PASS. Repository upload paths require working directory set to repository root. Referenced history is retained. Provider secrets stay on backend. Saved examples removed.'
e['values']=[{'key':k,'value':'','type':'secret' if k=='password' else 'default','enabled':True} for k in ['baseUrl','username','password']]
annotate(c)
for obj,path in [(c,out/original.name),(e,out/environment.name)]: path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Derive actual source route inventory and preserve the original collection comparison.
routes=[]
for p in sorted((root/'SmartWMS.Api/Controllers').glob('*.cs')):
    text=p.read_text(encoding='utf-8-sig'); ctrl=p.stem.removesuffix('Controller')
    prefix='api/v1/'+ctrl
    auth='; '.join(re.findall(r'\[Authorize(?:\(([^\]]*)\))?\]',text)) or 'Authorize'
    for m in re.finditer(r'\[Http(Get|Post|Put|Delete|Patch)(?:\("([^\"]*)"\))?\]',text):
        method=m[1].upper(); route='/'+prefix+('/'+(m[2] or '') if m[2] else '')
        route=re.sub(r'\{(\w+):[^}]+\}',r'{\1}',route)
        key=(method,route.lower())
        present=lambda items:any(x['request']['method']==method and norm(x['request']['url'])==norm(route) for x in items)
        routes.append({'method':method,'route':route,'auth':auth,'source':str(p.relative_to(root)).replace('\\','/'),'oldPostman':present(old),'postman':present(list(flatten(c['item']))),'dependencies':ctrl+' workflow fixtures','status':'PENDING RUNTIME'})
(root/'obj/F1/routes.json').write_text(json.dumps(routes,indent=2),encoding='utf-8')
print(f'Source routes={len(routes)}; old requests={len(old)}; refreshed requests={len(list(flatten(c["item"])))}; missing={[(r["method"],r["route"]) for r in routes if not r["postman"]]}')
