# API contract hiện hành — SmartWMS

> Receive đã cập nhật theo [Phase B1](PHASE_B1_INBOUND.md), implementation commit `5a7377bf353ede47958dcdfa96f52015916f3152`. B1 bắt buộc `receivedItems[].expectedReceivedQuantity`. B2 cập nhật aggregate read contract và đóng verification gap Phase4A; xem [PHASE_B2.md](PHASE_B2.md). Phần workflow ngoài scope giữ đánh giá baseline.

Audit 2026-10-22 (Asia/Saigon), branch `main`, HEAD `8c616b5875d6ad1029ef410688cd764210b0e0da` **cộng working-tree diff**. [Handoff](BACKEND_HANDOFF.md) chứa build/test/P0/P1/P2 và [Lifecycle](LIFECYCLE_STATUS.md) ghi entity/transaction theo bước. Chỉ liệt kê route có trong controller; tên DTO/command không tự tạo endpoint.

## Quy ước chung

- Base path ở bảng: `/api/v1`. Tên controller trong route được giữ nguyên như source; không thêm `/receive`, `/putaway`, `/allocate`, `/pack`, `/complete` theo suy đoán.
- `R` = JWT + một trong `Admin,WarehouseManager,Staff`; `M` = JWT + `Admin,WarehouseManager`; `A` = JWT Admin; `J` = JWT hợp lệ, **không có role restriction**. Không có warehouse-scope authorization chung.
- DTO trong bảng là C# class dưới `SmartWMS.Application/Features/<module>/DTOs/Commands/`. JSON dùng camelCase mặc định ASP.NET Core. Body gửi DTO trực tiếp, trừ cycle create gửi wrapper command `{ "requestData": {...} }`.
- Thành công qua `ToActionResult`: HTTP **200** với `Result<T>` (`isSuccess`, `data`, `message`, `error`, `errors`), kể cả create/delete; không mặc định 201/204. `data` là kiểu `T` trong bảng, không phải DTO entity đầy đủ. Không dựa vào message tiếng Việt để điều khiển trạng thái.
- Result failure: `{isSuccess:false,message,errorCode,errors}`; `VAL_1000`→400, `COM_409`→409; các not-found code tương ứng→404, auth→401/403, DB error→500; legacy `ERR_GENERAL` thường→400. ValidationBehavior/exception trả ProblemDetails với `errors`; ApiController binding và auth có thể dùng envelope khác. Frontend phải đọc cả hai dạng lỗi.
- Enum inventory gửi **số**: `1=Available`, `2=Reserved`, `3=QCHold`, `4=Damaged`, `5=Expired`. Program chỉ AddControllers, không đăng ký JsonStringEnumConverter. TrackingMode `None=0,Lot=1,Serial=2`; BinPurpose `Storage=0,Staging=1`.
- Mọi write qua `ApplicationDbContext.SaveChangesAsync` ghi AuditLogs cùng commit (trừ read/no-op); actor/IP từ current user, fallback SystemAdmin; CreatedBy hard-coded trong handler mới bị override. Audit thiếu primary key entity/correlation. Các bảng dưới ghi inventory ledger riêng; audit không thay thế ledger.
- `S` = một SaveChangesAsync atomic, **không bảo vệ toàn read/check trước save**; `MUT` = explicit RepeatableRead transaction qua InventoryMutationCoordinator + UPDLOCK/HOLDLOCK cho lot/workflow theo handler, SaveChanges + commit, rollback clear tracker; `SER` = Serializable TransactionScope.
- `Stable`: contract/phạm vi có bằng chứng tương ứng; phải đọc giới hạn test trong handoff, không đồng nghĩa HTTP/role/E2E đã pass. `Partial`: thiếu workflow/validation/retry hoặc chưa kiểm runtime; `Unsafe`: static finding có thể vi phạm identity/stock/occupancy. Không có global idempotency middleware hoặc retry key công khai cho các mutation bên dưới.

## Inbound (R)

