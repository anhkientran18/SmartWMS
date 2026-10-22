# Phase B1 — Inbound consistency (22/10/2026, Asia/Saigon)

## Checkpoint trước business changes

- Branch `main`; HEAD ban đầu `8c616b5875d6ad1029ef410688cd764210b0e0da`.
- `7a9e1c3ba30ca7df1777c8d568a07cb1d473d491` — chỉ mapping `BinId = order.BinId` trong outbound detail. DTO/entity đã có BinId; trước đó detail trả Guid.Empty. Không đổi outbound business logic.
- `b640f3327ffc47d68bdb680e1684aa8871d7a0e7` — chỉ ba tài liệu handoff ngày 22/10.
- Sau hai commit: staged=0, untracked=0; giữ nguyên 16 modified + 9 deleted có sẵn. Không reset/revert/cleanup. Không commit bin/obj/.csproj.user hoặc README/PasswordHasher có sẵn. Status chi tiết là danh sách trong [baseline](BACKEND_HANDOFF.md), bỏ source BinId đã commit và ba docs đã commit.
- B1 nằm trong working tree để review; không tự chuyển B2.

## Files B1

| File | Mục đích |
| --- | --- |
| `SmartWMS.Application/Features/InboundReceipts/Commands/ReceiveInboundReceipt/ReceiveInboundReceiptCommandHandler.cs` | Validate toàn batch → plan → một save/commit → best-effort notification |
| Cùng folder, `ReceiveInboundReceiptCommandValidator.cs` | IDs duy nhất, delta dương, precondition bắt buộc |
| `SmartWMS.Application/Features/InboundReceipts/DTOs/Commands/ReceiveInboundReceiptRequest.cs` | Thêm ExpectedReceivedQuantity; nullable để phân biệt bỏ field với 0 |
| `SmartWMS.Application/Common/Interfaces/IInboundReceiveCoordinator.cs` | Boundary lock/refresh receipt/bin/stock/serial evidence |
| `SmartWMS.Infrastructure/Services/InboundReceiveCoordinator.cs` | SQL locks, reload tracking, normalize lot theo .NET và so sánh theo DB collation |
| `SmartWMS.Infrastructure/DependencyInjection.cs` | Đăng ký scoped coordinator |
| `verification/InboundB1/InboundB1.Verification.csproj`, `Program.cs` | Relational/concurrency/rollback tests và HTTP smoke thật |
| Tài liệu B1 + ba docs handoff | Kết quả, contract và lifecycle hiện hành; giữ baseline lịch sử |

Không đổi entities/model/migrations, Outbound/Kitting/Replenishment. InventoryMutationCoordinator/Phase4A suite giữ nguyên. Không có package mới.

## Invariant trước/sau

