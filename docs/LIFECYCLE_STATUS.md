# Lifecycle thực tế — SmartWMS

> Receive đã được cập nhật theo [Phase B1](PHASE_B1_INBOUND.md) trong working tree sau checkpoint `b640f3327ffc47d68bdb680e1684aa8871d7a0e7`; B3 direct-pick đã cập nhật bên dưới trong working tree; xem PHASE_B3.md. Các scope ngoài B1/B3 giữ baseline audit.

Snapshot 2026-10-22, branch `main`, HEAD `8c616b5875d6ad1029ef410688cd764210b0e0da`, **working tree có thay đổi chưa commit**. Xem [handoff](BACKEND_HANDOFF.md) để biết build/test/invariant và mức P0/P1/P2; [API contract](API_CONTRACT.md) cho DTO/auth/retry.

Các route dưới đây có prefix `/api/v1`. Tên command/query `X` tương ứng `XHandler` trong `SmartWMS.Application/Features/<module>/Commands|Queries/<action>/`; chỉ các route thấy ở controller mới là API. `Done` = bước được implement, không phải toàn workflow đã production-tested. `Partial` = giới hạn/thiếu phần; `Missing` = chưa có API/bước; `Unsafe` = đường hiện có có nguy cơ sai invariant.

Quy ước transaction: **S** = một `SaveChangesAsync` atomic cho write batch + AuditLog, nhưng read/validation trước đó ngoài transaction tường minh. **M** = `InventoryMutationCoordinator.BeginAsync`, RepeatableRead + lock hints tùy bước, save + commit; rollback/dispose clear tracker khi chưa commit. Không có distributed transaction/outbox cho notification.

## Inbound

**Thực tế:** create New → confirm-receipt nhận số lượng gia tăng, cộng thẳng vào bin chỉ định → Processing hoặc Completed. Không có receive vào dock rồi putaway/complete riêng.

