# SmartWMS — Inventory and API rules

Source: B1a `f74b00e2fdf2d9c06c59334e7b1038fa9c7766bc`, đọc lại controller/handler ngày **15/11/2026**. Đây là reference nghiệp vụ hiện hành trong scope None/Lot, **không phải chứng nhận runtime mới**. [Source provenance](PROJECT_CONTEXT.md) phân biệt M/P/O/G.

Tài liệu này hợp nhất lifecycle trước đây ở LIFECYCLE_STATUS và phần rules lặp của API audit cũ. [FE_API_HANDOFF](FE_API_HANDOFF.md) giữ catalogue routes, DTO/query/response fields, error/provider và FE refresh map; không lặp lại toàn bộ 97 endpoint tables ở đây. [Backend handoff](BACKEND_HANDOFF.md) và phase reports giữ evidence lịch sử, không phải current permission matrix.

## Wire and authorization

- Base route thường `/api/v1`; controller là authority. Tên command/query không tự tạo public endpoint. JSON DTOs dùng camelCase; body trực tiếp trừ wrapper được controller bind rõ, như Cycle Count create.
- Success qua [ResultExtensions](../backend/src/SmartWMS.Api/Extensions/ResultExtensions.cs) là HTTP 200 + Result, kể cả create/delete; không mặc định 201/204. Reports/export trả binary XLSX; vision endpoints có custom envelope.
- Result failure có `isSuccess:false,message,errorCode,errors`; exception/model binding có ProblemDetails/ValidationProblemDetails. Middleware 401/403 có thể bodyless; path/body ID mismatch có thể chỉ có message. Không parse business flow từ message tiếng Việt.
- 400 validation/business rejection; 401 authentication; 403 role/ownership; mapped not-found 404 (một số legacy missing-object vẫn 400); 409 conflict/uniqueness/state; unexpected/storage 500. Provider/schema/timeout có 502/503/504; provider 401 không phải FE login expiry.
- Enum numeric: TrackingMode None=0/Lot=1/Serial=2, BinPurpose Storage=0/Staging=1, InventoryStatus Available=1/Reserved=2/QCHold=3/Damaged=4/Expired=5. Bin-content display status/expiry có thể là string; không dùng display value làm mutation payload.
- Paging khác nhau theo controller: thường pageNumber/pageSize; stock-history bind pageIndex; Users có shape totalRecords/totalPages/items. Không chuẩn hóa DTO/query names bằng suy đoán.
- Backend roles và handler ownership cùng thực thi quyền; class/method attributes giao nhau. Không warehouse ACL/multi-tenancy. Frontend ẩn nút không thay authorization.

| Hành động | Quyền tại B1a |
| --- | --- |
| Inbound create | Admin/WarehouseManager; Staff bị từ chối ở method authorization |
| Inbound receive/update/delete, bin transfer, B3 execution | Admin/WarehouseManager/Staff theo controller và state guards |
| Adjust/status/replenish; count create/assignees; executive/slotting | Admin/WarehouseManager |
| Count detail/confirm | Admin/WM override; Staff phải đúng AssignedUserId của sheet |
| Users/AuditLogs | Admin; count assignee lookup không cấp WM user CRUD |
| Bin contents | Admin/WM do controller/method intersection |
| Product/Customer master CRUD và một số outbound planning/ship | Broad Staff admission vẫn có; product policy chưa được giải quyết bởi tài liệu |

Nguồn: [Inbound controller](../backend/src/SmartWMS.Api/Controllers/InboundReceiptsController.cs), [Inventory controller](../backend/src/SmartWMS.Api/Controllers/InventoryController.cs), [Cycle controller](../backend/src/SmartWMS.Api/Controllers/CycleCountingController.cs), [CycleCountAccess](../backend/src/SmartWMS.Application/Features/CycleCounting/CycleCountAccess.cs), [S1 historical matrix](PHASE_S1_ROLE_MATRIX.md). Matrix S1 trước inbound-create fix không được dùng để cho Staff tạo receipt.

## Stock and transactions

`ATP = Quantity - ReservedQuantity`. `GET /Inventory/stock-summary` trả physical Quantity của active products có inventory rows, mọi inventory status; **không trừ reservations**. totalQuantity là Int64/JSON integer; lowStockItems dùng physical aggregate <20. Không tự biến summary thành ATP. Capacity/occupancy theo unit counts, không thể tích/khối lượng.