| Chủ đề | Trước B1 | Sau B1 |
| --- | --- | --- |
| Identity | First Bin/Product/Lot row, bỏ Status/metadata | Lock Bin/Product range; blank/trim lot kể cả tab/Unicode; normalized values so theo DB collation; chỉ Available duy nhất, status khác giữ nguyên |
| Metadata | Có thể gộp khác expiry/LPN | Nullable expiry phải khớp timestamp; không gộp Available có LPN; không nhận expired vào Available; không tự sửa metadata |
| Tracking | Serial quantity không có traceability | Reject Serial/invalid mode, snapshot mismatch hoặc serial evidence; None/Lot được hỗ trợ; ghi mode snapshot khi nhận thành công |
| Reservation/workflow | Có thể cộng vào row đang được sử dụng | Reject target Available có ReservedQuantity>0, active workflow/serial; không release/move reservation |
| Active hierarchy | Thiếu deleted/parent guards | Receipt không deleted, bin/zone/warehouse active theo FK hiện hành, requested products active, supplier active nếu có |
| State | Chỉ chặn Completed | Chỉ New/Pending/Processing; Draft/Cancelled/Completed→409; complete khi mọi received==expected |
| Quantity | Delta; duplicate IDs được cộng dồn | Delta>0, mỗi ItemId một lần, expectedReceivedQuantity khớp live, long arithmetic chống over-receive/overflow |
| Occupancy | Kiểm từng line, read không lock | Bin update lock; existing occupancy phải bằng tổng physical mọi status; tổng delta/capacity/finite/giới hạn integer-double chính xác; reject drift, không tự repair |
| Atomicity | Write atomic, read/check chưa bao toàn scope | RepeatableRead; receipt/details/bin UPDLOCK+HOLDLOCK; hierarchy/product reads giữ tới commit; stock range/serial/workflow guards; một save stock/bin/receipt/ledger/audit |
| Concurrency | Một số conflict thành500 | SQL1205/1222, rowversion và inventory unique identity conflict→COM_409; rollback/clear, không tự retry mutation |
| History | Không có stock/item link | INBOUND ledger gắn BinInventoryId; ReasonCode chứa receipt+item GUID; actor từ audit; không thêm FK/schema |
| Retry | Có thể nhận lại partial delta | Bắt buộc precondition lượng client đã đọc; stale/replay→409; không cached success/request key |
| Notification | Throw sau save có thể trả failure dù commit | Sau commit/dispose, catch/log exception và vẫn success; không bảo đảm delivery/outbox |

## Contract frontend bắt buộc cập nhật

Route/auth/response giữ nguyên: POST `/api/v1/InboundReceipts/confirm-receipt`, Admin/WarehouseManager/Staff, HTTP200 Result<bool>. Request thêm **field bắt buộc**:

```json
{
  "inboundReceiptId": "<receipt-id>",
  "receivedItems": [
    { "itemId": "<detail-id>", "quantityReceived": 4, "expectedReceivedQuantity": 0 }
  ]
}
```

`quantityReceived` là delta; `expectedReceivedQuantity` là `items[].quantityReceived` từ GET receipt trước delta. Sau partial4, nhận tiếp6 phải gửi expected4. Retry do timeout/mất response phải gửi **nguyên payload cũ**; 409 thì GET lại để xác định đã commit. Không tự thay expected mới rồi gửi lại delta cũ: đó là request mới về nghiệp vụ, có thể nhận thêm hàng. Thiếu/null/negative expected, duplicate IDs, delta<=0→400. Stale/terminal/metadata conflict→409. Không cached success.

Không có Available thì tạo riêng Available; không cộng vào Reserved/QCHold/Damaged/Expired. Nhiều Available theo normalized identity, expiry mismatch hoặc target có LPN cần đối soát/chọn bin phù hợp; không tự merge. Chưa có input serial/LPN: supported scope là quantity None/Lot không LPN.

## Verification

Build/output/report nằm ngoài repo tại `%TEMP%/SmartWMS-B1/`. Số PASS là assertions, không phải endpoint count.

| Check | Kết quả |
| --- | --- |
| Solution build | PASS .NET10.0.301, 0 warnings/errors |
| Focused B1 + HTTP | **142 PASS, 0 FAIL, exit0**, gồm cleanup hai fixtures; HTTP smoke đầy đủ PASS |
| Existing Phase4A | **FAIL suite**, 76 PASS rồi assertion `Program.cs:349`, `timeouts=1, attempts=0`, cùng baseline. Handler COM_409 PASS trước điểm dừng; assertions sau đó chưa chạy. Không sửa ngoài scope |
| Existing Phase4B | **107 PASS, exit0**, business/workflow/Hangfire/schema snapshots không đổi |
| Existing ReleaseHardening | **65 PASS, exit0** |
| Existing DeleteRace | **31 PASS, exit0** |
| Historical migrations từ fixture trống | **BLOCKED SQL51000** ở tracking-backfill preflight: Product baseline changed. Không sửa migration/preflight ngoài scope |

