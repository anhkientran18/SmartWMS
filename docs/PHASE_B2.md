# Phase B2 — stock-summary và migration bootstrap

Ngày 2026-10-22, branch `main`. B1 source `5a7377bf353ede47958dcdfa96f52015916f3152`, B1 docs `b668e3cdeddc1c0b3389d131bb8e00957e77a2bb`. Checkpoint fixture riêng: `bf243719779d5cb8d737e8c696e29e0e6d2a108f` (`test: stabilize Phase4A source lock fixture`, một file). Không thay business source Outbound/Inbound B1/Kitting/Replenishment.

B2 code/verification commit: `7439d01ad3d7bc2fb117cfa7342ac140e7ea4fa8` (`fix: handle large stock totals and empty database bootstrap`, 8 files). Documentation checkpoint là commit chứa tài liệu này; không gồm dirty baseline.

## B2.1 — root cause và contract

Reproduce trên implementation cũ, mỗi row Quantity hợp lệ Int32:

- Hai products có tổng Int32.MaxValue + 1: SQL group vẫn hợp lệ nhưng CLR `productQuantities.Sum<int>()` ném OverflowException.
- Cùng product có hai rows Int32.MaxValue: SQL Server `SUM(int)` ném SQL8115 trước khi materialize. Cast sau SUM không khắc phục được lỗi này.
- Low-stock và warehouse dashboard cũng dùng SQL SUM(int), có thể overflow trước filter `<20`.

Classification: **backend read aggregate defect**. Sửa cast `(long)x.Quantity` bên trong SQL Sum; stock-summary materialize List<long> và CLR Sum<long>. Chỉ `InventorySummaryDto.TotalQuantity` mở rộng int → long; JSON giữ field/numeric shape, C# DTO dùng Int64. OpenAPI hiện chỉ mô tả route, không có typed response schema cho action IActionResult này; contract Int64 được xác minh từ DTO và HTTP body, không suy ra từ Swagger. TotalProducts/LowStockItems giữ int.

Low-stock/dashboard aggregate Int64 rồi lọc như cũ; chỉ convert kết quả nonnegative <20 về CurrentStock:int hiện có. Không đổi DTO low-stock. Các aggregate chart/slotting liên quan đã dùng long; occupancy dùng double, không cùng root cause nên không sửa.

Invariant giữ nguyên: physical stock, không thay bằng available stock; cộng cả held/damaged/reserved units, không trừ reservation. Chỉ products chưa soft-delete có inventory rows được đếm; product không stock row bị loại như cũ, threshold `<20`, ordering/take giữ nguyên. Không write inventory, occupancy, history/audit hoặc thay status/transaction/locking.

Boundary tests: empty, đúng Int32.MaxValue, vượt qua nhiều products, vượt trong một product, deleted/no-stock product, threshold 19/20, QCHold/Damaged/reservation. HTTP Admin fixture có tổng physical **4,294,967,346**, kiểm body Int64 đúng và DB/audit không đổi; không chỉ kiểm HTTP200.

## B2.2 — root cause và backward compatibility

Migration gây lỗi: `20261019161210_AddTrackingReservationFoundation`, preflight SQL51000 `Product baseline changed`. Database mới thực thi chuỗi đến `20261019033151_EnforceActiveSupplierCodeUniqueness`, lúc đó Products=0 và BinInventories=0. Migration tiếp theo mặc định bắt buộc bốn GUID/SKU legacy đã duyệt và COCA lot stock; cuối migration còn yêu cầu COCA UPDATE đúng một row (SQL51004). Historical chain không tạo prerequisite sản phẩm/tồn kho đó; runtime demo seed là luồng khác.

Classification: **migration bootstrap defect do assumption về legacy data**, không phải fixture thiếu seed bắt buộc hợp lệ. Fake migration history hoặc fabricate COCA stock không phải giải pháp migration-from-empty.

Sửa nhỏ trong SQL migration lịch sử vì migration mới ở sau không thể chạy qua preflight bị chặn:

- Chỉ cho phép nhánh inventory-empty khi Products, stock, serials, inbound headers/items, outbound headers/items, inventory transactions, count headers/items đều trống và mọi bin occupancy=0.
- Nhánh này áp dụng schema hiện có, không backfill COCA khi không có Products. Không tạo demo products/stock/history.
- Nonempty path giữ nguyên mapping bốn sản phẩm, SQL51000/51001 và kiểm @@ROWCOUNT; SQL51002 quantity/capacity và SQL51003 picking guards giữ nguyên vô điều kiện.
- Không đổi DDL/Down/designer/model snapshot/entity contract; vẫn 30 migrations. Database đã áp dụng migration không chạy lại Up theo EF history; kiểm no-op bằng snapshot. Unknown legacy tiếp tục fail closed, cần reconciliation riêng.