| Method / route | Handler; request → data | Validation chính | Allowed before → after | Inventory / history / audit; transaction | Idempotency / retry | Đánh giá |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/InboundReceipts` | CreateInboundReceiptCommandHandler; CreateInboundReceiptRequest → Guid receiptId | ReceiptNumber required <=50, precheck duplicate; SupplierId/BinId nonempty; active bin hierarchy; expected date >= UTC today; items nonempty, product IDs nonempty, expected qty>0. Chưa check product/supplier active đầy đủ | Chưa có → New; items received=0 | Header/details/audit; không inventory/history; S | Duplicate number chỉ precheck, không replay cached response; không key | Partial |
| PUT `/InboundReceipts/{id}` | UpdateInboundReceiptCommandHandler; UpdateInboundReceiptRequest → bool | route id=body id; nonempty unique ProductId list, qty>0; products/supplier active; bin active nếu truyền; tất cả QuantityReceived=0; từ chối nhiều retained details cùng product vì DTO thiếu item ID/lot | New/Pending/Draft → giữ nguyên | Giữ ID/lot/expiry retained item, update expected qty, remove/add items; audit; không tồn/ledger; MUT | Không request key; gọi lại cùng dữ liệu vẫn có thể ghi audit/rowversion; conflict 409 cần reload | **Stable trong scope handler đã test** (ReleaseHardening 65 PASS); HTTP chưa test |
| DELETE `/InboundReceipts/{id}` | DeleteInboundReceiptCommandHandler; route→DeleteInboundReceiptRequest{Id} → bool | Receipt tồn tại, status New | New → hard Remove, không IsDeleted=true | Header/items theo FK, audit; không reverse tồn; S | Không idempotent response: gọi lại lỗi not-found/validation | Partial |
| POST `/InboundReceipts/confirm-receipt` | **ReceiveInboundReceiptCommandHandler**; ReceiveInboundReceiptRequest → bool | IDs unique/nonempty, delta>0, expectedReceivedQuantity required>=0 và khớp live; không over-receive; receipt/bin/zone/warehouse/product/supplier nếu có active; None/Lot, snapshot mode khớp; normalized Available duy nhất, expiry khớp/chưa expired, không LPN/reserved/workflow/serial; tổng capacity/occupancy=physical/overflow guards | New/Pending/Processing → Processing/Completed khi mọi received==expected; terminal/Draft→409 | Receipt/item+mode snapshot, Available stock/bin occupancy+=delta; INBOUND ledger gắn BinInventoryId, receipt/item IDs trong ReasonCode, audit; MUT + lock/refresh inbound coordinator; notification sau commit catch/log | Retry nguyên payload cũ→COM_409, không duplicate; thiếu expected→400. Không cached success/key. Sau409 reload, không tự nâng expected rồi gửi lại delta cũ. Lỗi realtime sau commit vẫn success | **B1 scoped Stable**: focused+HTTP142 PASS, Admin smoke; chưa full role/load test. Toàn Inbound Partial |
| POST `/InboundReceipts/process-crossdock` | ProcessCrossDockingCommandHandler; ProcessCrossDockRequest → CrossDockResultDto | ProductId nonempty, incoming>0; pending line lookup; không check receipt/physical stock/bin identity | Pending lines → Allocated/split; header chưa theo allocation thực | Không đổi BinInventory; thêm TRANSFER ledger, đổi/split outbound lines, audit; S nếu có matched; event sau save | Không key; replay có thể match tiếp dòng khác | Unsafe cho full inventory workflow; P1-05 |
| POST `/InboundReceipts/scan-invoice` | Controller gọi IAiInsightService.AnalyzeReceiptImageAsync; multipart file → `{isSuccess,data:JSON}` | File nonempty; extension .jpg/.jpeg/.png/.webp; không DTO invoice cố định | Không trạng thái | Không write inventory/DB/audit; request Gemini | Retry gọi AI lại; output biến thiên, upstream fail 502/504; JSON parse fail 502 + rawOutput | Partial, AI runtime chưa test |
| POST `/InboundReceipts/report-damage` | Controller gọi AnalyzeDamageImageAsync; multipart file → `{isSuccess,analysis:JSON,generatedAt}` | Cùng kiểm file extension/nonempty | Không đổi stock status | **Chỉ phân tích**, không tự Damaged, không inventory/history/audit | Gọi AI lại; không persisted evidence/retry key | Partial |

Request/response fields thực tế:

| DTO | Fields |
| --- | --- |
| CreateInboundReceiptRequest | receiptNumber:string, supplierId:Guid, binId:Guid, expectedDeliveryDate:DateTime, referenceDocument:string, notes:string, items:InboundItemRequest[] |
| InboundItemRequest | productId:Guid, expectedQuantity:int, lotNumber:string (blank được handler đổi `N/A`), expirationDate:DateTime? |
| UpdateInboundReceiptRequest | id:Guid, binId:Guid?, supplierId:Guid?, expectedDeliveryDate:DateTime, referenceDocument:string, notes:string, items:UpdateInboundReceiptItemRequest[] |
| UpdateInboundReceiptItemRequest | productId:Guid, expectedQuantity:int; **không có** itemId/lot/expiry |
| ReceiveInboundReceiptRequest | inboundReceiptId:Guid, receivedItems:ReceiveItemRequest[] |
| ReceiveItemRequest | itemId:Guid (**InboundReceiptItem.Id**), quantityReceived:int (**delta dương**), **expectedReceivedQuantity:int? bắt buộc nonnull>=0**, bằng lượng đã đọc trước delta. Duplicate ItemId→400, stale precondition→409 |
| ProcessCrossDockRequest | productId:Guid, incomingQuantity:int, sourceDockCode:string (default RECEIVING_DOCK; required <=50 theo validator) |
| CrossDockResultDto | productId, totalIncomingQuantity, crossDockedQuantity, remainderForPutaway, executionSummary |

GET `/InboundReceipts/putaway-suggestion?sku&quantity` chỉ gợi ý `PutawaySuggestionDto` (binId, binCode, zoneName, availableSpaceBeforePutaway); không tạo task hoặc giữ capacity. Không có public route gọi `ConfirmInboundReceiptCommandHandler` cũ.

## Inventory Adjustment / Stock Status / Transfer

B2: Phase4A đã PASS toàn suite **95 assertions**; failure fixture trước đây đã đóng, không đổi timeout/backend locking. Các mutation dưới vẫn Partial ở mức tích hợp FE vì HTTP policy/lost-response retry chưa được kiểm đầy đủ. Không suy ra idempotency từ handler tests PASS.

Read contract sau B2 (JWT, không role restriction bổ sung):

| Method / route | Handler / response | Semantics / side effects | Evidence / status |
| --- | --- | --- | --- |
| GET `/Inventory/stock-summary` | GetInventorySummaryQueryHandler → Result<InventorySummaryDto>: `totalProducts:int32`, `totalQuantity:int64`, `lowStockItems:int32` | Tổng **physical** Quantity của products chưa soft-delete có inventory rows, mọi status; không trừ ReservedQuantity. Product không có row không được đếm; low-stock <20. SQL và CLR sum Int64; không inventory/history/audit write | Stable trong scope numeric/read đã kiểm: boundary + HTTP 15 PASS; JSON integer giữ tên/shape, FE không ép totalQuantity về Int32 |
| GET `/Inventory/low-stock-alerts` | GetLowStockAlertsQueryHandler → Result<List<LowStockAlertDto>>; `currentStock:int32` giữ nguyên | Aggregate physical Int64 **trước** filter <20; chỉ map kết quả đã lọc về DTO cũ, giữ ordering/filter. Không mutation | Boundary + HTTP PASS với một product >Int32; không tuyên bố coverage toàn role/load |

GetWarehouseDashboardQueryHandler có cùng SQL aggregate đã sửa và được test trực tiếp; không thêm route Dashboard mới. Không đổi status/reservation/transaction của các mutation.

| Method / route; auth | Handler; request → data | Validation chính | Allowed before → after | Inventory / history / audit; transaction | Idempotency / retry | Đánh giá |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/Inventory/adjust-stock`; J | AdjustStockCommandHandler; AdjustStockRequest → bool | IDs nonempty, delta!=0, reason required; active product không Serial; active bin hierarchy; normalized lot lookup **<=1 row mọi status**; valid quantities; next Q>=reserved, <=int.MaxValue; occupancy finite/in capacity | Không có document state; có thể tác động row **bất kỳ status** nếu duy nhất; absent row→Available; existing giữ status | Q+=delta, bin occupancy+=delta; ADJUSTMENT ledger với BinInventoryId/reason; audit; MUT | Không key: cùng delta gửi lại trừ/cộng lần nữa; conflict→409 không auto replay; reload trước quyết định gửi lại | Partial integration; Phase4A 95 PASS, HTTP/retry coverage còn thiếu |
| POST `/Inventory/change-status`; J | ChangeStockStatusCommandHandler; ChangeStockStatusRequest → bool | IDs/reason, enum hợp lệ; exact 1 normalized lot row; nếu nhiều row có target status→409; đổi thực không cho Reserved, reservedQty>0 hoặc active workflow | Existing status → NewStatus; same-status success no-op kể cả Reserved | Q/reserved/occupancy giữ nguyên, đổi cả row; STATUS_CHANGE ledger qty=0 + old/new/reason; audit; MUT; QC/Damaged event sau commit, exception được catch/log | Same-status idempotent no-op, không ledger/audit/event/rowversion; không request key. Sau status đổi có writer khác, retry không còn là no-op bảo đảm | Partial; no-op/guards có test evidence, HTTP policy chưa test |
| POST `/InventoryTransfers`; R | CreateInventoryTransferCommandHandler; CreateInventoryTransferRequest → Guid (**ledger transaction ID**) | IDs nonempty, transfer>0, source!=dest; product active không Serial; cả hierarchy active; source Available đúng 1, dest Available<=1; source không LPN; Q-reserved>=qty; dest expiry/LPN khớp; int overflow/capacity/occupancy bounds | Source Available giữ status, dest absent→Available hoặc giữ Available; không transfer document state | Trừ source/cộng dest, reserved giữ nguyên; occupancy hai bin -/+qty; TRANSFER ledger source/dest inventory IDs + codes/reason, audit; MUT lock bins/lot theo thứ tự | Không key/dedup. Gửi lại có thể transfer lần nữa; 409 không tự retry. Chỉ sau đọc lại nguồn/đích/history và xác định request trước chưa commit | Partial integration; Phase4A 95 PASS gồm boundary/concurrency, chưa có HTTP lost-response coverage |
| POST `/Inventory/run-auto-replenish`; J | AutoReplenishCommandHandler; không body → int số lần **đã move**, không phải task IDs | Target bin capacity>0, occupancy<=20%, target Q>0; source khác bin, cùng product/lot, Available, Q>needed. Thiếu tracking/LPN/expiry/target status/reservation-aware source/hierarchy checks | Target giữ status kể cả hold/damaged; không task state | Trực tiếp source Q/occupancy-=needed, dest+=needed; TRANSFER ledger reason AUTO_REPLENISHMENT/audit; S cuối loop | Không request key; không coordinator; dựa physical Q có thể bị DB reservation check từ chối; không assume 200 là đã tạo task | **Unsafe P0-02** |