Focused coverage: partial/final/over-receive, duplicate/foreign IDs/missing precondition, retry partial/final, concurrent cùng receipt/khác receipt chung bin, capacity/int overflow/drift, nhiều statuses/held-only, expiry/LPN/reserved/serial evidence/snapshot mismatch, Unicode lot, nhiều details chung stock identity, later-detail failure toàn batch, deleted receipt/product/supplier/bin/zone/warehouse, Serial unsupported, real SQL timeout409, stale tracking context, post-SQL concurrency/unexpected exception rollback, notification exception sau commit.

HTTP smoke: real API process ẩn trên loopback port ngẫu nhiên, fixture riêng; login → Create receipt → partial confirm → read receipt/bin inventory → partial retry409 → final confirm → read receipt/stock/history → final retry COM_409 → snapshot toàn DB không đổi do retry. Kiểm OpenAPI exposes expectedReceivedQuantity. Admin role được smoke; chưa test toàn role matrix, browser/CORS, tải lớn, Gemini.

Smoke trước khi tách HTTP fixture khỏi stress dataset gặp **stock-summary HTTP500 do Int32 aggregate overflow**: test boundary cố ý có product Quantity=int.MaxValue và các product khác. Stack ở GetInventorySummaryQueryHandler/Enumerable.Sum<int>. Đây là finding **P1 ngoài receive**, chưa sửa B1. Smoke cuối dùng DB sạch riêng, không xóa finding hoặc giảm test overflow. Hangfire schema không được tạo trong fixture; autodetect có thể log thiếu HangFire.Schema, nhưng server/jobs/schema preparation tắt và smoke không gọi job/dashboard.

**Fixture schema:** focused suite dùng EnsureCreated current model, ghi migration-history baseline **chỉ trong disposable test DB có prefix ngẫu nhiên** để real API startup preflight chạy. Đây không chứng minh historical migration chain pass; không backfill dữ liệu thật hoặc bỏ startup validation trong production source. API seed/migrate/jobs tắt. Finally dừng API và cleanup fixture. Phase4A/B chỉ đọc snapshot SmartWMS_DB, mọi ghi test trên fixture riêng.

Reproduce (PowerShell):

```powershell
dotnet build SmartWMS.slnx --no-restore -p:UseSharedCompilation=false -p:OutputPath="$env:TEMP/SmartWMS-B1/build/bin/" -p:IntermediateOutputPath="$env:TEMP/SmartWMS-B1/build/obj/"
dotnet restore verification/InboundB1/InboundB1.Verification.csproj --artifacts-path "$env:TEMP/SmartWMS-B1/artifacts" --source "$env:USERPROFILE/.nuget/packages"
dotnet build verification/InboundB1/InboundB1.Verification.csproj --artifacts-path "$env:TEMP/SmartWMS-B1/artifacts" --no-restore -p:UseSharedCompilation=false
dotnet "$env:TEMP/SmartWMS-B1/artifacts/bin/InboundB1.Verification/debug/InboundB1.Verification.dll" --verify-localdb "$env:TEMP/SmartWMS-B1/reports/InboundB1" "$env:TEMP/SmartWMS-B1/build/bin/SmartWMS.Api.dll"
```

Không đổi fixture connection thành SmartWMS_DB. `InboundB1/results.txt` ghi cả FAIL nếu có; luôn kiểm exit code. Các suite cũ có report chỉ chứa PASS tới lúc throw.

## Promotion / còn lại

