# SmartWMS backend handoff — 2026-10-22 (Asia/Saigon)

> Audit baseline bên dưới đã được checkpoint tại `b640f3327ffc47d68bdb680e1684aa8871d7a0e7` (source BinId: `7a9e1c3ba30ca7df1777c8d568a07cb1d473d491`). Receive path có thay đổi **Phase B1 trong working tree**; contract/verification hiện hành xem [PHASE_B1_INBOUND.md](PHASE_B1_INBOUND.md). Finding P0-03/P1-03 bên dưới mô tả receive **trước B1**; finding ngoài receive chưa được sửa.

## Phạm vi snapshot

- Branch: `main`.
- HEAD: `8c616b5875d6ad1029ef410688cd764210b0e0da` (`fix: resolve webapp release blockers`).
- Đối tượng audit: **working tree tại thời điểm audit**, bao gồm thay đổi chưa commit; checkout HEAD riêng sẽ không hoàn toàn giống snapshot này.
- Chỉ tạo tài liệu, không sửa business logic/API/migration, không commit/stage/reset. Không chạy API host, seed hay background job trên database nghiệp vụ.
- Controller + command/query + handler + EF configuration là nguồn sự thật. Commit message, comment và HTTP 200 không phải bằng chứng workflow hoàn chỉnh.
- Xem [lifecycle](LIFECYCLE_STATUS.md) và [API contract](API_CONTRACT.md).

## Git trước khi viết tài liệu

`git status --short`: 26 tracked paths bẩn: 17 modified, 9 deleted; staged: 0; untracked (không ignored): 0. `git diff --stat`: 25 files, 59 insertions, 1430 deletions. Chênh lệch 26/25 là `PasswordHasher.cs`: status đánh dấu modified nhưng diff nội dung rỗng; Git báo LF/CRLF. Không coi đây là thay đổi thuật toán hash.

Thay đổi ngoài build artifacts:

| Path | Thay đổi chưa commit |
| --- | --- |
| `README.md` | Yêu cầu SDK/IDE, cấu hình secret/startup/migration, ghi chú technical debt; +33/-5 |
| `SmartWMS.Api/SmartWMS.Api.csproj.user` | ActiveDebugProfile `http` → `https` |
| `SmartWMS.Application/Features/OutboundOrders/Queries/GetOutboundOrderById/GetOutboundOrderByIdQueryHandler.cs` | Thêm mapping `BinId = order.BinId` |
| `SmartWMS.Infrastructure/Services/PasswordHasher.cs` | Dirty theo status, không có diff nội dung |

Các path còn lại là generated artifacts đang tracked, cần giữ nguyên trong bước này:

```text
 M SmartWMS.Application/obj/Debug/net10.0/SmartWMS.Application.assets.cache
 M SmartWMS.Application/obj/SmartWMS.Application.csproj.nuget.dgspec.json
 M SmartWMS.Application/obj/SmartWMS.Application.csproj.nuget.g.targets
 M SmartWMS.Application/obj/project.assets.json
 M SmartWMS.Domain/obj/Debug/net10.0/SmartWMS.Domain.assets.cache
 M SmartWMS.Domain/obj/SmartWMS.Domain.csproj.nuget.dgspec.json
 M SmartWMS.Domain/obj/SmartWMS.Domain.csproj.nuget.g.targets
 M SmartWMS.Domain/obj/project.assets.json
 M SmartWMS.Infrastructure/obj/Debug/net10.0/SmartWMS.Infrastructure.assets.cache
 M SmartWMS.Infrastructure/obj/Debug/net10.0/SmartWMS.Infrastructure.csproj.FileListAbsolute.txt
 D SmartWMS.Infrastructure/obj/Debug/net10.0/WMS.Infrastructure.AssemblyInfo.cs
 D SmartWMS.Infrastructure/obj/Debug/net10.0/WMS.Infrastructure.AssemblyInfoInputs.cache
 D SmartWMS.Infrastructure/obj/Debug/net10.0/WMS.Infrastructure.GeneratedMSBuildEditorConfig.editorconfig
 D SmartWMS.Infrastructure/obj/Debug/net10.0/WMS.Infrastructure.GlobalUsings.g.cs
 D SmartWMS.Infrastructure/obj/Debug/net10.0/WMS.Infrastructure.assets.cache
 D SmartWMS.Infrastructure/obj/Debug/net10.0/WMS.Infrastructure.csproj.AssemblyReference.cache
 M SmartWMS.Infrastructure/obj/SmartWMS.Infrastructure.csproj.nuget.dgspec.json
 M SmartWMS.Infrastructure/obj/SmartWMS.Infrastructure.csproj.nuget.g.targets
 D SmartWMS.Infrastructure/obj/WMS.Infrastructure.csproj.nuget.dgspec.json
 D SmartWMS.Infrastructure/obj/WMS.Infrastructure.csproj.nuget.g.props
 D SmartWMS.Infrastructure/obj/WMS.Infrastructure.csproj.nuget.g.targets
 M SmartWMS.Infrastructure/obj/project.assets.json
```