| DTO | Fields |
| --- | --- |
| AdjustStockRequest | binId:Guid, productId:Guid, lotNumber:string, adjustmentQuantity:int (delta signed), reasonCode:string |
| ChangeStockStatusRequest | binId:Guid, productId:Guid, lotNumber:string, newStatus:InventoryStatus numeric, reasonCode:string; **không có** sourceStatus/rowId/partial quantity |
| CreateInventoryTransferRequest | productId:Guid, sourceBinId:Guid, destinationBinId:Guid, transferQuantity:int, lotNumber:string, reason:string (default Luân chuyển nội bộ) |

Lot blank/whitespace của hardened commands thành `LOT-DEFAULT`, trim nonblank. Không mặc định lot `N/A` trên receipt là cùng lot. Không có public MoveInventory/MoveLpn/LockExpiredStock route dù các command/DTO đó tồn tại. GET transfers đọc history, không dùng Guid trả về như transfer document ID có endpoint complete.

## Outbound / Picking (R)

| Method / route | Handler; request → data | Validation chính | Allowed before → after | Inventory / history / audit; transaction | Idempotency / retry | Đánh giá |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/OutboundOrders` | CreateOutboundOrderCommandHandler; CreateOutboundOrderRequest → Guid orderId | Number required <=50 + duplicate precheck; bin active; date >= UTC today; items nonempty/product IDs/qty>0; customer/product active chưa check đầy đủ | Chưa có → Pending, line Pending | Header/lines/audit; **không reserve**; S | Không key, duplicate precheck không replay response, không bảo đảm chống race number | Partial |
| PUT `/OutboundOrders/{id}` | UpdateOutboundOrderCommandHandler; UpdateOutboundOrderRequest → bool | route/body id; items nonempty qty>0; existing lines progress đều=0 và không reservation/pickrequest/shipment/history references | Pending/Draft/New → giữ status; thay toàn lines bằng Pending IDs mới | Không inventory; update header/remove+add lines/audit; S; FK Restrict bảo vệ references | Không key; repeat thay IDs mới; cần reload chi tiết. Constraint/concurrency legacy có thể 500 | Partial |
| DELETE `/OutboundOrders/{id}` | DeleteOutboundOrderCommandHandler; route→DeleteOutboundOrderRequest → bool | Order exists, header allowed state; không release reservation workflow | Pending/Draft/New → Cancelled, IsDeleted=true | Soft delete header, audit; không inventory/history; S | Replay có thể validation/not found; không cached success | Partial |
| POST `/OutboundOrders/allocate-pick-task` | CreatePickTaskCommandHandler; CreatePickTaskRequest → bool | Order active Pending/Draft/New; không all lines Allocated/Picked | Header→Allocated; chỉ line Pending→Allocated | **Không available check/reservation/OutboundAllocation/PickTask**; AssignedUserId không persist; audit; S | Lần hai thường bị status guard chặn; không retry identity/cached result | Partial; **chưa tích hợp như allocation thực** |
| POST `/OutboundOrders/create-wave-pick` | CreateWavePickTaskCommandHandler; CreateWavePickRequest → string waveCode | IDs count>1; query phải có ít nhất 1 order; tất cả order tìm thấy active Pending/Allocated/Waved và không line Picked/Shipped. Không đảm bảo đủ IDs hoặc distinct IDs | Orders/lines→Waved | Grouping trong memory, code ngẫu nhiên trả client; **không Wave/WavePickTask/PickTask/reservation record**; audit; S | Waved được gọi lại và sinh mã khác, không dedup | Partial; persisted wave Missing |
| POST `/OutboundOrders/pick-verify` | PickWithSerialCommandHandler; PickWithSerialRequest → List<string> serials | IDs/list required; serial unique ordinal nonblank <=50; order Allocated/Waved, number unique/nonblank/khớp optional OrderCode; đúng product lines/state, không vượt remaining; serial InStock/chưa link order/có inventory, đúng bin/product/Available/active hierarchy/qty/occupancy đủ | Serial InStock→Allocated+OutboundOrderCode; dòng đủ→Picked; mọi dòng Picked→order Picked | **Trừ quantity và occupancy ngay khi pick** từng serial; OUTBOUND_SERIAL ledger -1/serial; audit; không staging/reservation/request record; S | Không key; serial đã allocated bị reject; mất response không cached success. Không khóa serial progress scope, rowversion conflict có thể 500; thiếu explicit reserved floor guard | Partial/Unsafe với reservation/concurrency; **chỉ serial path** |
| POST `/OutboundOrders/validate-weight` | ValidatePackingWeightCommandHandler; ValidatePackingWeightRequest → WeightValidationResultDto | OrderId required trong validator; handler chỉ SKU active, qty>0, actual grams finite>0; không kiểm order tồn tại/line/state | Bất kỳ → giữ nguyên | Không DB write/history/audit, không Packed state; expected=unitWeight*quantity+150g, unitWeight fallback250g; <=5% hợp lệ | Read calculation lặp lại được; result thay đổi khi product Weight đổi | Partial; 200 + IsValid=false là expected business result |
| POST `/OutboundOrders/{id}/ship` | ShipOutboundOrderCommandHandler; ShipOutboundOrderRequest → bool | Order active Picked, tất cả lines Picked qty>0/product active; number unique; mỗi SKU đúng1 check phủ toàn demand, qty đúng; serial toàn order Allocated/unique/đủ exact product qty; gọi lại weight command và IsValid=true; optional nested OrderId trống hoặc khớp route | Order/lines→Shipped, serial Allocated→Shipped | **Không trừ tồn lần nữa**; **không** Shipment/ShipmentItem/ship ledger/reservation release. Audit S | Không idempotency/request key; lần hai Shipped bị reject. Không dùng Shipments unique index để dedup vì không tạo Shipment | Partial; serial-only, chưa full shipment workflow |

| DTO | Fields / điều cần chú ý |
| --- | --- |
| CreateOutboundOrderRequest | orderNumber:string, customerId:Guid?, binId:Guid, expectedShipDate:DateTime, priority:string default Normal, notes:string, items:OutboundOrderItemRequest[] |
| OutboundOrderItemRequest | productId:Guid, requestedQuantity:int |
| UpdateOutboundOrderRequest | id:Guid, customerId:Guid?, expectedShipDate, priority, notes, items:UpdateOutboundOrderItemRequest[] (productId, requestedQuantity). Không có BinId/lineId/lot/serial |
| CreatePickTaskRequest | outboundOrderId:Guid, assignedUserId:Guid? (**bị bỏ qua**) |
| CreateWavePickRequest | outboundOrderIds:Guid[], wavePriority:string default Normal (**không điều khiển persisted wave**) |
| PickWithSerialRequest | orderId:Guid, orderCode:string optional check, productId:Guid, binId:Guid, serialNumber:string (**không được handler dùng**), scannedSerials:string[] (**phải dùng danh sách này**) |
| ValidatePackingWeightRequest | sku:string, quantity:int, actualWeightGrams:double, orderId:Guid, actualWeight:decimal (**legacy field không dùng**) |
| WeightValidationResultDto | isValid:bool, expectedTotalWeightGrams:double, actualWeightGrams:double, deviationPercentage:double, statusMessage:string |
| ShipOutboundOrderRequest | packingChecks:ValidatePackingWeightRequest[]; **không** shipping carrier/tracking number/idempotency key |

Không có task list/execution quantity API, persisted pack, release reservation hoặc None/Lot pick route. Foundation entities `OutboundAllocation`, `InventoryReservation`, `OutboundPickRequest`, `FulfilmentOperationRequest`, `Wave`, `Shipment` không phải API contract đã implement chỉ vì migration tạo bảng.

## Cycle Counting (J)

| Method / route | Handler; request → data | Validation chính | Allowed before → after | Inventory / history / audit; transaction | Idempotency / retry | Đánh giá |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/CycleCounting/create-sheet` | CreateCountSheetCommandHandler; **CreateCountSheetCommand{RequestData:CreateCountSheetRequest}** → Guid sheetId | Bin hoặc zone required/không Empty; nếu cả hai thì cùng phạm vi; hierarchy active, optional assignee active; scope có stock; lot identity duy nhất cả normalize/SQL collation; quantities/status/occupancy valid; **reject Serial, serial evidence, LPN, reservedQty!=0, status Reserved, active workflow** | Chưa có → Pending; details Pending | Snapshot stock ID+rowversion+quantity+lot; sheet/items/audit; stock unchanged; MUT, lock scope/lot/bin + reload tracking | Không key: create lại ra sheet khác; không giữ freeze qua request confirm; stock đổi thì phải lập lại | **Stable về atomic snapshot trong scope đã test** (Phase4B 107 PASS); HTTP chưa test |
| POST `/CycleCounting/confirm` | ConfirmCycleCountCommandHandler; ConfirmCycleCountRequest trực tiếp → bool | Full exact item set một lần, count required >=0; sheet active Pending/Counting, items Pending/snapshot ID+rowversion 8 bytes; live identity/rowversion/qty/exact lot khớp snapshot; recheck supported scope; aggregate occupancy in capacity | Pending/Counting → Completed; detail→Matched/Discrepancy | Q=counted; bin occupancy+=sum(delta); ADJUSTMENT ledger mỗi nonzero variance có BinInventoryId/reason sheet; audit cùng commit; MUT lock sheet/items/lot/bin | Replay terminal→409, không replay success; stale evidence→409, không tự retry correction. Không kiểm assignee/role trong handler | **Stable về atomic confirm trong scope đã test**; policy J hiện tại cần được chấp nhận; chưa test HTTP/role |