- P0-03 trong **receive supported path** được xử lý bằng identity/metadata/tracking guards và atomic receive; chưa tuyên bố sửa toàn Inbound.
- P1: Serial/LPN capture chưa có contract; reject rõ. Không có putaway task/per-line bin riêng. Crossdock P1-05 giữ nguyên, chưa promote.
- P1: historical migration bootstrap trống bị SQL51000 cần review riêng; B1 không cần migration và không sửa SmartWMS_DB.
- P1: create-receipt duplicate-number precheck và active product/supplier guards chưa harden toàn diện như receive. Valid-fixture smoke không chứng nhận concurrent create/negative role matrix.
- **Receive đủ điều kiện promote Stable trong scope quantity None/Lot không LPN, metadata tương thích, active hierarchy, client dùng precondition mới**: focused+HTTP cuối PASS. Toàn module Inbound vẫn **Partial**. Không bật Serial/crossdock như Stable; chưa chứng nhận toàn role matrix/load/production deployment.
- Dừng sau B1 để review; không làm B2, không sửa Phase4A failure hoặc cleanup ngoài scope.

## Report evidence và Git cuối phase

| Report (dưới %TEMP%/SmartWMS-B1/reports) | SHA-256 |
| --- | --- |
| InboundB1/results.txt | B58D65D7958E65391A42C149252DF6BD5B5101AFDC7F9FAE9EBED67344E7829D |
| Phase4A/results.txt | 6FC63A3DBB55E20C30055F57322B3F5C83EC4D74E9BD1E098E3FF264CBDBF7A4 |
| Phase4B/results.txt | 3109206DBC39CA02DAB0578BC502804B8971EC94FC11BE2F9F8F7FF28DC0BFBF |
| ReleaseHardening/handler-results.txt | E09C318EAAF7A1C8AE5FD19D189A761FCEBED0660651F770784FF7B989AE0480 |
| DeleteRace/delete-race-results.txt | E3B0D2DD641898AFAF266485E09A2DC49DC5E4209BE5CB717FC124BA31E101C8 |

Phase4A report không ghi dòng FAIL khi assertion throw: 76 PASS trong file không có nghĩa suite pass. HEAD cuối phase vẫn là b640f3327ffc47d68bdb680e1684aa8871d7a0e7; staged0, 23 modified, 9 deleted, 5 untracked. Trong đó baseline ngoài B1 là 16 modified + 9 deleted được giữ nguyên.

```text
 M README.md
 M SmartWMS.Api/SmartWMS.Api.csproj.user
 M SmartWMS.Application/Features/InboundReceipts/Commands/ReceiveInboundReceipt/ReceiveInboundReceiptCommandHandler.cs
 M SmartWMS.Application/Features/InboundReceipts/Commands/ReceiveInboundReceipt/ReceiveInboundReceiptCommandValidator.cs
 M SmartWMS.Application/Features/InboundReceipts/DTOs/Commands/ReceiveInboundReceiptRequest.cs
 M SmartWMS.Application/obj/Debug/net10.0/SmartWMS.Application.assets.cache
 M SmartWMS.Application/obj/SmartWMS.Application.csproj.nuget.dgspec.json
 M SmartWMS.Application/obj/SmartWMS.Application.csproj.nuget.g.targets
 M SmartWMS.Application/obj/project.assets.json
 M SmartWMS.Domain/obj/Debug/net10.0/SmartWMS.Domain.assets.cache
 M SmartWMS.Domain/obj/SmartWMS.Domain.csproj.nuget.dgspec.json
 M SmartWMS.Domain/obj/SmartWMS.Domain.csproj.nuget.g.targets
 M SmartWMS.Domain/obj/project.assets.json
 M SmartWMS.Infrastructure/DependencyInjection.cs
 M SmartWMS.Infrastructure/Services/PasswordHasher.cs
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
 M docs/API_CONTRACT.md
 M docs/BACKEND_HANDOFF.md
 M docs/LIFECYCLE_STATUS.md
?? SmartWMS.Application/Common/Interfaces/IInboundReceiveCoordinator.cs
?? SmartWMS.Infrastructure/Services/InboundReceiveCoordinator.cs
?? docs/PHASE_B1_INBOUND.md
?? verification/InboundB1/InboundB1.Verification.csproj
?? verification/InboundB1/Program.cs
```