Sau handoff có thêm ba Markdown untracked trong `docs/`; không đưa chúng vào baseline 26 path nói trên. Luồng song song nên dùng checkout/worktree riêng và thống nhất có mang theo mapping BinId chưa commit hay không. Tài liệu này không tạo branch/worktree thay cho các luồng đó.

## Build, test, database

| Kiểm tra | Kết quả / giới hạn |
| --- | --- |
| SDK | .NET `10.0.301` |
| Solution build | PASS, 0 warnings / 0 errors, 18.30s; `dotnet build SmartWMS.slnx --no-restore --nologo -p:UseSharedCompilation=false -p:BuildProjectReferences=true -p:OutputPath=<TEMP>/SmartWMS-handoff-build/bin/ -p:IntermediateOutputPath=<TEMP>/SmartWMS-handoff-build/obj/` |
| NuGet | Solution dùng assets hiện có, không phải fresh online restore/security audit; không suy ra dependency an toàn từ 0 warnings |
| Verification build | `Phase4A`, `Phase4B`, `ReleaseHardening` build PASS, 0 warnings/errors; restore từ `%USERPROFILE%/.nuget/packages`, artifacts ngoài repository |
| Verification execution | Phase4B **PASS 107 assertions**; ReleaseHardening **PASS 65**; DeleteRace **PASS 31**. Phase4A **FAIL suite** sau 76 PASS, xem lỗi chi tiết bên dưới; lần sandbox đầu bị lỗi LocalDB trước assertions |
| HTTP/Postman | Không tìm thấy collection Postman hoặc report kết quả đã lưu trong repository; không có HTTP E2E được xác nhận từ source test |
| Database | Đã truy vấn **chỉ đọc** `(localdb)\MSSQLLocalDB / SmartWMS_DB`, `__EFMigrationsHistory`: 30 migration, khớp 30 migration source; mới nhất `20261021130000_AddCycleCountSnapshotEvidence`. Đây là local Development DB, không xác nhận DB triển khai khác |
| Schema | Migration history không tự chứng minh schema vật lý không drift; model/snapshot được kiểm trong verification nếu chạy PASS |
| Startup | `Program.cs` kiểm connect, model drift, pending migrations trước seed/Hangfire. Development config hiện tắt migrate/seed, Hangfire server/register/schema preparation; README chưa commit vẫn nói auto migrate trong Development nên chưa phản ánh default hiện tại |

Không chạy `database update`, không scaffold migration. Secret JWT/Gemini trống trong source; runtime cần cấu hình ngoài source. Không sao chép credential vào tài liệu.

## Phase đã có trong source

| Phase/checkpoint | Bằng chứng | Hoàn thành đến đâu |
| --- | --- | --- |
| Core workflow + Phase2 API contracts | `a39c159`, migration `20261016143759_Phase2_SyncApiContracts` | CRUD, receive/stock/history, các controller hiện có; không đồng nghĩa hoàn thành outbound end-to-end |
| Tracking/reservation foundation | `1e123f1`, migration `20261019161210` | TrackingMode, ReservedQuantity, guards/config và startup controls |
| Outbound foundation | `fb2f7b4`, migration `20261020021119` | Entities/config constraints cho allocation/reservation/task/wave/shipment/request identity; controller legacy chưa dùng đầy đủ |
| Configuration contracts | `6facf41` | TrackingMode, Bin.Purpose, Warehouse.DefaultStagingBinId; guards khi đổi cấu hình |
| Phase4A mutation hardening | `3ae626f`, `verification/Phase4A` | Transfer/adjust/status/expiry guards + locking/rollback; không áp dụng đồng nhất cho inbound/replenishment/kitting/pick |
| Phase4B cycle count | `4647ae4`, migration `20261021130000`, `verification/Phase4B` | Snapshot identity/RowVersion, confirm toàn sheet, correction atomic; không có draft count/approval riêng |
| Release hardening | HEAD, `verification/ReleaseHardening` | Inbound update giữ detail identity, parent hierarchy và delete-reference race guards; còn các khoảng trống dưới đây |

