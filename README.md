# SmartWMS

SmartWMS là monorepo quản lý kho gồm backend ASP.NET Core và frontend React. SQL Server/EF Core là nguồn dữ liệu tồn kho; frontend gọi API có authorization, validation, transaction và audit ở backend. Gemini cung cấp một số khả năng hỗ trợ; có source không đồng nghĩa đã nghiệm thu production.

Đối chiếu source ngày **10/11/2026** trên selected main **`ad8b620038b5beab5f6225fb5a01460bf2414b97`**. Phase B1a chỉ cập nhật tài liệu; không build/test/runtime acceptance mới. Đọc [project context](docs/PROJECT_CONTEXT.md) để phân biệt main, PR #7, original enhancements và verification infrastructure.

## Source scope hiện tại

Main có source cho hierarchy Warehouse → Zone → Bin, master data, login/RBAC, physical stock reads, inbound receiving/putaway, outbound direct-pick, assigned Cycle Count, request-defined Kitting, global Replenishment, reports và backend AI integrations. Frontend production có các workflow tương ứng theo [App.tsx](frontend/src/app/App.tsx), cùng product catalog/QR/barcode và semantic product search.

PR #7 bổ sung Inventory Transfer Workspace nhưng **chưa merge**, không nằm trong selected main. Các UI enhancements và NameEn schema chỉ ở original O phải review/port riêng. Không coi prototype/demo screens hoặc entity Serial/LPN/Wave là supported end-to-end workflows.

## Technology stack

| Layer | Source-declared technology |
| --- | --- |
| Backend | .NET 10 / ASP.NET Core controllers; MediatR 12.2.0, FluentValidation 12.1.1 |
| Persistence | EF Core 10.0.8 / SQL Server; SQL locks, rowversion, constraints và inventory coordinators |
| Security / integrations | JWT Bearer, Serilog, OpenAPI, Hangfire, SignalR, Gemini services |
| Frontend | React 19, TypeScript 5.8, Vite 6, Tailwind 4, React Router 6, TanStack Query 5, Axios, i18next |
| Verification | .NET console harnesses; frontend Node test/esbuild, controlled HTTP adapters và SSR |

Phiên bản chính xác xem các `.csproj`, [package.json](frontend/package.json) và [package-lock.json](frontend/package-lock.json). Domain hiện cũng có package references; không mô tả nó như package-free model.

## Repository structure — implemented

~~~text
SmartWMS/
├── .github/workflows/ci.yml
├── SmartWMS.slnx
├── SmartWMS.Api/
├── SmartWMS.Application/
├── SmartWMS.Domain/
├── SmartWMS.Infrastructure/
├── frontend/
│   ├── src/
│   ├── tests/
│   ├── demo/
│   ├── legacy/
│   └── package.json
├── verification/
├── scripts/verify-local.ps1
├── docs/
├── AGENTS.md
└── README.md
~~~

Dependencies: **API → Application + Infrastructure; Application → Domain; Infrastructure → Application + Domain; Domain không phụ thuộc Infrastructure**. API nhận HTTP/RBAC; Application xử lý command/query/validation; Domain chứa model/rules; Infrastructure thực thi persistence/providers. Solution chỉ chứa bốn production projects. Mười hai console verification projects không tự được build/test qua solution.

Frontend có production API routing và explicit demo routing; legacy proposals không xác định backend contracts. Shared verification orchestration giữ tại `scripts/`.

**Planned repository restructuring — NOT IMPLEMENTED:** Phase A đề xuất backend source dưới `backend/src/`. B1a chưa move projects, guides hoặc generated files; mọi lệnh bên dưới dùng layout hiện tại.

## Development prerequisites

Yêu cầu được xác minh từ project/CI/lockfile: Git, **.NET SDK 10**, **Node.js 22 (từ 22.12)** và npm tương ứng; PowerShell nếu dùng script local. Repo chưa có `global.json` chọn SDK cho developer. Xác minh SDK đang được chọn trước restore/build; CI tạo SDK selector tạm ở runner.

Availability/version trên máy người đọc và khả năng fresh install/build là **NOT VERIFIED trong B1a**. Không yêu cầu một phiên bản IDE hay SQL engine chưa được chứng minh tương thích. SQL chỉ cần cho runtime/integration trên environment được owner cho phép, không cần để review tài liệu.

## Safe build and frontend verification

Các lệnh dưới là hướng dẫn cho **clone tách biệt đã được phép ghi artifacts**, không phải lệnh đã chạy trong B1a:

~~~powershell
dotnet --version
node --version
dotnet restore SmartWMS.slnx --nologo
dotnet build SmartWMS.slnx --configuration Release --no-restore --nologo

npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run typecheck
New-Item -ItemType Directory -Path frontend/verification/shared/evidence -Force
npm --prefix frontend run test:sprint
npm --prefix frontend run build
~~~

Restore/build ghi `bin/obj`, npm install ghi `node_modules` và chạy dependency lifecycle hooks, sprint ghi bundles/logs/JSON và xóa hai temporary bundles do nó tạo, Vite ghi `frontend/dist`. Một số generated/IDE files đã tracked; không stage output và không reset/clean checkout được bảo vệ. Không dùng junction tới dependencies của original. `--no-audit` của npm install không phải vulnerability scan.

