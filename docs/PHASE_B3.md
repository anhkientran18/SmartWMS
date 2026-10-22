# Phase B3 — direct-pick minimal WMS lifecycle

Ngày 2026-10-22 (Asia/Saigon), branch `main`, base HEAD `ae171fcef83d038f9678c39470bd15c6de7f8aac`. Implementation trong working tree, **chưa stage/commit**, chờ review manifest. [Audit B3.0](PHASE_B3_AUDIT.md) ghi behavior trước sửa; quyết định forward migration/direct-pick đã được user duyệt sau audit.

## Root cause và scope cuối

Trước B3, allocate/wave chỉ đổi string status, không reserve; pick chỉ dùng serial theo OrderNumber và trừ stock mà không consume reservation; validate-weight không tạo Packed; ship đi thẳng từ Picked và không cập nhật workflow progress entities. RowVersion/SaveChanges riêng lẻ chưa bao phủ toàn read/check/commit. Schema nền lại yêu cầu physical staging inventory cho picked reservation, trái với accounting deduct-at-Pick của handlers.

B3 triển khai **Pending → Allocated → Picked → Packed → Shipped**, whole-order, **một source bin từ order.BinId**, None/Lot không LPN/serial evidence. Có thể chia nhiều lot/stock rows trong chính bin đó, FEFO expiry rồi inventory ID; expiry null xếp cuối. Không tự lấy stock từ bin khác. Không task assignment, wave engine, carton/shipment subsystem, Returns, Kitting hoặc Replenishment.

## Một forward migration, bảo toàn staged path

Migration mới duy nhất: `20261022132945_AddDirectPickWorkflow` (source HEAD có **31 migrations**). Historical migrations không sửa.

- `IsDirectPick:bit NOT NULL DEFAULT 0` trên OutboundAllocation, InventoryReservation, OutboundOrderItem. Existing records giữ false/staged; không tự chuyển đơn cũ sang direct-pick.
- Allocation.StagingBinId nullable. Check tách hai nhánh: direct phải NULL; staged phải nonnull và khác source.
- Reservation direct không có staging inventory; staged giữ nguyên rule picked>0 bắt buộc staging inventory khác source. Progress bounds và status checks cũ vẫn giữ.
- Composite FK từ reservation đến allocation và line gồm IsDirectPick, ngăn cross-mode reference. Các alternate keys/FKs lịch sử khác vẫn được giữ để không phá shipment/task relationships.
- Line direct có StagedQuantity=0, `0 <= ShippedQuantity <= PickedQuantity <= Quantity`. Staged line giữ chain `Shipped <= Staged <= Picked <= Quantity`; reserved bounds vẫn giữ.
- Reservation có SourceLotNumber nullable(50), SourceExpirationDate nullable: snapshot metadata cho direct-pick, staged legacy mặc định null. Pick đối chiếu exact source row, normalized lot và expiry snapshot; không tự tìm row khác khi stale.
- New create/replaced lines dùng direct flag ngay lúc tạo; mode là một phần alternate key nên không đổi mode của persisted line. Existing legacy Pending không được allocate theo B3 bằng cách tự reinterpret: cần tạo đơn mới hoặc edit Pending không có history/workflow theo guard hiện có, tạo line IDs mới.

Đã verify fresh actual chain→31, checkpoint30→31 với staged order/allocation/reservation/stock đã tồn tại, mode defaults, staged topology/progress guards, direct valid/invalid checks, mode FK, model/snapshot match và deployed migration rerun no-op. Chỉ forward path được xác nhận; không downgrade sau khi có direct workflow data.

**SmartWMS_DB giữ nguyên checkpoint30, chỉ đọc snapshot**. Migration B3 chưa được apply vào database nghiệp vụ trong phase này; cần bước deployment riêng sau review. Phase4A read-only preflight nay chấp nhận current DB hoặc chính xác checkpoint30 với chỉ migration B3 pending; vẫn reject mọi pending set/baseline khác. Không đổi mutation assertions/timeout/lock implementation của Phase4A.