| DTO | Fields |
| --- | --- |
| CreateCountSheetRequest | zoneId:Guid?, binId:Guid?, notes:string, assignedUserId:Guid? |
| ConfirmCycleCountRequest | countSheetId:Guid, notes:string, countedItems:CycleCountItemRequest[] |
| CycleCountItemRequest | itemId:Guid (**CycleCountItem.Id**, không BinInventoryId), countedQuantity:int? (**phải có**, null invalid) |

Create body ví dụ (replace GUID bằng ID thực):

```json
{
  "requestData": {
    "binId": "11111111-1111-1111-1111-111111111111",
    "assignedUserId": "22222222-2222-2222-2222-222222222222",
    "notes": "Kiểm kê bin"
  }
}
```

GET `/CycleCounting/{id}` → Result<CycleCountSheetDto> gồm id/batchCode/sheetNumber/zoneId/zoneName/binId/binCode/status/assignedUserId/notes/createdAt/createdBy/items. Detail có id/binId/binCode/lotNumber/status/productId/productName/SKU/systemQuantity/countedQuantity/variance; pending count/variance null. GET `/CycleCounting/pending-tasks?operatorName=...` lọc AssignedUserId từ token; query operatorName chỉ compatibility, không có quyền chọn user khác. Details/confirm **không** áp cùng assignment guard.

