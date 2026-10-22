# Phase B3.0 — Outbound audit và quyết định schema cần duyệt

> Audit lịch sử tại checkpoint B2. User đã duyệt forward migration cho direct-pick sau audit; implementation/verification/manifest hiện hành xem [PHASE_B3.md](PHASE_B3.md). Các câu “chưa sửa/chờ duyệt” bên dưới mô tả thời điểm audit B3.0.

Ngày 2026-10-22 (Asia/Saigon), branch `main`, HEAD `ae171fcef83d038f9678c39470bd15c6de7f8aac`. Checkpoint Phase4A `bf243719779d5cb8d737e8c696e29e0e6d2a108f`; B2 implementation `7439d01ad3d7bc2fb117cfa7342ac140e7ea4fa8`.

Đã kiểm branch/HEAD/status và đọc controller, toàn bộ Outbound command/validator/handler, queries, DTOs/specifications, entities/configurations reservation/allocation/task/wave/shipment, inventory coordinator và inventory rules. 25 dirty baseline paths (16 modified/9 deleted) ngoài scope giữ nguyên. Chưa sửa business source/entity/schema/migration; chưa stage/commit; chưa chạy mutation/database migration hoặc suite B3. Các số PASS trong checkpoint B2 là kết quả phase trước, không phải verification B3.

## Lifecycle thực tế tại checkpoint

Base route `/api/v1/OutboundOrders`; JWT role `Admin,WarehouseManager,Staff`. Controller trả qua Result.ToActionResult, success HTTP200; không suy ra workflow hoàn chỉnh từ route hay HTTP200.

| Bước | Endpoint / handler | Behavior và gap thực tế |
| --- | --- | --- |
| Create | POST root / CreateOutboundOrderCommandHandler | Tạo header Pending, line Pending; Quantity=requestedQuantity. Bin được kiểm active hierarchy qua specification. Chưa reserve, chưa snapshot tracking. Product/customer active chưa kiểm đầy đủ; OrderNumber uniqueness chỉ precheck, không unique DB index cho order number. Một SaveChanges atomic, không transaction bao quanh read/check |
| Allocate | POST allocate-pick-task / CreatePickTaskCommandHandler | Cho Pending/Draft/New; đổi line Pending→Allocated và header Allocated. Không query stock, không ATP, không sửa BinInventory.ReservedQuantity hoặc line.ReservedQuantity; không tạo OutboundAllocation/InventoryReservation/PickTask. AssignedUserId chưa persist. Không khóa/range transaction |
| Wave | POST create-wave-pick / CreateWavePickTaskCommandHandler | Đổi Pending/Allocated/Waved→Waved, tạo wave code trong memory. Không persist Wave/tasks/reservations. IDs thiếu một phần vẫn có thể xử lý subset; aggregate quantity dùng int. Không thể coi là reservation workflow |
| Pick | POST pick-verify / PickWithSerialCommandHandler | Request ScannedSerials bắt buộc; header Allocated/Waved. Kiểm serial InStock/product/bin, Available và hierarchy; trừ physical stock/occupancy theo serial, giữ zero row, serial→Allocated gắn OrderNumber; ghi OUTBOUND_SERIAL ledger. Tiến độ đếm serial theo OrderNumber rồi đổi string status line/header. Không tăng PickedQuantity; không consume reservation; chưa expiry/LPN/tracking snapshot guards; không explicit transaction toàn read/check; SQL/rowversion conflict không được handler map thống nhất |
| Pack | Không có mutation endpoint | validate-weight chỉ trả kết quả cân theo product weight (+150g packaging, tolerance5%); không kiểm/update trạng thái order, không tạo Packed. Các fields legacy ActualWeight/OrderId không trở thành packing persistence |
| Ship | POST {id}/ship / ShipOutboundOrderCommandHandler | Chỉ từ Picked; yêu cầu đủ serial theo OrderNumber và PackingChecks đủ SKU/qty, gọi validate-weight. Đổi header/line/serial→Shipped, không deduct lần hai. Không Packed, không shipment/reservation/progress/history workflow rows, không explicit transaction toàn validation |
| Cancel | DELETE {id} / DeleteOutboundOrderCommandHandler | Chỉ Pending/Draft/New, soft-delete header và status Cancelled; không inventory effect/release reservation. Allocated/Picked/Packed chưa có safe cancel semantics |
| Update | PUT {id} / UpdateOutboundOrderCommandHandler | Chỉ Pending/Draft/New, thay toàn lines, chặn persisted progress/reservation/request/shipment/ledger references. Không transaction khóa với allocation/delete; FK Restrict bảo vệ references khi race nhưng chưa normalize conflict response |
| Read | GET root/list/{id} | List/pagination trả header DTO, Items không populate và BinId chưa map tại hai list handlers. Detail map BinId/items; item DTO chỉ Quantity/Status, chưa exposed reserved/picked/staged/shipped hoặc inventory identity |

Status header/item là string, không enum/state machine thống nhất. Entity có RowVersion; stock cũng có RowVersion, nhưng riêng rowversion không bảo vệ predicate ATP và full read/check/commit của workflow. DbContext SaveChangesAsync ghi audit cùng save; handler chưa có một transaction thống nhất bao gồm allocation/pick guards.

