# SmartWMS — Project context

Snapshot **15/11/2026** cho branch tài liệu từ B1a `f74b00e2fdf2d9c06c59334e7b1038fa9c7766bc`. Code kế thừa selected main M bên dưới; consolidation chỉ sửa Markdown, chưa commit/publish. Đây là source snapshot, không phải runtime acceptance.

## Source provenance

| Nhãn | Source | Phạm vi |
| --- | --- | --- |
| M | main `ad8b620038b5beab5f6225fb5a01460bf2414b97` | Implementation baseline mà B1a kế thừa |
| B1a | `f74b00e2fdf2d9c06c59334e7b1038fa9c7766bc` | Năm canonical docs của PR #8; source nền cho consolidation này |
| P | `67835e24ba739683b941f6ace0c6ea79a7b50037` | PR #7 Inventory Transfer Workspace, chưa tích hợp vào source B1a |
| O | `8b98f682bb0c70873f2ec9682806175445178511` | Original enhancements; workspace được bảo vệ có 37 dirty paths |
| G0 / G1A | Independent verification clones; G1A `7b6366dc9fbab405ffd5378efb2c88440eef4f9e` | G0 có staged patch ngoài HEAD; offline guard/preparation không phải production features |

PR #8 là Draft/chưa merge theo task; CI Success do owner cung cấp gắn với B1a head, không chứng nhận diff consolidation chưa commit. Kiểm Git/PR metadata lại trước tích hợp. Không merge/replay cả O/P để tiện cập nhật docs.

## Architecture

[Solution](../SmartWMS.slnx) chứa bốn production projects ở root. API → Application + Infrastructure; Application → Domain; Infrastructure → Application + Domain. Domain không phụ thuộc Infrastructure. Application dùng IApplicationDbContext và một số EF extensions; không phải package-free model thuần.

~~~text
React production route / TanStack Query / Axios
  → ASP.NET controller + authorization
  → MediatR / validator / handler / coordinator
  → persistence/provider interfaces
  → EF Core / SQL Server hoặc external provider
~~~

.NET 10, EF Core SQL Server 10.0.8, MediatR 12.2.0, FluentValidation 12.1.1; React 19, TypeScript 5.8, Vite 6, Tailwind 4, Query 5, Axios/i18next. Exact versions theo project/package/lock files. Backend vẫn ở root, frontend tại `frontend/`, harnesses tại `verification/`, shared orchestration tại `scripts/`; planned `backend/src/` restructuring chưa triển khai.

Production UI bắt đầu ở [App.tsx](../frontend/src/app/App.tsx), [dataMode.ts](../frontend/src/app/dataMode.ts). API mode mặc định; mock/demo và legacy không quyết định backend contract.

## Implemented source and limits

| Module | Có trong M/B1a | Giới hạn cần giữ |
| --- | --- | --- |
| Auth/admin | JWT login/logout, users/roles, audit | Logout không revoke JWT; chưa warehouse ACL hoặc multi-tenancy |
| Master data | Warehouse/Zone/Bin, Products/Suppliers/Customers APIs và selected FE surfaces | Entity/API không bảo đảm mọi CRUD UI đã có; NameEn schema chỉ O |
| Inventory | Physical summary/low-stock/history; backend adjust/status/same-warehouse transfer | ATP khác physical; dedicated transfer workspace chỉ P; adjustment/status/export UI của O không mặc nhiên có M |
| Inbound | Create/list/detail, delta receive, suggestion và explicit bin transfer | None/Lot không LPN; create Admin/WM, Staff receiving; không dock→putaway task engine |
| Outbound B3 | Pending → Allocated → Picked → Packed → Shipped | Whole-order, một source bin, None/Lot; Pick deduct once; không post-pick reversal |
| Cycle Count | Snapshot create/assignee lookup, own pending/detail/confirm | Staff ownership, Admin/WM override; không global listing/reassignment/approval workflow |
| Kitting / Replenishment | Atomic request recipe; global bodyless replenishment | Không stored BOM; zero-movement replenishment success hợp lệ |
| Reports / AI / realtime | XLSX capacity/occupancy; backend AI services; FE semantic search; SignalR source | Không SKU/Lot ledger export; live providers/browser/realtime FE chưa được nghiệm thu tại diff này |

Production routes gồm dashboard/inventory/replenishment/orders, inbound/outbound create, assigned cycle counting, kitting/products, locations/bins/vendors, users/audit, profile/settings. Audit route là `/dashboard/security/audit-logs`; `/dashboard/inventory/transfers` thuộc P.

Semantic search và inbound-create Admin/WM restriction đã có trong M qua lịch sử riêng. O có thêm inventory/customer/product operations, executive/OCR/chat/forecast/damage/slotting UI, supplier soft-delete filter, NameEn schema và UX fixes. Không gọi những O-only features đó là capability của B1a.

## Business rules and risks

[API_CONTRACT](API_CONTRACT.md) là nguồn tài liệu chính cho physical/ATP, receiving delta/precondition, direct-pick lifecycle, same-warehouse transfer, count snapshot/ownership, Kitting atomicity, replenishment và retry. [FE_API_HANDOFF](FE_API_HANDOFF.md) giữ catalogue endpoint/DTO/RBAC/provider/refresh chi tiết. Khi mâu thuẫn, đọc controller + handler hiện hành.

Chưa chứng nhận end-to-end Serial/LPN/Wave, stored BOM, cross-warehouse transfer, real mobile/PDA, post-pick reversal hoặc physical staging engine. Broad Staff master/planning/ship admission còn product-policy questions; không nới/siết quyền trong docs task. Replayed delta commands có thể mutate lại; mất response cần đối soát.

M có 31 migrations, latest AddDirectPickWorkflow; O có 32 với AddBilingualMasterData. Source count không chứng minh schema deployed. Background AI có đường tạo receipt; startup/jobs có side effects. Giữ secrets ngoài source, không dùng examples lịch sử. Product core creation phải hoạt động khi embedding unavailable; null vector không phải AI success.

## Current verification and documentation

Consolidation chỉ source/static checks, không application build/test/SQL/API mutation hoặc live AI. Solution không discover 12 console harnesses; frontend sprint có 9 suites và products → semantic test import. Coverage/side effects ở [TEST_STRATEGY](TEST_STRATEGY.md). CI configured không phải current acceptance; deployed schema, effective settings/jobs, live provider, browser E2E, backup/performance/deployment còn cần kiểm riêng.

[README](../README.md), [AGENTS](../AGENTS.md), [DEVELOPMENT_WORKFLOW](DEVELOPMENT_WORKFLOW.md), [TEST_STRATEGY](TEST_STRATEGY.md) là bộ dùng hằng ngày. [BACKEND_HANDOFF](BACKEND_HANDOFF.md), S1 và phase reports là checkpoint evidence; không thực thi các P0/P1 lịch sử như current backlog khi chưa đối chiếu source.

Các tài liệu chỉ có ở O: `docs/PROJECT_HANDOFF.md` (demo/fixture protections), `docs/FRONTEND_DESIGN_SYSTEM.md`, `docs/LOCAL_DEMO_DATASET.md`, PR0/PR1 và nhiều F0–F7 UI reports. Giữ tại source O; không copy dữ liệu fixture hoặc gọi UI enhancements của O là main. Chỉ trích/port thông tin trong task phù hợp. External audit/review packages, PR #8 inputs, Git recovery và Master Development Plan giữ nguyên; không thuộc cleanup của consolidation này.