## Mức độ module

`Stable`: phạm vi đã implement có bằng chứng kiểm chứng invariant; không bảo đảm toàn hệ thống/HTTP. `Partial`: có phần thiếu hoặc giới hạn contract. `Blocked`: phụ thuộc chưa có, chưa đi hết lifecycle. `Not tested`: chưa có bằng chứng chạy cho phạm vi đó. Các API có thể mang đánh giá khác module.

| Module | Phân loại | Lý do / giới hạn |
| --- | --- | --- |
| Auth | Partial | Login PBKDF2/JWT có implementation; logout chỉ no-op, token còn hạn vẫn dùng được; chưa chạy HTTP/auth matrix |
| Products | Partial | Read/CRUD/TrackingMode có; create phụ thuộc embedding; Width/Height/Depth input chưa map; delete là hard delete và có thể bị FK chặn |
| Warehouses / Zones / Bins | Partial | Read/config/hierarchy guards; soft/hard delete không đồng nhất; contents vẫn bị role cấp controller hạn chế |
| Inbound | Partial | Create/update/receive hiện hữu; receive cộng tồn và hoàn tất cùng bước, thiếu serial capture và đầy đủ identity/status checks |
| Inventory | Partial | Adjust/status hardening trong phạm vi hẹp; summary là physical tổng các status, không phải available-to-promise; mutation khác còn bypass rules |
| Inventory Transfer | Partial | Handler atomic, protect quantity/reservation/capacity, reject Serial/LPN; chưa có idempotency key và HTTP tests |
| Outbound | Blocked | Chưa có allocation/reservation thực; serial-only picking/ship; sản phẩm None/Lot không có đường pick hoàn chỉnh |
| Cycle Counting | Partial | Snapshot/confirm atomic cho stock không Serial/LPN/reserved/workflow; không count draft/submit approval/schedule API; confirm không kiểm assignment/role |
| Dashboard | Partial | Chart/occupancy có query; executive phụ thuộc Gemini, aggregation không đồng nhất active hierarchy/status |
| Audit | Partial | SaveChangesAsync ghi C/U/D cùng commit, bỏ PasswordHash; thiếu entity primary key và correlation ID trong AuditLog |
| AI/Forecast/Replenishment | Partial | Forecast/chat/vision phụ thuộc Gemini chưa kiểm runtime; auto replenishment mutation Unsafe; AI ticket job không phải quy trình phê duyệt hoàn chỉnh |

## Invariant thực tế