| Bước | Endpoint / command-query-handler | Before → after | Entities thay đổi | Inventory side effect | Validation chính | Transaction | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create Receipt | POST `/InboundReceipts` → CreateInboundReceiptCommand/Handler | Chưa có → New; item received=0 | InboundReceipt + Items + AuditLogs | Không cộng tồn/giữ chỗ bin | ReceiptNumber bắt buộc <=50, duplicate precheck; supplier ID nonempty; bin active hierarchy; items/product ID/qty>0; date >= UTC today. Product/supplier active existence chưa được kiểm đầy đủ | S; duplicate precheck có race, không idempotency | Partial |
| Sửa trước nhận | PUT `/InboundReceipts/{id}` → UpdateInboundReceiptCommand/Handler | New/Pending/Draft → giữ trạng thái | Header/details giữ ID/lot/expiry nếu cùng ProductId; remove/add detail + audit | Không mutation tồn | route/body ID; received tất cả=0; items đầy đủ, ProductId duy nhất/active; supplier active nếu có; bin active; DTO không sửa lot/expiry, từ chối detail ambiguity | M; receipt/items rowversion; catch conflict 409 | Done trong phạm vi hẹp |
| Receive | POST `/InboundReceipts/confirm-receipt` → **ReceiveInboundReceiptCommand/Handler** | New/Pending/Processing → Processing/Completed; terminal/Draft→409 | Receipt.Items+TrackingModeSnapshot, receipt.Status, BinInventory, Bin, INBOUND ledger, AuditLogs | Chỉ Available cùng normalized identity/expiry, không LPN/reserved/workflow/serial; status khác giữ nguyên; None/Lot, Serial reject | Receipt/hierarchy/product/supplier nếu có active; qty>0, unique ItemId, expectedReceivedQuantity bắt buộc khớp live; remaining; tổng occupancy=physical/capacity/overflow; mọi check trước mutation | M + InboundReceiveCoordinator lock/refresh receipt/details/bin/stock; conflict→409 rollback; notification sau commit catch/log, vẫn success | B1 Done trong supported scope; xem focused/HTTP kết quả cuối |
| Putaway suggestion | GET `/InboundReceipts/putaway-suggestion?sku=...&quantity=...` → GetPutawaySuggestionQuery/Handler | Không đổi | Không | Gợi ý theo text tên/mô tả Cold/Dry zone + capacity; không giữ chỗ/cộng tồn | SKU lookup; BinForPutawaySpec; không phải task execution | Read only | Partial |
| Putaway / Bin execution | **Không có endpoint putaway riêng** | Không có trạng thái putaway | — | Gộp vào receive; một bin/header | Không có per-line bin/scan task contract | Cùng M receive B1 | Missing nếu cần dock → bin riêng |
| Inventory mutation | Nội bộ ReceiveInboundReceiptCommandHandler | Available Q→Q+delta hoặc tạo Available | Stock, Bin occupancy, INBOUND ledger+BinInventoryId/Reason receipt-item, audit | Normalize blank/trim lot kể cả Unicode, giữ các stock status khác; existing expiry phải khớp, không LPN; Q/reserved guards; occupancy tăng đúng tổng delta | Validate cả batch; reject Serial/evidence/mode mismatch, expired, invalid hierarchy, existing occupancy drift, overflow/capacity | Cùng M B1; stock range/absence/rowversion + bin lock; lỗi rollback toàn bộ | Done trong scope None/Lot không LPN |
| Receipt completion | Nội bộ receive, **không có complete endpoint** | New/Pending/Processing → Completed khi mọi received==expected; còn lại Processing | Receipt.Status + audit cùng stock/ledger | Không cộng thêm ngoài delta | expected precondition; zero delta reject; retry terminal/stale409 không ghi thêm | Cùng M B1 | Done cho direct receive; workflow putaway riêng vẫn Missing |
| Crossdock nhánh phụ | POST `/InboundReceipts/process-crossdock` → ProcessCrossDockingCommand/Handler | Line pending → Allocated hoặc split thành pending + allocated | OutboundOrderItem; InventoryTransaction TRANSFER; AuditLogs | Không mutation BinInventory/occupancy, không reserve hoặc tạo shipment | ProductId/IncomingQuantity; query pending lines; không ràng receipt/stock identity | S, event sau commit | Unsafe/Partial (P1-05) |
| Delete | DELETE `/InboundReceipts/{id}` → DeleteInboundReceiptCommand/Handler | New → row bị Remove | Header/items theo FK + audit | Không đảo inventory | Chỉ New; comment không phải soft-delete implementation | S | Partial |

Handler `ConfirmInboundReceiptCommandHandler` tồn tại nhưng **controller không gọi nó**; route confirm-receipt gọi ReceiveInboundReceipt. Không document handler cũ thành endpoint.

## Inventory Transfer

**Thực tế:** một POST thực hiện toàn bộ; không có Draft/Approved/InTransit/Completed transfer entity. ID trả về là InventoryTransaction.Id.

| Bước | Endpoint / command-query-handler | Before → after | Entities thay đổi | Inventory side effect | Validation chính | Transaction | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Source validation | POST `/InventoryTransfers` → CreateInventoryTransferCommand/Handler | Source Available → giữ Available | Chưa ghi | Tính available=Quantity-ReservedQuantity | qty>0, source!=dest; active product không Serial; hierarchy hai bin active; lock lot normalize theo thứ tự bin; source Available duy nhất, destination Available tối đa một; source không LPN, qty/reserved hợp lệ | M; LockLot UPDLOCK/HOLDLOCK + rowversion bin/stock | Done, giới hạn None/Lot không LPN |
| Deduct source | Cùng POST/handler | Q → Q-transfer; reserved giữ nguyên | Source BinInventory + audit | Không được dùng phần reserved; giữ row khi Q=0 | Q-reserved>=transfer | Cùng M; không commit từng bước | Done |
| Add destination | Cùng POST/handler | Chưa có → Available hoặc Q → Q+transfer | Destination BinInventory + audit | Copy source lot/expiry khi tạo, ReservedQuantity=0; không move reservation | Existing expiry/LPN khớp và valid stock; long overflow bound | Cùng M | Done |
| Occupancy | Cùng POST/handler | Source occupancy-q; destination occupancy+q | Hai Bin + audit | Tổng quantity được bảo toàn; capacity theo đơn vị qty | finite, nonnegative, <=MaxCapacity cả nguồn/đích | Cùng M; bin rowversion | Done |
| Transaction history | Cùng POST/handler | Không có → TRANSFER | InventoryTransaction + audit | QuantityChanged là số dương; source/destination codes và hai inventory IDs | Reason không bắt buộc theo validator; ID mới mỗi request | Save + commit cuối M; conflict → 409, rollback tất cả | Done; retry chưa idempotent |

