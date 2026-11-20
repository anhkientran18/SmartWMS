# SmartWMS — Demo & End-to-End Verification Runbook

Tài liệu hướng dẫn thiết lập môi trường chạy local an toàn, kịch bản trình diễn (Demo Walkthrough) theo mô hình phân quyền 3 vai trò (`Admin`, `WarehouseManager`, `Staff`), kiểm thử 7 tính năng AI hỗ trợ (Advisory AI), và lệnh kiểm chứng tự động cho nhánh `main` (từ baseline sau PR #15).

---

## 1. Prerequisites & Secrets Setup (Yêu cầu môi trường)

- **.NET SDK 10+** (`net10.0` target framework; đã kiểm chứng trên `.NET 10.0.202` và `.NET 11 RC`).
- **Node.js 22+** và `npm` (đã kiểm chứng trên Node 22 CI và Node 26 local).
- **SQL Server / LocalDB** (`(localdb)\MSSQLLocalDB` hoặc `localhost` SQL Server).
- **EF Core CLI:** `dotnet tool install --global dotnet-ef` (hoặc dùng bản đã cài).

### Cấu hình ASP.NET User Secrets (Tuyệt đối không commit secret vào Git)

Chạy từ thư mục gốc repository (chỉ ghi vào User Secrets local của `SmartWMS.Api-LocalDevelopment`):

```powershell
dotnet user-secrets set "JwtSettings:Secret" "<REPLACE_WITH_32+_CHAR_RANDOM_SECRET>" --project backend/src/SmartWMS.Api
dotnet user-secrets set "SeedAdmin:Password" "<REPLACE_WITH_STRONG_LOCAL_ADMIN_PASSWORD>" --project backend/src/SmartWMS.Api
# Tùy chọn — chỉ cần khi muốn gọi Google Gemini thật; nếu để trống, 7 tính năng AI sẽ fallback an toàn mà không ảnh hưởng nghiệp vụ lõi
dotnet user-secrets set "GeminiSettings:ApiKey" "<OPTIONAL_GEMINI_API_KEY>" --project backend/src/SmartWMS.Api
```

> **Lưu ý an toàn:** Mặc định `DatabaseInitialization:ApplyMigrationsOnStartup`, `DatabaseInitialization:SeedOnStartup`, `Hangfire:EnableServer`, `Hangfire:RegisterRecurringJobsOnStartup`, và `Hangfire:PrepareSchemaIfNecessary` đều là `false`. Khi `Hangfire:EnableServer = false`, endpoint `/hangfire` trả về `404 Not Found` và không có background AI job nào tự tạo phiếu nhập kho.

---

## 2. Isolated Database Provisioning & Local Startup

Luôn dùng một database riêng biệt cho demo/verification (ví dụ `SmartWMS_Demo_Local`) để không ảnh hưởng database phát triển khác.

### Terminal 1 — Backend API (`http://localhost:5215`)

```powershell
$cs = "Server=(localdb)\MSSQLLocalDB;Database=SmartWMS_Demo_Local;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
$env:ConnectionStrings__DefaultConnection = $cs
$env:ConnectionStrings__HangfireConnection = $cs
$env:ASPNETCORE_ENVIRONMENT = "Development"

# 1. Áp dụng toàn bộ 31 EF Core migrations lên DB riêng
dotnet ef database update --project backend/src/SmartWMS.Infrastructure --startup-project backend/src/SmartWMS.Api

# 2. Khởi chạy API kèm seed lần đầu (tạo tài khoản admin, kho mẫu và sản phẩm mẫu)
$env:DatabaseInitialization__SeedOnStartup = "true"
dotnet run --project backend/src/SmartWMS.Api --launch-profile http
```

- Kiểm tra sức khỏe hệ thống: `GET http://localhost:5215/healthz` (`200 OK`).
- Tài liệu OpenAPI / Swagger UI (Development): `http://localhost:5215/swagger`.
- Xác nhận Hangfire bị khóa mặc định: `GET http://localhost:5215/hangfire` trả về `404 Not Found`.

### Terminal 2 — Frontend Vite App (`http://localhost:5173`)

```powershell
if (-not (Test-Path -LiteralPath 'frontend/.env.local')) {
  Copy-Item -LiteralPath 'frontend/.env.example' -Destination 'frontend/.env.local'
}
# Đảm bảo frontend/.env.local có:
#   VITE_DATA_MODE=api
#   VITE_API_BASE_URL=http://localhost:5215
npm.cmd --prefix frontend ci --no-audit --no-fund
npm.cmd --prefix frontend run dev
```

> **Postman Companion:** Import bộ collection tại [docs/postman/SmartWMS.postman_collection.json](postman/SmartWMS.postman_collection.json) cùng environment [docs/postman/SmartWMS.local.postman_environment.json](postman/SmartWMS.local.postman_environment.json) để chạy thử API trực tiếp (`Login` tự lưu `{{token}}`).

---

## 3. 3-Role Demo Walkthrough (`Admin`, `WarehouseManager`, `Staff`)

### Bước 1 — Auth & User Provisioning (`Admin`)
1. Đăng nhập tài khoản `admin` (sử dụng mật khẩu trong `SeedAdmin:Password`).
2. Vào **Security & Audit → User Accounts** (`/dashboard/security/rbac`) tạo nhanh:
   - `manager01` (role `WarehouseManager`)
   - `staff01` và `staff02` (role `Staff`)
3. Xác nhận `Admin` xem được **Audit Logs** (`/dashboard/security/audit-logs`, `GET /api/v1/AuditLogs`) và **Executive Overview & AI Insights** trên Dashboard (`GET /api/v1/Dashboard/executive`).

### Bước 2 — Master Data & RBAC Boundaries (`WarehouseManager` vs `Staff`)
1. Đăng nhập `manager01` (`WarehouseManager`):
   - Tạo **Warehouse**, **Zone**, hai **Bins** (`BIN-A1`, `BIN-A2`), **Supplier**, **Customer**, và hai **Products** (`SKU-COMP-01`, `SKU-KIT-01`) với `TrackingMode = None` (hoặc `Lot`).
2. Xác nhận phân quyền thực tế với `staff01` (`Staff`):
   - **Bị chặn (`403 Forbidden`):** tạo/sửa/xóa sản phẩm (`POST /api/v1/Products`), khách hàng (`POST /api/v1/Customers`), lập phiếu nhập (`POST /api/v1/InboundReceipts`), lập lệnh xuất (`POST /api/v1/OutboundOrders`), tạo phiếu kiểm kê (`POST /api/v1/CycleCounting/create-sheet`), lắp ráp kitting (`POST /api/v1/Kitting/assemble`), xem Executive Dashboard (`GET /api/v1/Dashboard/executive`), xuất Excel (`GET /api/v1/Reports/export/excel`), xem Audit Logs (`GET /api/v1/AuditLogs`).
   - **Được phép (`200 OK`):** xem chi tiết tồn kho trong ô kệ (`GET /api/v1/Bins/{id}/contents`), xác nhận nhận hàng (Inbound Receive), chuyển kệ (Putaway/Transfer), lấy hàng/đóng gói (Outbound Pick/Pack), và xác nhận phiếu kiểm kê được giao đích danh.

### Bước 3 — Inbound Receipt, Optimistic Concurrency & Putaway Transfer
1. `manager01` tạo phiếu nhập kho (`/dashboard/orders/inbound/create`, `POST /api/v1/InboundReceipts`) cho `SKU-COMP-01` số lượng dự kiến `50` vào `BIN-A1`.
2. `staff01` mở phiếu nhập (`/dashboard/orders`), nhận từng phần `30` (`expectedReceivedQuantity = 0`) → tồn kho vật lý tăng `30`.
   - Nếu gửi lại yêu cầu cũ với `expectedReceivedQuantity = 0`, backend trả `409 Conflict` (chống double-receive).
3. `staff01` nhận nốt `20` (`expectedReceivedQuantity = 30`) → phiếu hoàn tất, tổng tồn kho vật lý = `50`.
4. `staff01` lấy gợi ý cất kệ (`GET /api/v1/InboundReceipts/putaway-suggestion`) và thực hiện chuyển kệ cùng kho (`POST /api/v1/InventoryTransfers`) chuyển `10` đơn vị từ `BIN-A1` sang `BIN-A2` → `BIN-A1 = 40`, `BIN-A2 = 10`, tổng tồn kho vẫn = `50`.

### Bước 4 — Stock Visibility, Adjustment, Status Change & Excel Export (`WarehouseManager`)
1. Vào **Stock Visibility** (`/dashboard/inventory`) kiểm tra KPI tổng tồn (`50`), lịch sử giao dịch và chi tiết từng ô kệ.
2. Thực hiện **Adjust Stock** (`POST /api/v1/Inventory/adjust-stock`, `+5` vào `BIN-A1`) → tổng tồn = `55`.
3. Kiểm tra nút **Export Excel** (`GET /api/v1/Reports/export/excel`) → tải về file `.xlsx` hợp lệ (`PK\x03\x04`).

### Bước 5 — Outbound Lifecycle (`Allocate → Pick → Pack → Ship`)
1. `manager01` tạo lệnh xuất kho (`POST /api/v1/OutboundOrders`) cho `10` đơn vị `SKU-COMP-01` và bấm **Allocate** (`POST /api/v1/OutboundOrders/allocate-pick-task`) → giữ chỗ `10` đơn vị (tồn vật lý vẫn `55`).
2. `staff01` thực hiện **Pick** (`POST /api/v1/OutboundOrders/{id}/pick`) → tồn vật lý trừ đúng một lần xuống `45`, tiếp tục **Pack** (`POST /api/v1/OutboundOrders/{id}/pack`).
3. `manager01` xác nhận **Ship** (`POST /api/v1/OutboundOrders/{id}/ship`) → đơn hoàn tất, tồn vật lý giữ nguyên `45` (không trừ kép).

### Bước 6 — Cycle Count Ownership & Kitting Atomic Assembly
1. **Cycle Count (`/dashboard/cycle-counting`):** `manager01` tạo phiếu kiểm kê `BIN-A1` giao cho `staff01`. `staff02` thử xác nhận sẽ bị từ chối `403 Forbidden`; `staff01` xác nhận khớp số lượng (`200 OK`).
2. **Kitting (`/dashboard/kitting`):** `manager01` thực hiện `POST /api/v1/Kitting/assemble` tiêu hao `2` `SKU-COMP-01` tại `BIN-A1` để lắp ráp `1` `SKU-KIT-01` vào `BIN-A2` → giao dịch nguyên tử (tổng tồn từ `45` thành `44`).

### Bước 7 — 7 Advisory AI Surfaces & Offline Fallback Verification
Toàn bộ 7 tính năng AI trên `main` đều hoạt động theo nguyên tắc **Advisory-only (không tự ghi DB, không tự sửa tồn kho)**:

| # | AI Feature | Endpoint | Vai trò UI / API | Hành vi Fallback khi AI lỗi / hết quota (`400`/`502`/`503`/`504`) |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Semantic Product Search** | `GET /api/v1/Products/semantic-search?text=...` | `Admin`, `WM`, `Staff` | Hiện thông báo lỗi thân thiện trong modal; tìm kiếm catalog chuẩn vẫn hoạt động bình thường |
| 2 | **Executive AI Dashboard** | `GET /api/v1/Dashboard/executive` | `Admin`, `WM` | Khi `aiAvailable = false`, ẩn lỗi kỹ thuật, hiển thị badge offline và giữ nguyên toàn bộ KPI SQL |
| 3 | **Inbound OCR Invoice** | `POST /api/v1/InboundReceipts/scan-invoice` | `Admin`, `WM` (UI) | Chặn PDF / ảnh $>5\text{ MiB}$, không tự làm tròn số lẻ, không ghi đè `receiptNumber`/`binId`; lỗi AI hiện banner và giữ nguyên form nhập tay |
| 4 | **Inbound Damage Vision** | `POST /api/v1/InboundReceipts/report-damage` | `Admin`, `WM`, `Staff` | Validate ảnh $\le 5\text{ MiB}$ & `Severity` (`Low`/`Medium`/`High`), hiện cảnh báo tham khảo, không tự đổi tồn kho sang `Damaged` |
| 5 | **AI Slotting** | `GET /api/v1/Dashboard/ai-slotting-recommendations` | `Admin`, `WM` | Chỉ chạy khi bấm nút (opt-in), khuyến nghị mức Zone, không tự tạo lệnh chuyển kho |
| 6 | **Demand Forecasting** | `GET /api/v1/Forecasts/demand-prediction?sku=...` | `Admin`, `WM` | Hiển thị lịch sử SQL 90 ngày + dự báo tham khảo; trả về trạng thái thiếu dữ liệu (`400`) hoặc lỗi dịch vụ an toàn |
| 7 | **AI Operational Chat** | `POST /api/v1/Chat/ask` | `Admin`, `WM`, `Staff` | Drawer stateless single-turn (tối đa 2000 ký tự), render text thuần chống XSS, không thực thi mutation |

---

## 4. Automated Verification Commands

Chạy kiểm chứng tổng hợp (Release backend build + frontend typecheck + toàn bộ 9 suites / `384` tests + frontend production build):

```powershell
# Trên clean working tree (hoặc thêm -AllowDirty nếu đã xem xét side effects):
powershell -ExecutionPolicy Bypass -File .\scripts\verify-local.ps1
```

Hoặc chạy riêng bộ kiểm thử frontend sprint:

```powershell
New-Item -ItemType Directory -Path frontend/verification/shared/evidence -Force | Out-Null
npm.cmd --prefix frontend run test:sprint
```