| Invariant | Code đang làm / giới hạn |
| --- | --- |
| Inventory row identity | PK `BinInventory.Id`; DB unique `(BinId, ProductId, LotNumber, Status)`. Expiry/LPN không nằm trong unique key. Hardened lookup chuẩn hóa blank/trim lot thành `LOT-DEFAULT`, có thể phát hiện nhiều status và từ chối. Receive lookup bỏ Status, không đối chiếu expiry/LPN; create receipt dùng lot mặc định `N/A` khác chuẩn hardened |
| Stock statuses | Enum số: Available=1, Reserved=2, QCHold=3, Damaged=4, Expired=5. Change-status đổi toàn row; không chia quantity; đổi thực sang Reserved bị chặn; same-status thành no-op trước workflow guard. Không có Locked/Quarantined dù comment DTO nhắc đến |
| Physical vs available | Quantity là physical; nguồn transfer dùng `Quantity - ReservedQuantity` khi Status=Available. Stock-summary cộng physical mọi status; frontend không được hiển thị đó là available |
| Reservation | DB check `0 <= ReservedQuantity <= Quantity`; transfer/adjust không release/move reserved. Entities reservation/task có nhưng endpoint allocate legacy không ghi chúng |
| Negative stock | DB check + hardened long arithmetic; không phải mọi handler đều prevalidate reserved/overflow. DB rejection ở handler legacy có thể thành HTTP 500 |
| Capacity / occupancy | Đơn vị đang là số lượng sản phẩm, không volume/weight. DB check `0 <= CurrentOccupancy <= MaxCapacity`; không có DB check occupancy bằng tổng quantity. Kitting không cập nhật occupancy; replenishment bỏ metadata/tracking/status target guards |
| Soft delete | Không có global HasQueryFilter. Handler/spec tự lọc. Warehouse/Bin/Outbound mềm; Zone/Product/User và Inbound delete dùng Remove (hard). Receive truy cập receipt/bin không lọc IsDeleted/hierarchy |
| Concurrency | SQL rowversion trên inventory/bin/receipt/items/order/serial và nhiều foundation entities; mutation coordinator RepeatableRead + UPDLOCK/HOLDLOCK, status/workflow absence range guards; cycle coordinator reload tracked evidence. Legacy receive/pick/ship dùng một SaveChanges nhưng không có transaction bảo vệ toàn read/validate phase |
| Idempotency | Không có global middleware/key cho mutation công khai. Foundation request entities không chứng minh được sử dụng. Status same-state no-op; cycle confirm replay bị 409; adjust/transfer/partial receive replay có thể tác động lần nữa |
| Transaction | Một SaveChangesAsync atomic cho write batch và audit; không tự bao trọn các read/check trước đó. Hardened transfer/adjust/status/count/inbound update explicit transaction; configuration update Serializable TransactionScope. Notification ngoài DB, không có outbox |
| Audit | `ApplicationDbContext.SaveChangesAsync` tự ghi C/U/D trước base save, actor từ current user fallback SystemAdmin, IP; override cả CreatedBy trong ledger mới. Audit không lưu PK entity bị tác động, không audit đọc/thất bại và không đảm bảo raw SQL/sync SaveChanges đi qua cùng cơ chế |
| Expiry | Job chuyển expired Available → Damaged; command LockExpiredStock dùng cửa sổ 30 ngày → Expired. Cả hai skip reserved/workflow; command này không được expose controller |

## P0 / P1 / P2 tồn tại (chưa sửa)

P0 = có đường ghi làm sai tính nhất quán tồn kho/identity; P1 = chặn workflow hoặc thiếu kiểm soát quan trọng; P2 = contract/observability/hygiene. Các finding từ đọc code là **static finding**, chưa coi là incident trên dữ liệu thực.