## Inventory, reservation, transaction

- ATP = Quantity - ReservedQuantity; stock status vẫn Available khi reserve, không đổi thành enum Reserved. Loại QCHold/Damaged/Expired/Reserved rows, expiry đã đến hạn, LPN/serial evidence, inactive hierarchy/product, unsupported tracking.
- Allocation full-order atomic: persisted OutboundAllocation(active/direct) + InventoryReservation exact stock/line IDs; stock.ReservedQuantity và line.ReservedQuantity tăng, Quantity/occupancy không đổi. Snapshot TrackingMode trên line và lot/expiry trên reservation. Existing reservations của người khác vẫn được trừ khỏi ATP.
- Pick yêu cầu đúng toàn bộ active reservations và full quantity, consume reserved counter, trừ physical Quantity/occupancy đúng một lần; line/reservation.PickedQuantity cập nhật, line.ReservedQuantity=0. Zero-stock rows giữ lại vì history FK. Reservation.Quantity là lượng originally allocated, không phải outstanding counter; outstanding chưa pick = Quantity - PickedQuantity - ReleasedQuantity.
- Pack chỉ Picked→Packed khi persisted progress đầy đủ; không kiểm cân/carton, không inventory mutation. validate-weight vẫn là helper legacy, không tự pack đơn.
- Ship chỉ Packed→Shipped, reservation/line shipped progress đầy đủ, allocation inactive/Shipped; không stock/occupancy mutation lần hai. Không fabricate Shipment/StagingBin entities cho direct path.
- Pending cancel: soft-delete header, Cancelled, không inventory effect. Allocated cancel: giảm reserved counter đúng lượng của mình, giữ reservation Released và audit/history, allocation inactive/Released; không giảm physical. Cho phép release sau khi source đã soft-delete/expired, vẫn kiểm valid counter. Picked/Packed cancel reject vì chưa có reversal semantics.
- Ledger: RESERVATION(delta0, reason RESERVE:qty), OUTBOUND(delta=-qty tại Pick), SHIP_CONFIRM(delta0), RESERVATION_RELEASE(delta0, reason CANCEL:qty). Exact BinInventoryId/OutboundOrderItemId/InventoryReservationId links. Audit cùng SaveChanges/transaction; audit actor/properties theo DbContext hiện có. Reservation/history giữ traceability qua Guid, không dùng OrderNumber làm inventory identity.
- Mọi lifecycle transition qua RepeatableRead transaction hiện có, UPDLOCK/HOLDLOCK order/header/items/allocation/reservation/source-stock ranges, active bin hierarchy locks; dữ liệu tracked được reload trước mutation. Lock/read metadata hoàn tất **trước** tăng counters để không refresh mất mutation của lot/line trước. Products được đọc fresh AsNoTracking trong transaction, giữ shared locks qua commit.
- Order lock serialize allocate/pick/pack/ship/cancel; bin/stock locks serialize ATP với writers khác. RowVersion + DB checks/FKs/unique active allocation/order là lớp bảo vệ tiếp. Update Pending cũng lock order để không race replace-lines với allocation.
- SQL1205/1222, rowversion và known allocation unique conflict→COM_409; SQL command timeout→conflict yêu cầu reload, không blind replay. Unknown DB errors không bị che bằng success/retry. Bất kỳ prevalidation failure/post-save injected fault đều rollback/clear tracker. Không notification sau commit trong direct path.

## FE contract hiện hành

Base `/api/v1/OutboundOrders`, JWT roles **Admin, WarehouseManager, Staff**. Success HTTP200 Result<T>, create data=Guid; lifecycle mutations data=true. Có HTTP smoke Admin; chưa full role matrix/load test.