Compatibility matrix **25 PASS**: fresh actual chain, history count/source count, model match, không fabricate stock, rerun no-op; approved legacy mapping và inventory identity/quantity/lot giữ nguyên; unknown product, missing stock, serial evidence, other-product stock, negative stock, legacy picking, header-only receipt và orphan occupancy đều reject đúng SQL51000/1/2/3 và snapshot data/schema/history không đổi. Mỗi case có database riêng. Đây không phải xác nhận mọi legacy dataset đều được auto-upgrade.

Inbound B1 verification bỏ EnsureCreated + synthetic migration history, dùng `MigrateAsync` thật cho handler và HTTP fixtures. Không sửa B1 handler/contract.

## Verification đã chạy

| Check | Kết quả cuối | Giới hạn |
| --- | --- | --- |
| Solution build | PASS, 0 warnings/errors | Output/intermediate ngoài repository |
| Stock-summary focused + HTTP | 15 assertions PASS, exit 0 | Admin, fixture dữ liệu lớn; không full role/load test |
| Migration-from-empty + compatibility | 25 assertions PASS, exit 0 | Actual 30/30 chain; approved/invalid legacy matrix |
| Phase4A | 95 PASS, exit 0 | Source-first fixture; timeout/assertion/backend locks giữ nguyên |
| Phase4B | 107 PASS, exit 0 | Snapshot business/workflow/Hangfire/schema không đổi |
| ReleaseHardening | 65 PASS, exit 0 | Handler tests |
| DeleteRace | 31 PASS, exit 0 | Focused delete race tests |
| Inbound B1 + HTTP | 142 PASS, exit 0 | Actual migrations, partial/final receive và stale retry409/no duplicate |

Mỗi regression chạy một lượt. Trong phát triển harness migration có hai setup lỗi đã sửa: predecessor không tự seed bin hierarchy và snapshot phải xử lý empty metadata JSON. Logs lỗi được giữ, không sửa business behavior để test PASS. Summary HTTP PASS trước các sửa harness này; thay đổi harness sau đó chỉ ở legacy fixture/snapshot metadata, không thay read production source.

Reports: `%TEMP%/SmartWMS-B2/reports/`; `reproduce-summary`, `reproduce-migrations` ghi evidence trước fix; `final-summary`, `final-migrations`, `final-Phase4A`, `final-Phase4B`, `final-ReleaseHardening`, `final-DeleteRace`, `final-InboundB1` chứa kết quả cuối và console. API log/OpenAPI ở final-summary; Inbound có HTTP report riêng. Mọi fixture đã cleanup; SmartWMS_DB chỉ được đọc snapshot trong suite hiện có, không migrate/seed/write.

Chạy harness đã build:

```powershell
dotnet <BackendB2.Verification.dll> --summary <report-directory> <SmartWMS.Api.dll>
dotnet <BackendB2.Verification.dll> --migrations <report-directory>
```

Hai project verification dùng restore cache; build với `--artifacts-path` trỏ ngoài repo. HTTP host chỉ loopback development, explicit fixture SQL cho app/Hangfire, seed/startup migrations/jobs tắt, JWT tạm thời. Fixture B2 chỉ create/mutate/drop tên `SmartWMS_B2_Verify_<GUID>`; B1/regression dùng prefix riêng hiện có.

## Files và kết luận scope

- B2 source: InventorySummaryDto, GetInventorySummaryQueryHandler, GetLowStockAlertsQueryHandler, GetWarehouseDashboardQueryHandler; SQL trong AddTrackingReservationFoundation.
- Verification: BackendB2 csproj/Program.cs mới; InboundB1 Program.cs dùng actual chain; fixture Phase4A commit riêng trước B2.
- Docs: PHASE_B2.md, BACKEND_HANDOFF.md, API_CONTRACT.md. Lifecycle mutation không đổi.
- Dirty baseline 25 paths (16 modified/9 deleted) ngoài scope được giữ nguyên; không stage README, PasswordHasher, csproj.user, bin/obj/generated. Build outputs ở TEMP. Index kiểm exact allowlist trước commit.

Finding B2.1/B2.2 và P1-08 verification gap đã đóng. Trong phạm vi hai finding không còn P0/P1 được phát hiện sau verification. B1 vẫn Stable cho None/Lot không LPN; không tự mở rộng Serial/LPN.

P0 ngoài scope còn: Kitting không đồng bộ occupancy/capacity (P0-01); AutoReplenishment identity/reservation/metadata (P0-02). P1 Outbound còn: allocate/wave chưa tạo reservation/allocation/tasks; pick/ship serial-only và thiếu full lifecycle; crossdock/retry/policy/cycle limitations giữ như audit. Có thể bắt đầu Outbound phase từ nền regression đã xanh, nhưng Outbound vẫn Partial và backend chưa production-ready toàn hệ thống. Dừng ở B2 để review, chưa triển khai Outbound.