Inventory identity gồm bin/product/normalized lot/status cùng metadata constraints. Các hardened commands trim/normalize blank lot về `LOT-DEFAULT`; receipt creation có legacy fallback `N/A`. Không coi hai lot đó là cùng identity. Không tự chọn First() khi nhiều matching rows/lots, không bỏ expiry/LPN/serial evidence guards.

SaveChanges atomic cho write batch không tự bảo vệ read/check trước đó. Hardened stock flows dùng coordinator/explicit transaction, SQL locks/range locks và rowversion; direct B3 còn locks/reloads order/items/reservations. Audit đi cùng SaveChanges; inventory ledger giữ stock/workflow references riêng. Notification không thay ledger hoặc transaction receipt; receiving catch/log lỗi notification sau commit vẫn trả success. Không có distributed outbox guarantee.

Không bỏ transaction boundaries, capacity/overflow bounds, locks, constraints, rowversion, audit/ledger hoặc conflict handling để đơn giản hóa. Source: [InventoryMutationCoordinator](../backend/src/SmartWMS.Infrastructure/Services/InventoryMutationCoordinator.cs), [CycleCountCoordinator](../backend/src/SmartWMS.Infrastructure/Services/CycleCountCoordinator.cs), [inventory rules](../backend/src/SmartWMS.Application/Common/Inventory/InventoryMutationRules.cs).

## Inbound

Flow: create New → receive delta trực tiếp vào receipt bin → Processing hoặc Completed khi mọi received==expected. **Không có dock-receive/putaway/complete endpoint riêng**. Suggestion là read-only, không giữ capacity; putaway sau receive dùng explicit inventory transfer.

| Command | Contract và state/stock effect |
| --- | --- |
| POST /InboundReceipts | receiptNumber, supplierId, binId, expectedDeliveryDate, nonempty items[{productId,expectedQuantity,lotNumber?,expirationDate?}], optional referenceDocument/notes. New receipt/items received=0; không cộng stock. Duplicate-number precheck không phải replay key/concurrency guarantee. |
| PUT /InboundReceipts/{id} | Body id khớp route; chỉ trước nhận (mọi QuantityReceived=0), states New/Pending/Draft; active IDs/hierarchy. Item edit theo unique productId/expectedQuantity, không có itemId/lot/expiry edit; giữ retained detail IDs/metadata, từ chối ambiguous duplicate product lines. |
| POST /InboundReceipts/confirm-receipt | {inboundReceiptId,receivedItems:[{itemId,quantityReceived,expectedReceivedQuantity}]}; itemId là receipt-item ID; selected lines được phép nhưng ID phải unique/đúng receipt. quantityReceived là **delta dương**, expectedReceivedQuantity bắt buộc nonnull>=0 và bằng latest received trước delta. |
| DELETE /InboundReceipts/{id} | Chỉ New; hard removal theo FK, không đảo tồn. Repeated delete không cached success. |

Receive chỉ New/Pending/Processing; Draft/terminal/stale precondition conflict. Validate cả batch trước mutation: remaining/no over-receipt, active receipt/bin/zone/warehouse/product/supplier nếu có, tracking snapshot, None/Lot, unique normalized Available identity, expiry khớp/chưa expired, không LPN/reserved/workflow/serial evidence, occupancy=physical và capacity/overflow. Commit receipt/items + Available quantity/bin occupancy + INBOUND ledger + audit cùng transaction. Bất kỳ lỗi nào rollback batch.

Sau 409 không tự refresh expected rồi gửi lại delta cũ. Sau timeout/lost response đọc receipt/item counters, bin stock và history trước quyết định mới. Old delta có thể đã commit.

`ConfirmInboundReceiptCommandHandler` cũ không phải handler của confirm-receipt route. Crossdock route là legacy partial line-match/split/TRANSFER ledger, không receipt/stock-backed fulfillment; direct B3 lines bị chặn. OCR chỉ trích invoice, damage chỉ advisory, không tạo receipt hoặc đổi stock thành Damaged.

Nguồn: [Receive handler](../backend/src/SmartWMS.Application/Features/InboundReceipts/Commands/ReceiveInboundReceipt/ReceiveInboundReceiptCommandHandler.cs), [Inbound DTOs](../backend/src/SmartWMS.Application/Features/InboundReceipts/DTOs), [B1 evidence](PHASE_B1_INBOUND.md). Chi tiết vision validation/response và list/detail projections ở FE catalogue.

## Transfer