| ID | Mức | Finding, bằng chứng và tác động |
| --- | --- | --- |
| P0-01 | P0 | `AssembleKitCommandHandler`: trừ component/cộng kit nhưng không sửa occupancy nguồn/đích hay kiểm capacity. SaveChanges có thể commit quantity lệch occupancy dù từng bin vẫn thỏa DB check. `POST Kitting/assemble` nên chặn tích hợp |
| P0-02 | P0 | `AutoReplenishCommandHandler`: chọn target theo occupancy/Quantity, không bắt target Available, không so expiry/LPN/TrackingMode, source không trừ ReservedQuantity khi tính available; có thể gộp hàng khác metadata hoặc chuyển hàng khả dụng vào row bị hold/damaged, hoặc thất bại DB check reservation. Chưa có coordinator/idempotency |
| P0-03 | P0 | `ReceiveInboundReceiptCommandHandler`: lookup Bin/Product/Lot không Status, không so expiry/LPN/tracking. Khi có nhiều status có thể tăng nhầm row; không tạo serial cho hàng Serial. Nhận hàng vào một identity không tương thích có thể làm sai traceability; chưa reproduce |
| P1-01 | P1 | Allocate/wave chỉ cập nhật string status; không tạo OutboundAllocation/InventoryReservation/PickTask/Wave. `AssignedUserId`, WavePriority chưa có tác dụng nghiệp vụ |
| P1-02 | P1 | Outbound pick chỉ hỗ trợ ScannedSerials, trừ tồn ở pick; ship đòi đủ serial, chỉ đổi Shipped, không tạo Shipment/ShipmentItem/release reservation. Inbound không có API ghi nhận serial; None/Lot bị chặn đi hết lifecycle |
| P1-03 | P1 | Receive không có request key, chỉ chặn Completed; partial receive retry sau commit có thể nhận lần hai. Notification sau save có thể throw làm client thấy lỗi dù DB đã commit; nhiều conflict legacy ra 500 |
| P1-04 | P1 | Inventory/CycleCounting chỉ `[Authorize]`, không manager role; confirm không kiểm AssignedUserId. Bins contents có method role Staff nhưng class role Admin/Manager vẫn phải thỏa (AND), Staff không truy cập được. Cần quyết định policy, không tự sửa trong audit |
| P1-05 | P1 | ProcessCrossDocking đổi/split line và ghi transfer ledger nhưng không xác nhận receipt/physical stock/reservation/task; có thể làm lệch trạng thái outbound với workflow mới |
| P1-06 | P1 | Không có idempotency key cho adjust/transfer/pick/ship; rowversion không thay cho retry identity. Pick không prevalidate reservation; DB check có thể chặn nhưng trả lỗi không chuẩn conflict |
| P1-07 | P1 | Cycle count thiếu draft count/approval/recount endpoints; chỉ confirm tất cả detail, từ chối snapshot cũ sau bất kỳ đổi rowversion, không hỗ trợ Serial/LPN/multi-status/reservation/workflow |
| P1-08 | P1 | **Verification chưa xanh toàn bộ:** Phase4A dừng tại `verification/Phase4A/Program.cs:349`: expected một SourceLockAttempts nhưng thực tế `timeouts=1, attempts=0`. Handler trả COM_409 được kiểm PASS trước đó. Chưa xác định root cause là probe/query plan/lock acquisition hay implementation; không suy diễn thành mất tồn. Các assertion nằm sau điểm dừng chưa được chạy |
| P2-01 | P2 | README default startup không khớp Development config hiện tại; cần quyết định sửa sau duyệt |
| P2-02 | P2 | Product/Bin create nhận dimensions nhưng handler không map; product weight dùng mặc định 250g khi <=0 và chưa có contract cập nhật weight |
| P2-03 | P2 | Audit thiếu entity PK/correlation; error envelope khác nhau giữa Result failure, ProblemDetails, ApiController validation/auth; OpenAPI không thể hiện state machine |
| P2-04 | P2 | Tracked bin/obj và .csproj.user gây dirty checkout; chưa cleanup. PasswordHasher malformed 4-part hash có thể throw parse thay vì auth fail; legacy SHA-256 không login được |
| P2-05 | P2 | Wave request không đảm bảo lấy đủ ID yêu cầu, generated waveCode không persist, Waved replay sinh code mới; bin code uniqueness guard theo zone nhưng DB unique toàn hệ thống |

## Bằng chứng test

Các executable verification gọi handler trực tiếp, không kiểm MVC binding/JWT/role/OpenAPI/serialization. File code có Check/PASS không phải report đã chạy. Báo cáo chạy audit nằm dưới `%TEMP%/SmartWMS-handoff-verification/reports/`. Số PASS là **assertions**, không phải số endpoint hoặc số test case độc lập. Các fixture được cleanup; Phase4A/Phase4B đều xác nhận business/workflow/Hangfire/schema snapshots trước/sau không thay đổi. ReleaseHardening/DeleteRace chỉ tạo/ghi fixture riêng, không chạy business commands trên SmartWMS_DB.

| Phạm vi | Tested OK | Tested expected failure | Not tested | Blocked by prerequisite |
| --- | --- | --- | --- | --- |
| Build solution + verification | PASS | — | Fresh online restore | — |
| Phase4A transfer/adjust/status/expiry | Boundary transfer=available; adjustment=reserved floor; same-status no-op; concurrent spend protection; rollback rowversion; tổng 76 PASS trước dừng, **suite FAIL** | Overdraw, overflow, Serial/LPN, hierarchy deleted, metadata mismatch, status/workflow guard, SQL1222→COM_409 đều có PASS | Các assertions sau line349 (cleanup/context/active-allocation races); HTTP/auth/retry mất response | Sandbox đầu không kết nối LocalDB; rerun ngoài sandbox đã chạy tới assertion failure P1-08 |
| Phase4B snapshot/count correction | **107/107 PASS**: snapshot evidence, aggregate correction/occupancy/ledger/audit, zero variance, double submit 1 winner, tracking reload | Partial/duplicate/foreign/negative counts; stale identity/version, legacy evidence, Serial/LPN/reserved/workflow/hierarchy, capacity overflow; rollback SQL1222/fault | HTTP/auth assignment policy | None/Lot stock có prerequisite đúng; unsupported data bị reject có chủ đích |
| ReleaseHardening inbound update/hierarchy | **65/65 PASS**: New/Draft/Pending update, EF states và retained ID/lot/expiry, no stock effects; unreferenced delete | Received/Processing/Completed/Cancelled/ambiguous/invalid references; post-SQL faults rollback; hierarchy/reference guards | Receive/ship E2E | — |
| Focused delete race | **31/31 PASS**: unreferenced Zone/User delete, cleanup, reusable context | Real concurrent SQL547→COM_409, history preserved; unexpected/unrelated SQL exceptions propagate sau rollback | HTTP/auth | — |
| Auth, Products, Dashboard, Audit, AI | — | — | Không có runtime evidence trong audit | AI cần cấu hình/khả năng truy cập Gemini |
| Outbound full lifecycle | — | — | HTTP + concurrent workflows | Allocation/task/None-Lot pick/serial inbound còn thiếu |