## Representation sẵn có và xung đột cần giải quyết trước implementation

- Physical stock: `BinInventory.Quantity`; reserved counter: `BinInventory.ReservedQuantity`, `0 <= ReservedQuantity <= Quantity`.
- Product có TrackingMode None/Lot/Serial, soft-delete; bin/zone/warehouse soft-delete/hierarchy. Existing pick không chứng minh đúng Serial lifecycle nên không promote Serial.
- `OutboundOrderItem` có Quantity, TrackingModeSnapshot, ReservedQuantity, PickedQuantity, StagedQuantity, ShippedQuantity, RowVersion.
- `InventoryReservation` lưu exact SourceBinInventoryId, AllocationId, OrderId/OrderItemId, quantities/progress; composite FKs bảo vệ đúng line/order/allocation. Có unique reservation theo allocation/line/source.
- `OutboundAllocation` có unique active allocation/order, generation, SourceBinId và StagingBinId **bắt buộc**.
- PickTask/OutboundPickRequest/Shipment cũng yêu cầu staging context; source/staging phải khác nhau ở các check constraints liên quan.

Ba constraint đang chặn cách dùng representation đúng nghĩa cho direct deduction tại Pick:

1. `OutboundAllocationConfiguration.cs:24`: `CK_OutboundAllocations_Bins` yêu cầu `SourceBinId <> StagingBinId`, trong khi StagingBinId nonnullable. Direct-pick không có physical destination bin.
2. `InventoryReservationConfiguration.cs:31-33`: `CK_InventoryReservations_Staging` yêu cầu picked>0 thì phải có StagingBinInventoryId; staging identity khác source. Direct-pick trừ physical tại nguồn không tạo một stock row ở staging.
3. `OutboundOrderItemConfiguration.cs:22-25`: `ShippedQuantity <= StagedQuantity <= PickedQuantity`. Direct-pick có thể Packed/Shipped mà không có physical staging inventory. Không được gán StagedQuantity giả chỉ để thỏa check.

Đây là schema cho **staged inventory workflow**, trong khi handlers hiện hành dùng **deduct at Pick** và chưa dùng reservation entities. Không thể chỉ viết handler gán các progress fields đúng nghĩa để hoàn tất cả hai model cùng lúc. Một số workaround sẽ làm sai traceability: dựng staging stock giả, ghi ReleasedQuantity như đã cancel khi thực tế đã pick, hoặc bỏ reservation entities để tạo một subsystem ledger khác. Các workaround đó không được triển khai.

## Đề xuất cần duyệt — giữ deduct at Pick

Cho phép một **migration mới** bổ sung nhánh direct-pick rõ ràng, dùng chính stock reserved counter + reservation/allocation entities hiện có:

- Phân biệt direct-pick và staged path một cách tường minh; dữ liệu cũ default về staged path, không tự reinterpret/backfill đơn đang xử lý.
- Direct-pick cho phép allocation không có staging bin; reservation giữ exact source identity và picked/shipped progress dù không có staging inventory. Các quantity bounds và guard của staged path cũ vẫn phải được bảo vệ.
- Order-item progress cho phép direct-pick ShippedQuantity khi đã picked/packed đầy đủ, không fabricate StagedQuantity. Packed là guarded whole-order state, không cần carton subsystem.
- Không rewrite historical migrations, không đổi deduction point, không thêm returns/wave engine. New migration phải verify from-empty và compatibility trên fixture trước khi đề xuất commit.
- Chi tiết field/check/FK migration phải được chốt và review trong manifest implementation; không drop các invariant cũ chung cho mọi dữ liệu chỉ để test PASS.

Sau khi quyết định schema được duyệt, implementation dự kiến:

- None/Lot không LPN; Serial/LPN reject rõ. Allocation từ Available không expired, ATP=Quantity-ReservedQuantity, full-order atomic; source scope bin hiện có của order, không tự mở rộng multi-bin.
- Explicit transaction + update locks theo thứ tự, reload order/lines/stock; active hierarchy/tracking/expiry/reservation guards; conflict COM_409, không tự replay.
- Pick dùng reservation persisted, full-order/quantity guards, physical/reserved/occupancy giảm đúng một lần, ledger exact stock/order-item/reservation links và audit cùng transaction.
- Pack Picked→Packed; Ship Packed→Shipped, chỉ state/progress/history/audit, không deduct stock lần hai; duplicate transitions no-op có kiểm evidence hoặc conflict, không duplicate mutation.
- Pending cancel không stock effect; Allocated cancel release reserved atomically; Picked/Packed reject. Wave/legacy serial path không được bypass reservation, giữ Unsupported/Partial rõ ràng.
- FE giữ create/allocate routes nếu được; thêm quantity-based pick và pack mutation thay vì diễn giải ScannedSerials thành quantity. Detail bổ sung progress/reservation identity để kiểm state; existing serial endpoint không được âm thầm xử lý None/Lot.

Đây là đề xuất, chưa phải contract Stable hoặc implementation đã hoàn thành. Focused tests/HTTP/regressions theo yêu cầu B3 chỉ chạy sau khi schema decision được duyệt. Chưa có proposed commit manifest cuối; manifest hiện tại chỉ gồm tài liệu audit này.