`POST /InventoryTransfers`: {productId,sourceBinId,destinationBinId,transferQuantity,lotNumber,reason}. Quantity>0, hai bins khác nhau, active hierarchy và **cùng warehouse**. Source Available duy nhất, destination Available tối đa một; active product không Serial; source không LPN; dùng ATP, không consume reserved. Destination expiry/LPN phải khớp; giữ quantity/reservation, integer overflow và occupancy/capacity bounds.

Một transaction: source physical -=qty, destination +=qty; reserved giữ nguyên; hai bin occupancy -/+qty; TRANSFER ledger source/destination IDs/codes + audit. Copy source lot/expiry nếu tạo destination. Trả **InventoryTransaction.Id**, không phải transfer document/task ID. GET transfer routes đọc ledger; không có Draft/Approved/InTransit/Complete workflow.

Không request-id dedup: gửi lại có thể move lần nữa. Reconcile source/destination/history trước retry. [Transfer handler](../backend/src/SmartWMS.Application/Features/InventoryTransfers/Commands/CreateInventoryTransfer/CreateInventoryTransferCommandHandler.cs).

## Outbound

Direct B3: **Pending → Allocated → Picked → Packed → Shipped**, whole-order, một source bin/order, None/Lot không LPN; FEFO có thể chia nhiều rows/lots trong bin.

| Bước | Endpoint / payload | Effect |
| --- | --- | --- |
| Create | POST /OutboundOrders; header và items productId/requestedQuantity | Pending/direct lines, chưa reserve/stock |
| Allocate | POST /OutboundOrders/allocate-pick-task; {outboundOrderId}; assignedUserId omit/null | Reserve toàn đơn theo ATP; persisted allocation/reservation + lot/expiry/mode snapshots. Physical/occupancy giữ; RESERVATION delta0. Không tạo assigned PickTask. |
| Pick | POST /OutboundOrders/{id}/pick; {items:[{reservationId,quantity}]} | Exact full reservation set/quantity, không partial. Physical/reserved/occupancy -=qty **đúng một lần**, OUTBOUND -qty với exact references; duplicate/stale conflict. |
| Pack | POST /OutboundOrders/{id}/pack; không body | Picked→Packed, audit; **không stock/occupancy/ledger deduction** |
| Ship | POST /OutboundOrders/{id}/ship; body {} | Packed→Shipped, progress/allocation terminal; SHIP_CONFIRM delta0, không fabricate Shipment/staging |
| Cancel | DELETE /OutboundOrders/{id} | Pending/Allocated→Cancelled+soft-delete; release đúng own reservations, physical giữ. Picked/Packed không có reversal. |

Pack/Ship same-target có thể success no-op khi persisted evidence còn consistent; không biến thành general mutation idempotency. Allocate/pick duplicates conflict; create/update/delete không cached replay success.

Reservation.Quantity giữ original allocation; outstanding trước Pick = Quantity - PickedQuantity - ReleasedQuantity. Lot/expiry snapshot ở reservation, tracking mode ở line; IsDirectPick/mode FKs tách legacy staged path. Pending update chỉ khi zero progress/no workflow/history refs; replace line IDs, không sửa mode của persisted legacy line. Wave/serial/weight advisory không bypass direct state guards; weight validation không tự Packed.

Nguồn: [OutboundLifecycle](../backend/src/SmartWMS.Application/Features/OutboundOrders/OutboundLifecycle.cs), [DTOs](../backend/src/SmartWMS.Application/Features/OutboundOrders/DTOs), [B3 schema/verification history](PHASE_B3.md).

## Cycle Counting

Create AM snapshot Pending → client đếm → confirm toàn sheet atomically Completed. Không có riêng draft-count/save/submit/approve/correct/complete hoặc global-list/reassign/cancel HTTP APIs. ScheduleAutoCycleCount handler unsupported, không tự expose thành endpoint.

Create body **{requestData:{zoneId?,binId?,notes?,assignedUserId?}}**. Scope bin/zone phải hợp lệ, active hierarchy; assignee active nếu có; stock scope nonempty/unambiguous. Không Serial/LPN/serial evidence/reserved/workflow; occupancy hợp lệ. Persist sheet/items với snapshot BinInventoryId + 8-byte RowVersion + exact quantity/lot; **không freeze stock qua nhiều requests**.

GET pending-tasks dùng authenticated user ID; operatorName query chỉ compatibility, không override identity. GET detail và confirm kiểm Staff assignment; Admin/WM override. Assignee picker có AM lookup riêng; Users list vẫn Admin-only.

