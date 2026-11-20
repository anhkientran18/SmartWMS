# SmartWMS

SmartWMS là monorepo quản lý kho: ASP.NET Core/.NET 10, EF Core/SQL Server và React/TypeScript/Vite. Backend thực thi quyền (3-role RBAC: `Admin`, `WarehouseManager`, `Staff`) và nghiệp vụ tồn kho lõi; Google Gemini cung cấp 7 tính năng hỗ trợ (Advisory AI) hoàn toàn không tự ghi tồn kho.

Baseline kiểm chứng tự động hiện hành trên `main` (sau hợp nhất PR #7–#15): Release backend build (`0` warnings/errors), frontend TypeScript `typecheck` (`0` errors), frontend production `build`, và **384/384 tests PASS trên toàn bộ 9 suites** (`npm --prefix frontend run test:sprint`). Xem [Demo & E2E Runbook](docs/DEMO_AND_E2E_RUNBOOK.md) và bộ [Postman Collection](docs/postman/SmartWMS.postman_collection.json) để chạy kịch bản vận hành và kiểm chứng E2E local.

## Prerequisites

- Git, **.NET SDK 10+** (`net10.0`), **Node.js 22+** và npm; PowerShell cho các lệnh dưới.
- SQL Server / LocalDB và database development cô lập cho lần chạy API cục bộ.
- Có thể chạy nhanh bộ kiểm tra local bằng `powershell -ExecutionPolicy Bypass -File .\scripts\verify-local.ps1`.

## Install and build

Chạy từ repository root trong checkout được phép ghi build artifacts:

~~~powershell
dotnet --version
node --version
dotnet restore SmartWMS.slnx --nologo
dotnet build SmartWMS.slnx --configuration Release --no-restore --nologo
npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run typecheck
npm --prefix frontend run build
~~~

Solution có bốn production projects ở `backend/src/`: `backend/src/SmartWMS.Api`, `backend/src/SmartWMS.Application`, `backend/src/SmartWMS.Domain`, `backend/src/SmartWMS.Infrastructure`. Frontend ở `frontend/`; console harnesses ở `verification/`; orchestration ở `scripts/`.

Restore/build ghi `bin/obj`; npm cài dependencies/chạy lifecycle hooks; Vite ghi `frontend/dist`. Có generated files đã tracked: không stage chúng hoặc reset/clean checkout đang có work. Không dùng `npm ci` trên dependencies dùng chung với checkout khác.

## Configure and run locally

Chuẩn bị SQL Server/database riêng trước khi chạy API. Database migration/provisioning/seed là bước có write riêng; không chạy mặc định trên database shared/demo. Startup kiểm kết nối, model và migrations; thiếu schema phù hợp có thể làm API dừng dù build thành công.

Dùng environment hoặc ASP.NET User Secrets theo [Program.cs](backend/src/SmartWMS.Api/Program.cs), không ghi credentials vào Git:

| Setting | Mục đích |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | Database development riêng; Hangfire storage có thể dùng connection này nếu không có connection riêng |
| `JwtSettings:Secret`, `Issuer`, `Audience` | Cấu hình phát hành/kiểm JWT; signing key riêng ít nhất 32 byte, không lấy ví dụ từ lịch sử |
| `GeminiSettings` | Provider settings theo model cấu hình hiện hành; provider không sẵn sàng phải thể hiện lỗi/fallback trung thực |
| `DatabaseInitialization:ApplyMigrationsOnStartup`, `SeedOnStartup` | Giữ false cho lần chạy thông thường trên database đã chuẩn bị |
| `Hangfire:EnableServer`, `RegisterRecurringJobsOnStartup`, `PrepareSchemaIfNecessary` | Giữ false trừ task riêng đã cho phép jobs/schema writes |

Kiểm cả environment/user-secret overrides. Không tự bật background AI job: source có job tạo inbound receipt.

Sau khi đã xác nhận database/schema và effective settings phù hợp, mở hai terminals:

~~~powershell
dotnet run --project backend/src/SmartWMS.Api --launch-profile http
~~~

Trong terminal frontend:

~~~powershell
if (-not (Test-Path -LiteralPath 'frontend/.env.local')) {
  Copy-Item -LiteralPath 'frontend/.env.example' -Destination 'frontend/.env.local'
}
# Sửa .env.local trước khi khởi động; không ghi secrets vào VITE_*.
npm --prefix frontend run dev
~~~

Chỉ copy khi `.env.local` chưa tồn tại. Dùng `VITE_DATA_MODE=api`, `VITE_API_BASE_URL=http://localhost:5215` cho HTTP profile; HTTPS profile dùng origin `https://localhost:7085` và certificate phù hợp. Base URL là **origin**, không kèm `/api/v1`. Restart Vite khi đổi environment. Đăng nhập bằng account đã được chuẩn bị riêng; frontend không provision users/database.

`npm --prefix frontend run dev:demo` là companion dùng mock/synthetic data, không chứng nhận ASP.NET/SQL/AI thật. Chỉ dùng synthetic credentials. Chi tiết ranh giới nằm ở [frontend guide](frontend/README.md) và [demo guide](frontend/demo/README.md).

## Development and reference

| Đọc khi cần | Tài liệu chính |
| --- | --- |
| Hướng dẫn chạy Demo 3 vai trò & E2E local | [DEMO_AND_E2E_RUNBOOK](docs/DEMO_AND_E2E_RUNBOOK.md) |
| Bộ Postman Collection & Environment mẫu | [SmartWMS.postman_collection.json](docs/postman/SmartWMS.postman_collection.json) ([local env](docs/postman/SmartWMS.local.postman_environment.json)) |
| Quy tắc Codex/Git/data safety | [AGENTS](AGENTS.md) |
| Kiến trúc, source snapshot, scope và unknowns | [PROJECT_CONTEXT](docs/PROJECT_CONTEXT.md) |
| Vòng làm việc một developer | [DEVELOPMENT_WORKFLOW](docs/DEVELOPMENT_WORKFLOW.md) |
| Chọn checks và phân biệt SQL/API mutation tests | [TEST_STRATEGY](docs/TEST_STRATEGY.md) |
| Inventory rules, lifecycle, retry và wire conventions | [API_CONTRACT](docs/API_CONTRACT.md) |
| Catalogue endpoints/DTOs, RBAC và FE refresh/provider handling | [FE_API_HANDOFF](docs/FE_API_HANDOFF.md) |

Không dùng báo cáo phase cũ làm hướng dẫn hiện hành. Serial/LPN/Wave, stored BOM, cross-warehouse transfer, mobile/PDA thật và post-pick reversal chưa thuộc phạm vi nghiệm thu end-to-end. Production readiness, deployed schema và live providers cần nghiệm thu riêng trên môi trường đích.