Không có save-draft/count/submit/variance-approve/correct/complete riêng; confirm làm tất cả trong một transaction. `ScheduleAutoCycleCountCommandHandler` trả UNSUPPORTED và không có controller route.

## Các mutation quan trọng khác hiện có

Các row dưới có audit chung khi SaveChanges; allowed before là entity/config existence trừ khi ghi khác. Đây vẫn là source audit, chưa có HTTP runtime evidence. DTO fields/validators authoritative ở link source appendix phía dưới; không tự thêm API.

| Method / route; auth | Request → data; handler | Validation / status | Inventory/history; transaction | Retry / đánh giá |
| --- | --- | --- | --- | --- |
| POST `/Auth/login`; anonymous | LoginRequest{username,password} → LoginResponse{token,username,role,fullName}; LoginCommandHandler | User tồn tại active, PBKDF2 verify; sai →401. Không đổi user status | Không stock/audit write; issue JWT | Không key; login lại token khác. Partial: malformed stored hash có thể throw |
| POST `/Auth/logout`; J | LogoutRequest{token:string} → bool; LogoutCommandHandler | JWT auth, handler không dùng body token và luôn success | Không revoke/write/audit | No-op lặp lại; Partial: client phải bỏ token, JWT cũ còn hạn |
| POST `/Products`; R | CreateProductRequest → Guid; CreateProductCommandHandler | SKU precheck; validator các trường; generate embedding trước save; TrackingMode enum | Product/audit, không stock; S; AI dependency | Không key; Partial, dimensions nhận nhưng không map |
| PUT `/Products/{id}`; R | UpdateProductRequest → bool; UpdateProductCommandHandler | Route/body ID; SKU unique precheck; đổi TrackingMode bị chặn khi inventory/serial/open docs/live workflow | Product/audit; không stock; SER | Không key; Partial; chưa cập nhật embedding sau sửa mô tả |
| DELETE `/Products/{id}`; R | route Id→DeleteProductRequest → bool; DeleteProductCommandHandler | Product tồn tại; FK có thể chặn | **Hard Remove**, audit; S; không xóa stock | Không key; Partial, FK lỗi có thể500 |
| POST `/Products/parse-barcode`; R | ParseBarcodeRequest{rawBarcodeData:string} → ParsedBarcodeDto{productId,sku,productName,lotNumber,expirationDate}; ParseBarcodeQueryHandler | Raw required <=163; SKU/Barcode/QR/legacy SKU-lot-date parser; active product unique match; ambiguous/mismatch/date sai reject | Read-only dù HTTP POST, không stock | Retry được theo dữ liệu hiện hành; Partial/chưa HTTP test |
| POST `/Warehouses`; M | CreateWarehouseRequest → Guid; CreateWarehouseCommandHandler | Code duplicate precheck + required fields | Warehouse/audit; S | Không key; Partial |
| PUT `/Warehouses/{id}`; M | UpdateWarehouseRequest → bool; UpdateWarehouseCommandHandler | Code check; staging supplied phải Staging, active hierarchy, đúng warehouse; omit giữ cũ, explicit null clear | Config/audit; không move existing workflow staging; SER | Không key; Partial |
| DELETE `/Warehouses/{id}`; M | route Id→DeleteWarehouseRequest → bool; DeleteWarehouseCommandHandler | Chặn khi có active zones | IsDeleted=true + audit; S, không stock | Không key; Partial |
| POST `/Zones`; M | CreateZoneRequest → Guid; CreateZoneCommandHandler | Warehouse active, code guard/validator | Zone/audit, không stock; MUT | Không key; Partial |
| PUT `/Zones/{id}`; M | UpdateZoneRequest → bool; UpdateZoneCommandHandler | Route/body ID; zone exists, duplicate code | Zone/audit; S, không stock | Không key; Partial |
| DELETE `/Zones/{id}`; M | route Id→DeleteZoneRequest → bool; DeleteZoneCommandHandler | Chặn mọi bin/count history reference kể cả soft deleted; delete FK race→409 khi đúng entity SQL547 | Hard Remove + audit; MUT; rollback/clear | Không key; Partial; có focused race verification |
| POST `/Bins`; M | CreateBinRequest → Guid; CreateBinCommandHandler | Active Zone/Warehouse; Purpose enum, capacity/field validation; code guard theo zone nhưng DB unique global | Bin occupancy=0 + audit; MUT; không stock | Không key; Partial; dimensions không map |
| PUT `/Bins/{id}`; M | UpdateBinRequest → bool; UpdateBinCommandHandler | Capacity >= current occupancy; Purpose đổi chỉ khi empty/no dependency; Storage không là default staging | Bin/audit; SER; không stock | Không key; Partial |
| DELETE `/Bins/{id}`; M | route Id→DeleteBinRequest → bool; DeleteBinCommandHandler | Chặn có stock theo BinInventoryCheckForDeleteSpec | IsDeleted=true + audit; S | Không key; Partial |
| POST `/Kitting/assemble`; M | AssembleKitRequest → bool; AssembleKitCommandHandler | Kit/target/components/positive quantities theo validator; handler component total=qtyPerKit*assembleQty, source stock sufficient | Component Q-=total, kit Q+=assembleQty; KITTING_ISSUE/KITTING_RECEIPT; audit S; **không occupancy/capacity/reservation/metadata guards đầy đủ** | Không key; **Unsafe P0-01** |
| POST `/Chat/ask`; J | AiChatRequest → query result; GetAiChatResponseQueryHandler | AI input validator, Gemini dependency | Không inventory mutation | Gọi AI lại, Partial/Not tested runtime |