| Endpoint | Request | Before → after / retry | Scope |
| --- | --- | --- | --- |
| POST root | `{orderNumber, binId, customerId?, expectedShipDate, priority?, notes?, items:[{productId,requestedQuantity}]}` | Tạo Pending/direct lines. RequestedQuantity positive int32; expectedShipDate >= UTC today; product active None/Lot/customer active nếu có. Không reserve tại create | Scoped supported; create không có request key, OrderNumber uniqueness chỉ precheck |
| POST `/allocate-pick-task` | `{outboundOrderId}`; bỏ assignedUserId | Pending→Allocated, toàn bộ requested quantity được reserve. Duplicate/unknown outcome:409, GET lại; không reserve lần hai | B3 scoped Stable sau focused/HTTP; không tạo PickTask dù route legacy tên như vậy |
| GET `/{id}` | Không body | Header có orderNumber/binId/status/isDirectPick; items có quantity, trackingModeSnapshot, reservedQuantity, pickedQuantity, shippedQuantity, status/isDirectPick và reservations | Dùng để dựng pick payload; list/pagination chỉ header summaries, không mặc định Items=[] là đơn trống |
| POST `/{id}/pick` | `{items:[{reservationId,quantity}]}` | Allocated→Picked. Quantity là lượng pick full của reservation, bằng reservation.quantity; mỗi ID đúng một lần và bao phủ toàn đơn. Không partial pick. Duplicate/stale/mismatch/over-pick409, GET lại | B3 scoped Stable None/Lot không LPN |
| POST `/{id}/pack` | Không body (hoặc `{}` không được sử dụng) | Picked→Packed. Same Packed với progress hợp lệ: success no-op, không thêm audit/ledger; state khác409 | Minimal state packing; không weight/carton validation |
| POST `/{id}/ship` | `{}` | Packed→Shipped. Không gửi PackingChecks của serial path. Same Shipped với persisted evidence đúng: success no-op, không ledger/audit/stock lặp | B3 scoped Stable; deduction đã ở Pick |
| DELETE `/{id}` | Không body | Pending/Allocated→Cancelled + IsDeleted=true. Allocated release atomically; Picked/Packed409. Sau cancel GET detail404 theo soft-delete filter | Supported cho B3; duplicate delete không cached success |

Reservation DTO: `{id,allocationId,sourceBinInventoryId,lotNumber,expirationDate,quantity,pickedQuantity,shippedQuantity,releasedQuantity,status}`. TrackingModeSnapshot numeric0/1; có thể null trước allocation. Status reservation vẫn Picked khi order Packed, rồi Shipped khi ship. Source lot/expiry là metadata snapshot đã allocate, không là instruction để FE chọn stock mới.

400: malformed/binding input, IDs empty, empty/duplicate pick item IDs, quantity<=0, create unsupported product/customer, assignedUserId không được hỗ trợ, ship PackingChecks không rỗng. 404: missing order; detail canceled bị filter. 409: insufficient ATP, hierarchy/identity/progress invalid, stale mode/lot/expiry/status/counter, duplicate allocate/pick, wrong lifecycle state, lock/rowversion conflict, direct order gọi legacy serial/wave.

Retry: allocate/pick không cached response, không request key; khi409 hoặc response mất, GET order/reservations/history để xác định trạng thái rồi mới quyết định. Không tự replay create sau unknown outcome hoặc tự đổi reservation/quantity để ép request cũ thành mới. Pack/Ship chỉ no-op ở đúng completed state với persisted progress hợp lệ; không reset trạng thái. Body quantity không phải cumulative progress hay adjustment.

## Legacy / unsupported

- Existing serial pick/ship/wave implementation được giữ; **Partial**, không được promote bằng B3. New B3 create/allocate chỉ None/Lot. Serial endpoint reject direct/None/Lot; wave reject bất kỳ direct line, kể cả Pending, nên không bypass reservation lifecycle. Quantity pick không diễn giải ScannedSerials.
- LPN không được chọn khi allocate, serial evidence cũng bị loại. Không tích hợp Serial/LPN/wave/task assignment/partial pick/multi-source-bin cho FE trong scope Stable.
- Staged **schema compatibility** đã test; không đồng nghĩa staged/serial endpoints đã thành workflow E2E hoàn chỉnh.