Report evidence (nằm ngoài Git để không tạo thêm artifact ngoài ba tài liệu yêu cầu):

| Report dưới thư mục reports | SHA-256 |
| --- | --- |
| `Phase4A/results.txt` (76 PASS, **không ghi assertion FAIL vào report** vì Check throw trước Add) | `2B4C39C6A61A14383EBB4592481AD9494FBC70A4A6F74871DFD27D5C7FDC285A` |
| `Phase4B/results.txt` | `3109206DBC39CA02DAB0578BC502804B8971EC94FC11BE2F9F8F7FF28DC0BFBF` |
| `ReleaseHardening/handler-results.txt` | `E09C318EAAF7A1C8AE5FD19D189A761FCEBED0660651F770784FF7B989AE0480` |
| `DeleteRace/delete-race-results.txt` | `E3B0D2DD641898AFAF266485E09A2DC49DC5E4209BE5CB717FC124BA31E101C8` |

Reproduce build: `dotnet restore verification/<Suite>/<Suite>.Verification.csproj --artifacts-path <TEMP>/SmartWMS-handoff-verification --source <USERPROFILE>/.nuget/packages`, rồi `dotnet build ... --artifacts-path <cùng-path> --no-restore -p:UseSharedCompilation=false`. Chạy DLL tại `bin/<Suite>.Verification/debug/` với `--verify-localdb <report-dir>`; DeleteRace dùng DLL ReleaseHardening với `--verify-delete-races <report-dir>`. Các harness dùng LocalDB và tự tạo/xóa fixture có prefix riêng; **không đổi connection fixture thành database nghiệp vụ**. Chỉ đọc report PASS không đủ kết luận suite pass; phải kiểm exit code/stdout.

## Handoff frontend / backend review

- Có thể dựng màn hình đọc dựa vào contract hiện tại: Products GET/list/detail; Warehouses GET/list/detail; Zones GET/list/warehouse; Bins GET/list/detail/contents theo role thực; InboundReceipts và OutboundOrders GET/list/detail; Inventory stock-summary/history/alerts; InventoryTransfers GET/list/detail; CycleCounting detail/pending-tasks; Dashboard chart/occupancy; AuditLogs GET (Admin).
- Những read API trên **chưa được gọi Stable runtime** khi chưa có HTTP evidence. Stock-summary là physical, executive Dashboard gọi Gemini; tránh dùng executive làm prerequisite bắt buộc cho màn hình chính.
- **Stable ở phạm vi handler/invariant đã test:** PUT `/api/v1/InboundReceipts/{id}` khi chưa nhận hàng; POST `/api/v1/CycleCounting/create-sheet` và `/confirm` cho snapshot không Serial/LPN/reserved/workflow, một row mỗi Bin/Product/Lot. Cycle confirm là chốt+corrrection trực tiếp, chưa có assignment/manager guard; phải chấp nhận policy hiện tại hoặc đợi review policy trước khi cho operator dùng. Đây không phải chứng nhận HTTP runtime; cần smoke binding/role trên môi trường frontend trước khi bật.
- Transfer/adjust/status chỉ **Partial** trong handoff này vì Phase4A chưa xanh toàn bộ. Có thể chuẩn bị UI/schema, chưa coi suite/integration đã hoàn thành.
- Chưa tích hợp mutation receive/crossdock/replenish/kitting và outbound allocate/wave/pick/ship thành workflow production. Không tạo frontend theo các endpoint chỉ có handler nhưng không có controller.
- Dừng ở audit/documentation; không tiếp tục sửa backend cho tới khi chủ repository duyệt.