| Method / route; auth | Request → data; handler | Validation / status | Inventory/history; transaction | Retry / đánh giá |
| --- | --- | --- | --- | --- |
| POST `/Suppliers`; M | CreateSupplierRequest → Guid; CreateSupplierCommandHandler | Code required <=50, Name required <=200, optional email format <=100, phone<=20; active code duplicate guard | Supplier mới/audit; không stock/history; S | Không key; Partial |
| PUT `/Suppliers/{id}`; M | UpdateSupplierRequest → bool; UpdateSupplierCommandHandler | Route/body ID, code/name limits như create; optional email valid; active code duplicate guard | Supplier fields/audit; không stock/history; S | Không key; Partial |
| DELETE `/Suppliers/{id}`; M | route Id→DeleteSupplierRequest → bool; DeleteSupplierCommandHandler | Active supplier tồn tại, inbound reference guard | IsDeleted=true/audit; không stock/history; S | Repeat không cached success; Partial |
| POST `/Customers`; R | CreateCustomerRequest → Guid; CreateCustomerCommandHandler | Code required <=50, name required <=200, optional email valid, code duplicate guard | Customer mới/audit; không stock/history; S | Không key; Partial |
| PUT `/Customers/{id}`; R | UpdateCustomerRequest → bool; UpdateCustomerCommandHandler | Route/body ID, code/name/email như create; duplicate guard | Customer fields/audit; không stock/history; S | Không key; Partial |
| DELETE `/Customers/{id}`; R | route Id→DeleteCustomerRequest → bool; DeleteCustomerCommandHandler | Customer active, outbound reference guard | IsDeleted=true/audit; không stock/history; S | Repeat không cached success; Partial |
| POST `/Users`; A | CreateUserCommand trực tiếp → Guid; CreateUserCommandHandler | Username 3..50/email unique case-insensitive precheck; email format; names required<=50; password>=6; Role Admin/WarehouseManager/Staff | User active=true, PBKDF2 password/audit (loại PasswordHash); không stock/history; S | Không key; Partial |
| PUT `/Users/{id}`; A | UpdateUserCommand trực tiếp → bool; UpdateUserCommandHandler | Route/body ID; firstName<=50,lastName<=100 required; newPassword>=6 nếu có; Role còn chấp nhận Worker khác create | User names/role/active/optional password/audit; không revoke JWT đang phát; S | Không key; Partial |
| DELETE `/Users/{id}`; A | route→DeleteUserCommand(Id) → bool; DeleteUserCommandHandler | Không xóa username admin; chặn CycleCountSheet/PickTask history kể cả deleted; đúng delete FK race→409 | Hard Remove/audit; MUT; không stock/history | Không key; guard/race handler đã test; Partial ở HTTP |