[verify-local.ps1](scripts/verify-local.ps1) kiểm dirty tree, SDK 10, Node 22 và dependencies rồi chạy selected checks; đọc script/side effects trước khi dùng. `-AllowDirty` không bảo vệ artifacts; `-SkipFrontendTests` phải báo NOT RUN. Xem [test strategy](docs/TEST_STRATEGY.md) để chọn đúng runner; không tự chạy SQL-capable harness hoặc rehearsal scripts.

## Frontend API mode

[Data mode](frontend/src/app/dataMode.ts) mặc định API; chỉ `VITE_DATA_MODE=mock` chọn demo. Trong cấu hình frontend local không tracked, dùng `VITE_DATA_MODE=api` và `VITE_API_BASE_URL` bằng **backend origin**, không kèm `/api/v1`. Adapters thêm route prefix. Không có origin trong API mode tạo configuration error; không tự fallback mock.

Sau khi review environment, có thể chạy `npm --prefix frontend run dev`. Vite cần restart/rebuild khi đổi environment. Biến `VITE_*` là public browser settings: không đặt signing key, provider key, credentials hoặc database configuration vào đó.

API mode cần backend/accounts/schema có sẵn trong environment được phê duyệt. Frontend setup không cấp quyền provision database. Backend startup có thể kiểm schema, migrate/seed hoặc chạy jobs theo **effective configuration**; không tự chạy API/migration/seed trên shared database để onboarding. Runtime preparation là task riêng.

## Demo / mock mode

`npm --prefix frontend run dev:demo` chạy Express/Vite companion với mock providers; dùng synthetic accounts, không nhập real credentials. Demo data có thể reset khi restart, một số browser stores persist. Demo auth/AI/security/mobile/Wave/Serial/LPN không phải live acceptance. Không proxy demo endpoints sang ASP.NET. Xem [demo boundary](frontend/demo/README.md) và [legacy references](frontend/legacy/README.md).

## Testing and evidence

CI configured hai checks: `backend-build` (SDK10 production build và isolated InboundCreateRbac authorization harness) và `frontend-quality` (Node22 install/typecheck/sprint/build). Sprint configured chín suites; products entry import `semanticProductSearch.test.tsx`, nên semantic tests nằm trong configured import chain. **Configured không có nghĩa đã executed/PASS tại HEAD hiện tại.**

B1a chỉ static verification tài liệu; application build/tests **NOT RUN**, SQL/browser/live Gemini **NOT VERIFIED**. `dotnet test SmartWMS.slnx` không chứng nhận 12 console harnesses. Mock/SSR/authorization-probe checks không chứng nhận SQL atomicity hoặc browser E2E. Full coverage, safe commands và exclusions: [TEST_STRATEGY](docs/TEST_STRATEGY.md).

## Documentation navigation

- [AGENTS.md](AGENTS.md): repository-wide working rules và approval/data safety.
- [PROJECT_CONTEXT](docs/PROJECT_CONTEXT.md): selected-source snapshot, M/P/O/G provenance và unknowns.
- [DEVELOPMENT_WORKFLOW](docs/DEVELOPMENT_WORKFLOW.md): scoped changes, review, CI và release gates.
- [TEST_STRATEGY](docs/TEST_STRATEGY.md): runner/import coverage, evidence levels và side effects.
- [API_CONTRACT](docs/API_CONTRACT.md), [FE_API_HANDOFF](docs/FE_API_HANDOFF.md), [BACKEND_HANDOFF](docs/BACKEND_HANDOFF.md): supporting checkpoint contracts, cần đối chiếu controller/DTO hiện tại.
- [Frontend README](frontend/README.md): historical frontend-baseline guide; còn mô tả inbound create policy trước bản sửa main và chưa cập nhật semantic search. Không lấy các câu đó thay current controller hoặc active guides.

## Security, data safety and known limitations

Backend authorization là authority; ba roles `Admin`, `WarehouseManager`, `Staff`. Source main giới hạn inbound create cho Admin/WM; Staff receiving và count ownership theo controller/handler. Chưa có warehouse-level ACL; JWT logout không phải revocation. Effective deployment exposure và current runtime RBAC chưa được nghiệm thu trong B1a.

Giữ physical stock khác ATP, receiving delta/precondition, Pick deduct đúng một lần, transfer cùng warehouse, count snapshot/ownership, atomic request-defined kitting, global bodyless replenishment và zero-movement success. Không tự retry inventory mutation sau timeout/lost response khi chưa đối soát được kết quả.

Background AI job có source tạo inbound receipt khi được bật; không coi tất cả AI paths chỉ đọc. Không tự bật Hangfire/jobs, migrations, seed hoặc live providers. Không có signing-key example trong tài liệu mới; không dùng ví dụ secret cũ làm runtime configuration. Owner đánh giá exposure/rotation riêng nếu cần.

Serial/LPN/Wave, stored BOM, cross-warehouse transfer, mobile/PDA và post-pick reversal chưa được chứng nhận end-to-end. SignalR source không chứng minh production frontend realtime integration. Deployed schema/provider availability/performance/backup/release readiness vẫn **NOT VERIFIED**. Tiếp tục theo [workflow](docs/DEVELOPMENT_WORKFLOW.md) sau scope approval; B1b/B2 chưa triển khai.