Các API GET `/InventoryTransfers`, `/list`, `/{id}` đọc ledger TRANSFER; không phải trạng thái một transfer workflow. Replenishment/crossdock cũng có thể ghi TRANSFER nhưng không dùng handler hardened này.

## Outbound — B3 direct-pick

**Hiện hành trong working tree:** Pending → Allocated → Picked → Packed → Shipped. Scope None/Lot không LPN, whole-order, single source bin; xem [PHASE_B3.md](PHASE_B3.md). D = RepeatableRead + UPDLOCK/HOLDLOCK/reload order/items/allocation/reservations/bin/stock, SaveChanges/audit + commit; failure rollback/clear.

| Bước | Endpoint / command-handler | Before → after | Entities thay đổi | Inventory side effect | Validation chính | Transaction | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create | POST OutboundOrders / CreateOutboundOrderCommandHandler | absent→Pending/direct lines | Order/lines/audit | Không stock/reserve | Active hierarchy/product None/Lot/customer nếu có; positive qty, number/date | S | Supported scoped create; duplicate number race còn limitation |
| Allocate | POST allocate-pick-task / CreatePickTaskCommandHandler→OutboundLifecycle | Pending→Allocated | Order/items/allocation/reservations/stock + RESERVATION ledger/audit | Reserved+=qty; physical/occupancy giữ | Available, ATP đủ, hierarchy/mode/lot/expiry valid, không LPN/serial evidence; full-order; mode flags/FK | D | Done scoped; không tạo PickTask |
| Wave | POST create-wave-pick / CreateWavePickTaskCommandHandler | B3 direct→409, giữ nguyên | Không cho direct | Không | Direct line guard; legacy placeholder giữ Partial | Legacy S | Unsupported B3, không bypass allocation |
| Pick | POST {id}/pick / DirectPickCommandHandler→OutboundLifecycle | Allocated→Picked | Order/item/reservation/stock/bin, OUTBOUND ledger/audit | Physical/reserved/occupancy -=qty đúng một lần | Exact full reservation set/quantity, source ID/normalized lot/expiry snapshots, live Available/mode/hierarchy/counters | D | Done None/Lot; không partial |
| Pack | POST {id}/pack / PackOutboundOrderCommandHandler→OutboundLifecycle | Picked→Packed | Header/line state + audit | Không stock/occupancy/ledger mutation | Full persisted picked progress; duplicate Packed valid no-op | D | Done minimal state, không cân/carton |
| Ship | POST {id}/ship / ShipOutboundOrderCommandHandler→OutboundLifecycle | Packed→Shipped | Header/line/reservation shipped progress; allocation terminal; SHIP_CONFIRM delta0/audit | Không deduct lần hai | Full persisted progress; duplicate Shipped evidence valid no-op | D | Done scoped; không fabricate Shipment/staging |
| Cancel | DELETE {id} / DeleteOutboundOrderCommandHandler→OutboundLifecycle | Pending/Allocated→Cancelled + soft-delete | Header/items/allocation/reservation/stock counter; release ledger/audit | Pending: none; Allocated: reserved-=own qty, physical giữ | Guard full reservation/counter; Picked/Packed reject (không reversal) | D | Done scoped; canceled detail404 |
| Inventory deduction | Nội bộ quantity Pick, không endpoint deduction riêng | Q/R/occupancy -=qty | Exact source stock/line/reservation ledger references | Deduct tại Pick | DB bounds + active inventory guards | Cùng D Pick | Done scoped |
| Legacy Serial/weight | pick-verify / validate-weight / ship mode=false | Existing serial flow hoặc readonly calculation | Legacy như audit B3.0 | Không dùng cho B3 None/Lot | Serial endpoint rejects direct; weight không tự tạo Packed | Legacy S/read-only | Partial/Unsupported B3, code giữ nguyên |