## Verification evidence

| Verification | Kết quả |
| --- | --- |
| Solution + verification build | PASS, 0 warnings/errors |
| B3 schema/migration | 24 assertions PASS |
| B3 focused lifecycle | 166 assertions PASS (161 full lifecycle + 5 stale tracked-context) |
| B3 real HTTP | 46 assertions PASS |
| Phase4A / Phase4B / ReleaseHardening / DeleteRace / Inbound B1 | 95 / 107 / 65 / 31 / 142 PASS |
| B2 summary / migration compatibility | 15 / 25 PASS (actual chain hiện có 31 migrations) |

Focused bao gồm None/Lot happy paths; stale tracked Pending lines trả COM_409 và rollback, explicit reload/cancel thành công; full-order shortage rollback; split lots và duplicate product lines; outside-bin exclusion; existing reservation/QCHold/Damaged/Expired/expiry/LPN/hierarchy; stale tracking/lot/expiry/status/counter; duplicate allocate/pick/pack/ship; concurrent two-order/same-order allocation, allocation vs adjustment; status-change and legacy endpoint guards; real SQL1222→409, no retry; cancel/release, Picked/Packed cancellation reject; post-Save allocation/pick/ship rollback; no negatives/history/occupancy drift.

HTTP clean fixture: login→create two-line None/Lot order→allocate→read order/reservations/inventory→pick→read→pack→ship→final read/history; physical20→20→13→13, reserved0→7→0, occupancy20→13, ledger exactly -7. Duplicate pick409 unchanged snapshot; duplicate ship success no-op; Allocated DELETE adapter releases reservation without physical movement. Assertions kiểm persisted business state, không chỉ HTTP200.

Reports ngoài repository: `%TEMP%/SmartWMS-B3/reports/`; kết quả cuối final-schema (24), complete-focused (161), complete-cached-context (5), complete-http (46) và regression-*; Phase4B dùng regression-Phase4B-fixed (107). `split-diagnosis` giữ evidence lỗi B3 split-lot đã sửa (reload reset counter); timeout test probe chuyển sang exception boundary vì CommandFailed không bao phủ lỗi reader materialization. Không tăng timeout/đổi business expected behavior/thêm retry để PASS. Fixture prefixes B3/regression riêng, cleanup xác nhận trong console. SmartWMS_DB chỉ read-only snapshot, không chạy host/seed/migrate/jobs trên business DB.

## Remaining P0/P1 và review

- Hai finding Outbound allocate/None-Lot pick lifecycle trước B3 đã xử lý trong scope ở trên; không mở rộng Stable cho toàn Outbound.
- P0 ngoài scope: Kitting occupancy/capacity, AutoReplenishment identity/reservation/metadata. Không sửa trong B3.
- P1/limitations: legacy Serial/LPN/wave vẫn Partial/Unsupported; create OrderNumber uniqueness chỉ precheck và không replay key; full role/load/lost-network-response testing chưa đủ. Không có multi-bin allocation/partial fulfillment/return/cancel reversal sau Pick. Existing unrelated crossdock vẫn Unsafe và không phải route để hoàn tất lifecycle B3.
- Chưa stage/commit. Giữ nguyên 25 dirty baseline paths, không include README/PasswordHasher/csproj.user/bin/obj/generated. Migration Designer/ModelSnapshot là source schema cần review, không phải build artifacts.

Manifest exact allowlist bên dưới được lấy từ working-tree diff/untracked files, loại đúng 25 baseline paths. Chưa stage hoặc commit; chỉ đề xuất hai commit để review. Mọi kết quả cuối exit 0, fixture cleanup thành công. Regression chỉ chạy lại Phase4B sau setup fix; Phase4A và các suite còn lại chạy một lượt cuối, không lặp để tìm PASS.

