# PROJECT_CONTEXT — SmartWMS

> Source snapshot: **10/11/2026**, selected main **`ad8b620038b5beab5f6225fb5a01460bf2414b97`**.
> Phase B1a chỉ triển khai canonical documentation. Đây là source-labeled context, không chứng nhận runtime, current test PASS hoặc production readiness. Kiểm tra lại Git/source trước task mới; [root rules](../AGENTS.md) áp dụng toàn repository.

## Provenance: M / P / O / G0 / G1A

| Source | Exact source / branch | Meaning |
| --- | --- | --- |
| M | main `ad8b620038b5beab5f6225fb5a01460bf2414b97` | Selected implementation baseline; GitHub main read-only xác minh trùng SHA lúc bắt đầu B1a |
| P | `feat/pr7-inventory-transfer-workspace`, `67835e24ba739683b941f6ace0c6ea79a7b50037` | PR #7 Inventory Transfer Workspace; live metadata Open, chưa merge; **không nằm trong M** |
| O | `feature/post-submission-enhancements`, `8b98f682bb0c70873f2ec9682806175445178511` | Original enhancements; 37 dirty file paths expanded, không được cleanup hoặc lấy cả nhánh làm main |
| G0 | `codex/pr7-g0-guarded-acceptance`, HEAD `67835e24ba739683b941f6ace0c6ea79a7b50037` | Independent offline preparation; 12 staged added files là patch ngoài HEAD, không phải merged production source |
| G1A | `codex/pr7-g1a-offline-preparation`, `7b6366dc9fbab405ffd5378efb2c88440eef4f9e` | Independent offline trust/guard preparation; không có live resource/SQL/browser acceptance |

M/P/O/G không được gộp thành một feature baseline. B1a candidate là clone riêng từ M, branch `chore/b1a-canonical-documentation`, chỉ có 5 canonical Markdown changes, chưa commit/push/PR. Sau này SHA/status có thể đổi; bảng này là snapshot.

## Main architecture and current paths

Backend vẫn ở root: [solution](../SmartWMS.slnx), `SmartWMS.Api/`, `SmartWMS.Application/`, `SmartWMS.Domain/`, `SmartWMS.Infrastructure/`. Frontend tại `frontend/`; verification tại `verification/`; shared orchestration tại `scripts/`. **B2 backend/src restructuring NOT IMPLEMENTED.**

ProjectReference: API → Application + Infrastructure; Application → Domain; Infrastructure → Application + Domain. Domain không phụ thuộc Infrastructure. Application dùng IApplicationDbContext và một số EF extensions; không mô tả code như kiến trúc package-free thuần hoặc tự refactor dependency.

~~~text
Production React route
  → feature adapter / TanStack Query / Axios + session
  → controller / backend authorization
  → MediatR / validator / handler / coordinator
  → EF Core / SQL Server / provider
  → Result hoặc ProblemDetails
~~~

Technology khai báo trong source: net10.0, EF Core SQL Server 10.0.8, MediatR 12.2.0, FluentValidation 12.1.1; React19/TypeScript5.8/Vite6/Tailwind4/Query5/Axios/i18next. Exact package graph xem project/package/lock files; không chỉ dựa snapshot phiên bản này.

## Main source scope và giới hạn

| Area | M source implementation | Qualification |
| --- | --- | --- |
| Auth / administration | JWT login/logout, users, three-role authorization, audit | Logout không revoke JWT; chưa warehouse ACL; effective runtime NOT VERIFIED |
| Warehouse/master data | Warehouse/Zone/Bin, Products/Suppliers/Customers APIs và selected FE catalog/admin surfaces | API existence không chứng nhận mọi CRUD UI; NameEn O schema không ở M |
| Inbound | Receipt/create UI, receive delta/precondition, putaway suggestion/explicit transfer | None/Lot bounded scope; controller create Admin/WM; Staff receiving theo controller |
| Inventory / transfer | Physical summary/alerts/history/bin context; backend same-warehouse transfer và FE putaway | Dedicated transfer workspace chỉ P; O adjustment/status/export UI không mặc nhiên có M |
| Outbound | Direct-pick allocate → pick → pack → ship | Một source bin/order, whole-order None/Lot, không LPN |
| Cycle Count | Assigned pending/detail/create/confirm; snapshot và ownership checks | Không suy global listing/reassignment hoàn chỉnh từ entity |
| Kitting / Replenishment | Atomic request-defined recipe; global bodyless replenishment | Không stored BOM; 0 replenishment movement hợp lệ |
| Reports / AI / realtime | Backend XLSX capacity/occupancy, AI services; M FE semantic product search; SignalR source | Report không SKU/Lot ledger export; provider/live/realtime FE acceptance NOT VERIFIED |

Source guide: [App.tsx](../frontend/src/app/App.tsx), [dataMode.ts](../frontend/src/app/dataMode.ts), [inbound controller](../SmartWMS.Api/Controllers/InboundReceiptsController.cs), [CycleCountAccess](../SmartWMS.Application/Features/CycleCounting/CycleCountAccess.cs), [inventory coordinator](../SmartWMS.Infrastructure/Services/InventoryMutationCoordinator.cs).