Request DTO bổ sung (C# Guid/double/int tương ứng JSON string/number):

| DTO | Fields |
| --- | --- |
| CreateProductRequest | trackingMode numeric default0, sku, barcode, name, description, unit, width, height, depth; dimensions không map |
| UpdateProductRequest | id, trackingMode nullable numeric, sku, barcode, name, description, unit |
| CreateWarehouseRequest / UpdateWarehouseRequest | code,name,address; update thêm id, defaultStagingBinId nullable (omit giữ nguyên; null clear) |
| CreateZoneRequest / UpdateZoneRequest | code,name; create thêm warehouseId, update thêm id |
| CreateBinRequest / UpdateBinRequest | code,maxCapacity; create thêm purpose numeric default0, zoneId,width,height,depth (dimensions không map); update thêm id,purpose nullable |
| AssembleKitRequest / KitComponentRequest | kitProductId,targetBinId,assembleQuantity,components:[{componentProductId,sourceBinId,quantityPerKit}] |
| CreateSupplierRequest / UpdateSupplierRequest | code,name,email,phone,address; update thêm id |
| CreateCustomerRequest / UpdateCustomerRequest | code,name,email,phone,deliveryAddress; update thêm id |
| CreateUserCommand / UpdateUserCommand | create: username,email,password,lastName,firstName,role; update: id,firstName,lastName,role,isActive,newPassword? |
| Delete requests | Route id được controller bọc vào request có Id; không yêu cầu DELETE body |

Các API CRUD phụ trên vẫn Partial khi chưa có HTTP runtime evidence. Kết quả focused deletion verification không tự chứng minh toàn bộ Users/Zones module Stable.

## Read API frontend có thể dựng contract ngay

| API group | Routes hiện có | Auth / giới hạn |
| --- | --- | --- |
| Products | GET `/Products`, `/Products/list`, `/Products/{id}`, `/Products/{sku}/qrcode`, `/Products/semantic-search?text` | R; semantic phụ thuộc embedding service; qrcode Result wrapper |
| Warehouse tree | GET `/Warehouses`, `/list`, `/{id}`; GET `/Zones`, `/list`, `/warehouse/{warehouseId}`; GET `/Bins`, `/list`, `/{id}`, `/{id}/contents` | M. Bins contents method cho R nhưng class M vẫn áp đồng thời nên **Staff không đủ quyền**. Không có GET Zones/{id} trong controller |
| Documents | GET `/InboundReceipts`, `/list`, `/{id}`; `/OutboundOrders`, `/list`, `/{id}` | R; outbound detail BinId mapping mới chỉ ở working tree |
| Inventory | GET `/Inventory/stock-summary`, `/low-stock-alerts`, `/stock-history` | J; physical totals, không available-to-promise |
| Transfers | GET `/InventoryTransfers`, `/list`, `/{id}` | R; rows từ InventoryTransaction, không transfer document |
| Cycle Counting | GET `/CycleCounting/{id}`, `/pending-tasks` | J; assignment filter chỉ pending tasks; không có paginated/list route dù query handlers tồn tại |
| Dashboard | GET `/Dashboard/executive`, `/inbound-outbound-chart`, `/warehouse-occupancy`, `/ai-agent-metrics`, `/ai-slotting-recommendations` | J; executive/slotting có AI dependency, chart theo UTC và ledger types |
| Audit | GET `/AuditLogs` | A; read audit C/U/D, thiếu entity PK |
| Partners/users | GET `/Suppliers`, `/list`, `/{id}`; `/Customers`, `/list`, `/{id}`; `/Users`, `/list`, `/{id}` | Suppliers M, Customers R, Users A |
| Other reads | GET `/Forecasts/demand-prediction`, `/Reports/export/excel` | M; forecast Gemini runtime chưa xác nhận |

Pagination không thống nhất: Products dùng pageNumber/pageSize/searchKeyword; inbound/outbound controller map pageNumber/pageSize/searchTerm sang PageIndex/PageSize/SearchKeyword; transfers dùng pageNumber/pageSize/productId/searchKeyword. Không đồng nhất tên query bằng suy luận. Xem controller declaration appendix.

## Đối chiếu OpenAPI/controller/handler

- `Program.cs`: `AddOpenApi`, `MapOpenApi` và Swagger UI chỉ trong Development; document `/openapi/v1.json`, UI `/swagger`. Không khởi động API để sinh OpenAPI runtime trong audit này; việc đối chiếu dựa trên route/action signatures và handler source. Chưa xác nhận schema sinh ra mô tả Result/ProblemDetails đầy đủ vì action trả IActionResult.
- `confirm-receipt` không gọi ConfirmInboundReceiptCommand; `allocate-pick-task` không tạo task; `create-wave-pick` không persist wave; `report-damage` không đổi stock; `validate-weight` không persist Packed; ship không tạo shipment; cycle create là command wrapper.
- Không expose handler-only MoveInventory/MoveLpn/LockExpiredStock, schedule count, get cycle list/paginated thành route mới trong tài liệu.
- Mọi Stable/Partial/Unsafe trong bảng là đánh giá **implementation + evidence**; kết quả HTTP 200 không chứng minh quantity/reservation/history/audit đúng.

## Source appendix

Đường dẫn dưới đây tương đối từ file này, là nơi đối chiếu chữ ký/DTO/validator. Các command class là wrapper RequestData, **không phải tất cả wrapper đều đi thẳng qua HTTP**.

- [Controllers](../SmartWMS.Api/Controllers/): tất cả route, body/query binding và authorization.
- [Inbound commands/validators](../SmartWMS.Application/Features/InboundReceipts/Commands/) và [DTO](../SmartWMS.Application/Features/InboundReceipts/DTOs/).
- [Inventory commands/validators](../SmartWMS.Application/Features/InventoryManagement/Commands/) và [DTO](../SmartWMS.Application/Features/InventoryManagement/DTOs/).
- [Transfer commands/validators](../SmartWMS.Application/Features/InventoryTransfers/Commands/) và [DTO](../SmartWMS.Application/Features/InventoryTransfers/DTOs/).
- [Outbound commands/validators](../SmartWMS.Application/Features/OutboundOrders/Commands/) và [DTO](../SmartWMS.Application/Features/OutboundOrders/DTOs/).
- [Cycle count commands/validators](../SmartWMS.Application/Features/CycleCounting/Commands/) và [DTO](../SmartWMS.Application/Features/CycleCounting/DTOs/).
- [Product commands/validators](../SmartWMS.Application/Features/Products/Commands/) và [DTO](../SmartWMS.Application/Features/Products/DTOs/).
- [Warehouse commands](../SmartWMS.Application/Features/Warehouses/Commands/), [Zone commands](../SmartWMS.Application/Features/Zones/Commands/), [Bin commands](../SmartWMS.Application/Features/Bins/Commands/).
- [Supplier commands](../SmartWMS.Application/Features/Suppliers/Commands/), [Customer commands](../SmartWMS.Application/Features/Customers/Commands/), [User commands](../SmartWMS.Application/Features/Users/Commands/).
- [InventoryMutationCoordinator](../SmartWMS.Infrastructure/Services/InventoryMutationCoordinator.cs), [CycleCountCoordinator](../SmartWMS.Infrastructure/Services/CycleCountCoordinator.cs), [EF configurations](../SmartWMS.Infrastructure/Persistence/Configurations/), [Audit/SaveChanges](../SmartWMS.Infrastructure/Persistence/DbContext/ApplicationDbContext.cs).