Các failure trong phát triển được giữ trong reports: split-lot counter reset là implementation defect đã sửa trước kết quả cuối; Phase4B schema-delta failure là fixture áp dụng thêm migration ngoài delta cần kiểm, sửa setup chứ không đổi assertion; timeout probe dùng exception boundary để thấy reader-phase SQL1222. Cached-context test ban đầu đòi success trong cùng stale context, đã chỉnh về contract concurrency đúng (409 + rollback + explicit reload), không sửa backend để ép success.

## Proposed commit manifest (chưa stage)

Commit 1 — feat: implement direct-pick outbound lifecycle and verification: **36 files**.

- SmartWMS.Api/Controllers/OutboundOrdersController.cs
- SmartWMS.Application/Common/Interfaces/IOutboundCoordinator.cs
- SmartWMS.Application/DependencyInjection.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/CreateOutboundOrder/CreateOutboundOrderCommandHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/CreatePickTask/CreatePickTaskCommandHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/CreateWavePickTask/CreateWavePickTaskCommandHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/DeleteOutboundOrder/DeleteOutboundOrderCommandHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/DirectPick/DirectOutboundCommands.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/PickWithSerial/PickWithSerialCommandHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/ShipOutboundOrder/ShipOutboundOrderCommandHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/ShipOutboundOrder/ShipOutboundOrderCommandValidator.cs
- SmartWMS.Application/Features/OutboundOrders/Commands/UpdateOutboundOrder/UpdateOutboundOrderCommandHandler.cs
- SmartWMS.Application/Features/OutboundOrders/DTOs/Commands/DirectPickRequest.cs
- SmartWMS.Application/Features/OutboundOrders/DTOs/OutboundOrderDto.cs
- SmartWMS.Application/Features/OutboundOrders/DTOs/OutboundOrderItemDto.cs
- SmartWMS.Application/Features/OutboundOrders/OutboundLifecycle.cs
- SmartWMS.Application/Features/OutboundOrders/Queries/GetList/GetOutboundOrderListQueryHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Queries/GetOutboundOrderById/GetOutboundOrderByIdQueryHandler.cs
- SmartWMS.Application/Features/OutboundOrders/Queries/GetPaginatedOutboundOrders/GetPaginatedOutboundOrdersQueryHandler.cs
- SmartWMS.Domain/Entities/InventoryReservation.cs
- SmartWMS.Domain/Entities/OutboundAllocation.cs
- SmartWMS.Domain/Entities/OutboundOrderItem.cs
- SmartWMS.Infrastructure/DependencyInjection.cs
- SmartWMS.Infrastructure/Persistence/Configurations/InventoryReservationConfiguration.cs
- SmartWMS.Infrastructure/Persistence/Configurations/OutboundAllocationConfiguration.cs
- SmartWMS.Infrastructure/Persistence/Configurations/OutboundOrderItemConfiguration.cs
- SmartWMS.Infrastructure/Persistence/Migrations/20261022132945_AddDirectPickWorkflow.cs
- SmartWMS.Infrastructure/Persistence/Migrations/20261022132945_AddDirectPickWorkflow.Designer.cs
- SmartWMS.Infrastructure/Persistence/Migrations/ApplicationDbContextModelSnapshot.cs
- SmartWMS.Infrastructure/Services/OutboundCoordinator.cs
- verification/OutboundB3/FixtureDatabase.cs
- verification/OutboundB3/HttpSmoke.cs
- verification/OutboundB3/OutboundB3.Verification.csproj
- verification/OutboundB3/Program.cs
- verification/Phase4A/Program.cs
- verification/Phase4B/Program.cs

Commit 2 — docs: record outbound B3 lifecycle and verification: **5 files**.

- docs/API_CONTRACT.md
- docs/BACKEND_HANDOFF.md
- docs/LIFECYCLE_STATUS.md
- docs/PHASE_B3_AUDIT.md
- docs/PHASE_B3.md