Production routes ở nhánh API của App.tsx gồm dashboard, inventory, replenishment, orders, inbound/outbound create, assigned cycle counting, kitting, products, locations/bins/vendors, users/audit, profile/settings. Route security audit là `/dashboard/security/audit-logs`. M chưa có `/dashboard/inventory/transfers`; route đó thuộc P.

## O-only và P-specific work

O có committed enhancements cho inventory operations/export, customer/product forms, executive/OCR/chat/forecast/damage/slotting UI, supplier soft-delete filter, NameEn entities/DTO/schema và UX fixes. Không import những thay đổi đó trong B1a.

Semantic search và inbound-create Admin/WM restriction **đã có trong M qua lịch sử riêng**; không gọi chúng là O-only, không replay cả O commits để thêm lại. P chỉ có 11 frontend changed files cho transfer workspace/journal/reconciliation trên M; cần review độc lập, không merge để tiện chuẩn hóa docs.

G0/G1A chỉ có offline fake-policy/guard evidence; source SHA, approvals và future resource lifecycle không được suy ra từ fake tests. Live identity/native resource/durable storage/SQL/browser behavior vẫn UNKNOWN hoặc NOT VERIFIED.

## Inventory/security invariants

1. `stock-summary` trả physical quantity; `ATP = Quantity - ReservedQuantity`. Không đổi physical thành available stock.
2. `quantityReceived` là delta; giữ `expectedReceivedQuantity` precondition và receipt concurrency.
3. Allocate reserve; **Pick trừ physical stock đúng một lần**; Pack/Ship không deduct lại.
4. Transfer nguồn/đích phải cùng warehouse, giữ stock availability, capacity và metadata guards.
5. Cycle Count giữ snapshot ID/rowversion/quantity, full counted-item set, Staff assignee ownership; Admin/WM override theo handler.
6. Kitting lấy recipe từ request, atomic stock/occupancy/ledger/audit; không tự suy stored BOM.
7. Replenishment mutation toàn cục không body; zero-movement success hợp lệ.
8. Giữ transaction boundaries, SQL locks, rowversion/constraints, audit/ledger và conflict handling.
9. Backend thực thi quyền, không dựa ẩn menu. Không giả warehouse ACL; controller roles và handler ownership phải kiểm cùng nhau.
10. Timeout/lost response không cấp quyền replay stock mutation. Đối soát trước; không auto-retry khi chưa có idempotency/reconciliation contract.

Không dùng tồn tại entity/endpoint để chứng nhận Serial/LPN/Wave, stored BOM, cross-warehouse, mobile/PDA hoặc post-pick reversal end-to-end.

## Verification state

**B1a thực hiện static documentation verification; application build/typecheck/test runners NOT RUN.** CI configuration không phải bằng chứng current hosted PASS. Historical counts/results trong handoffs giữ theo source/time gốc, không chuyển thành kết quả của candidate.

M có 4 production projects trong solution và 12 console verification projects ngoài solution. CI configured chạy production build + isolated InboundCreateRbac authorization probe; không chạy tất cả harnesses. Frontend configured 9 sprint suites; products import semanticProductSearch test, inventory chưa import PR7 transfers. Wiring/side effects/details: [TEST_STRATEGY](TEST_STRATEGY.md).

Source migration count M **31**, O **32**, loại Designer/Snapshot; M latest AddDirectPickWorkflow, O thêm AddBilingualMasterData. Full Audit 10/11 từng ghi30/31; Phase A + Independent Review ghi erratum31/32. Giữ 8 audit originals; **deployed schema/migration apply state UNKNOWN**, không tự apply để khớp tài liệu.

## Runtime and data safety

Không khởi động production API, SQL harness, migrations/seed, Hangfire/server/recurring jobs, AI actions hoặc browser rehearsal trong documentation task. Backend startup/effective configuration có thể kích hoạt side effects; environment/user secrets chưa kiểm trong B1a. Background AI job có source tạo receipt, không mặc định advisory-only.

Không đưa secrets/JWT/credentials/private connection configuration vào docs/diff/ZIP. README template cũ có JWT Secret example; candidate đã loại, không nhân bản archive. Git history giữ bản cũ; owner đánh giá exposure/use/rotation riêng, không tự thay runtime settings.

## Active guides và historical evidence

Active: [README](../README.md), [AGENTS](../AGENTS.md), [DEVELOPMENT_WORKFLOW](DEVELOPMENT_WORKFLOW.md), [TEST_STRATEGY](TEST_STRATEGY.md).

[API_CONTRACT](API_CONTRACT.md), [FE_API_HANDOFF](FE_API_HANDOFF.md), [BACKEND_HANDOFF](BACKEND_HANDOFF.md), phase acceptance và [frontend README](../frontend/README.md) có checkpoint-specific claims. Đặc biệt frontend README còn nêu Staff create-inbound gap trước fix main và thiếu semantic scope; không sửa file ngoài allowlist trong B1a. Source/controller là authority khi mâu thuẫn.

Full Project Audit, Phase A và Independent Review là external planning/history inputs; không copy toàn bộ vào main. B1b/archive/52 generated-file policy/B2 paths và release còn cần owner approval. Unknowns còn lại: hosted checks/protection/reviews, deployed SQL state, provider availability, effective environment/jobs, browser E2E, external deployment paths và production readiness.