Confirm body {countSheetId,notes?,countedItems:[{itemId,countedQuantity}]}; itemId là CycleCountItem.Id, đủ exact set một lần, countedQuantity required/non-null>=0. Lock/reload sheet trước ownership, kiểm snapshot ID/rowversion/qty/lot và supported stock scope; stale/ambiguous→409.

Validate toàn batch rồi áp delta=counted-system, aggregate occupancy theo bin; ADJUSTMENT ledger cho từng nonzero variance, ReasonCode gắn sheet ID; zero variance không ledger. Items Matched/Discrepancy và sheet Completed cùng audit/stock commit. Completed/Cancelled replay→409; không tự đổi snapshot để correction lại.

Nguồn: [Create command](../backend/src/SmartWMS.Application/Features/CycleCounting/Commands/CreateCountSheet/CreateCountSheetCommand.cs), [Confirm handler](../backend/src/SmartWMS.Application/Features/CycleCounting/Commands/ConfirmCycleCount/ConfirmCycleCountCommandHandler.cs), [access rules](../backend/src/SmartWMS.Application/Features/CycleCounting/CycleCountAccess.cs).

## Kitting and replenishment

`POST /Kitting/assemble` AM: {kitProductId,targetBinId,assembleQuantity,components:[{componentProductId,sourceBinId,quantityPerKit}]}. Recipe từ request, không stored BOM. Combine duplicate component requirements với overflow checks; active None/Lot products, unique supported Available rows/lot identity, ATP/expiry/LPN/serial/workflow và net capacity/occupancy guards. Component issue + output receipt + occupancy + ledger/audit atomic. Kit không là component của chính nó; existing output không merge vào reserved/workflow stock. Không tự chọn lot khi request không định danh được.

`POST /Inventory/run-auto-replenish` AM **không body**, trả Result<int> số movements committed, không task IDs. Low-bin plan dùng supported metadata/hierarchy, cùng warehouse, Available/ATP, exact refill/capacity và chống reverse donor behavior; lock/validate batch trước write. **0 movements là success hợp lệ**. Conflict rollback batch; không có request key.

Cả hai khác các P0 findings trước K1/R1 trong backend handoff cũ. Request lặp Kitting có thể assemble batch khác; replenishment re-evaluate state không tạo immutable idempotency guarantee.

Nguồn: [Kitting handler](../backend/src/SmartWMS.Application/Features/Kitting/Commands/AssembleKit/AssembleKitCommandHandler.cs), [Replenishment handler](../backend/src/SmartWMS.Application/Features/InventoryManagement/Commands/AutoReplenish/AutoReplenishCommandHandler.cs), [K1 history](PHASE_K1.md), [R1 history](PHASE_R1.md).

## Other contracts and integration boundaries

- Adjust-stock là signed delta, reason bắt buộc, normalized lot lookup không được ambiguous giữa statuses. Không sourceStatus/rowId/partial quantity field trong change-status; đổi cả row. Same-status no-op không ledger/audit/event; không suy replay key. Giữ reserved floor/workflow guards.
- Product core creation best-effort embedding: provider lỗi dự kiến có thể lưu null vector; không giả vector thành công. Product create Width/Height/Depth DTO chưa được persist; đọc weight/barcode không cấp quyền weight/dimension editing hoặc NameEn contract.
- JWT logout không revoke tokens; no refresh/revoke/warehouse tenancy promise. Không log login/user payloads. Master PUT không phải PATCH; omitted scalars có thể overwrite bằng defaults. Deletes có FK/history dependencies; không tự cascade để hết lỗi.
- XLSX export là bin capacity/occupancy, không SKU/Lot ledger. SignalR không phải transaction receipt hoặc per-warehouse isolation; REST refetch vẫn là authority.
- `/healthz` có external Google models call; không poll như harmless local heartbeat. Hangfire local-only filter không phải JWT role và có reverse-proxy risk. Swagger/OpenAPI chỉ Development. Provider quota/config/schema errors phải hiển thị trung thực.
- Không promote crossdock, Wave/Serial/LPN, physical staging/reversal, stored BOM, mobile/PDA hoặc manager-wide count listing từ entity/route presence.

Chi tiết endpoint/fields, image size/MIME/signature/schema validation, provider fallback, master CRUD, barcode/QR/semantic search và action→cache refresh ở [FE_API_HANDOFF](FE_API_HANDOFF.md). Trước mutation duplicate submissions phải bị chặn ở UI, nhưng đó không phải exactly-once guarantee. Sau unknown outcome đọc detail/stock/ledger phù hợp role trước quyết định gửi lại; không auto-retry.