Source lot/expiry snapshot trên reservation; tracking snapshot trên line. IsDirectPick + mode FKs tách staged schema cũ khỏi direct path; staged invariants không bị bỏ. Reservation.Quantity là original allocated, outstanding trước pick = Quantity - PickedQuantity - ReleasedQuantity. Update Pending lock order, replace line IDs, không sửa mode key của persisted line.

## Cycle Counting

**Thực tế:** create snapshot Pending → thao tác đếm ở client → confirm toàn sheet tính variance/correction và Completed atomically. Không có các trạng thái Submitted/Approved/Correcting được API ghi.

| Bước | Endpoint / command-query-handler | Before → after | Entities thay đổi | Inventory side effect | Validation chính | Transaction | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create sheet | POST `/CycleCounting/create-sheet` → CreateCountSheetCommand/Handler; body có `requestData` wrapper | Chưa có → sheet Pending, details Pending | CycleCountSheet/Items + audit; snapshot inventory ID, rowversion, qty, lot | Không đổi stock; không freeze stock qua nhiều request | Bin hoặc zone active hierarchy; assigned user active nếu có; scope có stock; normalized Bin/Product/Lot duy nhất; không Serial/LPN/serial evidence/reserved/workflow; occupancy valid | M + CycleCountCoordinator lock scope/lot/bin, reload tracking | Done trong scope hỗ trợ |
| Count | GET `/CycleCounting/{id}` → GetCountSheetByIdQuery/Handler; GET `/pending-tasks` → GetPendingCountTasksQuery/Handler | Pending → vẫn Pending | Không | Không | Pending tasks lọc user ID từ token, operatorName query không override; details không kiểm assignment; pending counted/variance trả null | Read only | Partial; lưu draft count/bắt đầu Counting Missing |
| Submit | POST `/CycleCounting/confirm` → ConfirmCycleCountCommand/Handler | Pending/Counting → Completed (không Submitted riêng) | CountedQuantity và item status; sheet | Gộp correction vào submit | Đúng toàn bộ item ID một lần; counted nullable nhưng bắt buộc gửi và >=0 | M; lock sheet/items/lot/bin, validate toàn bộ trước mutation | Done cho atomic confirm; submit riêng Missing |
| Variance | Nội bộ confirm; GET detail đọc kết quả | Item Pending → Matched nếu delta=0, Discrepancy nếu khác | CycleCountItem.CountedQuantity/Status; Variance tính Counted-System | Chưa áp riêng ở bước này | SnapshotBinInventoryId + RowVersion 8 byte + exact qty/lot khớp live; stale/ambiguous →409; recheck supported scope | Cùng M confirm | Done; duyệt variance riêng Missing |
| Correction | Nội bộ confirm | Stock snapshot qty → counted | Stock/bin, ADJUSTMENT ledger + audit | delta=counted-system; chỉ ghi ledger khi delta!=0, Reason=CYCLE_COUNT_sheetID; occupancy cộng tổng delta theo bin | Nonnegative/reserved floor, tổng occupancy finite trong capacity; all-or-nothing | Cùng M, save+commit một lần | Done trong scope hỗ trợ |
| Complete | Nội bộ confirm | Pending/Counting → Completed; item Matched/Discrepancy | Sheet/status/audit cùng các write trên | Zero variance không ghi ledger; không correction lần hai | Replay Completed/Cancelled→409; thiếu snapshot evidence phải lập lại sheet | Cùng M; conflict rollback và clear tracker | Done |
| Auto schedule | **Không có route controller**; ScheduleAutoCycleCountCommandHandler trả UNSUPPORTED | Không đổi | Không | Không | Handler luôn từ chối | Không write | Missing |

Assignment chỉ dùng cho pending-tasks filter; confirm/create hiện chỉ `[Authorize]` và confirm không kiểm người được phân công/role phê duyệt. Frontend không thể thực thi policy bằng cách ẩn nút đơn thuần.
