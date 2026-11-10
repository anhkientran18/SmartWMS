# SmartWMS — Development workflow

> Active guide, đối chiếu source ngày **10/11/2026**, selected main **`ad8b620038b5beab5f6225fb5a01460bf2414b97`**.
> Phase B1a chỉ thay đổi 5 canonical Markdown trong clone riêng; chưa commit/push/PR. Không đổi CI, source hoặc layout.

## Start from evidence and authorization

1. Đọc [AGENTS](../AGENTS.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md), task allowlist và acceptance criteria. Xác định audit/read-only, implementation hay verification.
2. Đọc branch/HEAD/status và source thực tế. Context/audit là snapshot; tách M implementation, P unmerged, O enhancements, G independent infrastructure.
3. Chọn exact main SHA và clone/branch sạch khi task cho phép. Nếu task pin SHA và remote main đổi, dừng báo cáo, không tự rebase baseline.
4. Giữ nguyên mọi dirty work. Không stash/reset/clean/checkout hoặc xóa Git lock/artifacts của checkout được bảo vệ để làm verification dễ hơn.
5. Chỉ sửa allowlist. API/DTO/RBAC/schema/package/migration changes cần approval riêng trước khi thay đổi; docs task không ngầm cấp quyền feature fixes.

B1a dùng `chore/b1a-canonical-documentation` từ M trong clone độc lập. Original O/P/G0/G1A, Full Audit/Phase A/Independent Review là read-only inputs. B1b archive, B2 moves và 52 tracked generated/IDE files không thuộc B1a.

## Keep changes reviewable

Mỗi patch có một mục đích và dependency rõ. Không đưa O-only feature history hoặc toàn bộ branch vào documentation/tooling change. Kiểm controller/handler/DTO/routing theo selected source; giữ inventory/concurrency/audit/permission rules.

Trước execution, đọc scripts/imports/lifecycle hooks để hiểu file writes, network, SQL hoặc process launch. Build output và historical evidence là hai loại khác nhau; không regenerate PASS reports/certifiers để phù hợp source mới. Không copy secrets/private configuration hoặc dependencies từ original.

## Documentation review

Canonical entry: root [README](../README.md) và [AGENTS](../AGENTS.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md), guide này và [TEST_STRATEGY](TEST_STRATEGY.md). Giữ guides tại `docs/` trong B1a; không viết commands như backend đã ở `backend/`.

Một docs patch phải:

- Gắn baseline/source labels cho capability và verification claims.
- Soát relative links, source paths, Markdown syntax và whitespace, gồm cả untracked additions.
- Phân biệt baseline broken links với introduced broken links.
- Ghi finding của tài liệu ngoài allowlist; không tự sửa historical acceptance hoặc import hàng loạt O docs/assets.
- Không đưa secret examples vào docs mới hoặc review bundle. Sensitive deleted preimage trong diff phải redact, ghi rõ review patch có giới hạn áp dụng.

API handoffs/phase reports và frontend README có historical statements; khi mâu thuẫn, source hiện tại và active context là điểm đối chiếu. Documentation-only patch ưu tiên static checks, không cần application build để báo nghiệm thu.

## Local verification responsibilities

Requirements source/CI: .NET SDK10, Node22, npm tương ứng; frontend dependencies cài theo lockfile trong clone riêng sau khi review hooks. Repo chưa có developer `global.json`, nên kiểm active SDK trước restore/build. SDK selector tạm nếu cần chỉ tạo trong environment được phê duyệt, không tự thêm vào PR docs.

Root layout hiện tại dùng:

~~~powershell
dotnet restore SmartWMS.slnx --nologo
dotnet build SmartWMS.slnx --configuration Release --no-restore --nologo
npm --prefix frontend run typecheck
npm --prefix frontend run test:sprint
npm --prefix frontend run build
~~~

Đây là commands cho task có approval verification/artifact writes, **NOT RUN trong B1a**. Trước sprint, tạo `frontend/verification/shared/evidence` trong candidate environment; trước install, review `npm ci` và dependency hooks. Xem [TEST_STRATEGY](TEST_STRATEGY.md) để chọn đúng tests và biết exclusions.

[scripts/verify-local.ps1](../scripts/verify-local.ps1) giữ root orchestration: dirty guard, SDK10/Node22 check, dependencies check, restore/build/typecheck/sprint/build. Không tự cài package. `-AllowDirty` chỉ acknowledgment sau review, không snapshot/protect artifacts; `-SkipFrontendTests` phải báo NOT RUN và không đủ frontend acceptance.

Restore/build có thể thay `obj` đã tracked; npm/Vite/test runners ghi outputs. Không stage artifacts, không cleanup protected checkout; cân nhắc consistent `--artifacts-path` ngoài clone cho restore/build trong task được phép. Không dùng `dotnet test SmartWMS.slnx` để nhận coverage 12 console harnesses.

## CI requirements configured in source

[ci.yml](../.github/workflows/ci.yml) cấu hình hai jobs độc lập:

| Check | Runner / toolchain | Configured checks |
| --- | --- | --- |
| `backend-build` | windows-2025, SDK10.0.x, runner-local global.json | Production solution restore/Release build và InboundCreateRbac isolated authorization probe |
| `frontend-quality` | ubuntu-24.04, Node22, cwd frontend | npm ci --no-audit --no-fund; typecheck; evidence directory; test:sprint; build |

Triggers: pull_request, push main, workflow_dispatch; không path filter. Timeout25 phút/job; concurrency hủy run cũ cùng ref. Token contents:read; checkout persist-credentials:false. npm download cache theo frontend/package-lock.json, không cache node_modules; backend không locked restore/packages.lock.json cache.

CI không cấu hình SQL service, production API startup, seed/migrations, Hangfire hoặc live Gemini. InboundCreateRbac chạy loopback HTTP trong host riêng, không production Program/business handlers/database. Source comments về AI suites không thay cho current import-chain review: main đã wire semanticProductSearch qua products.

**Configured không phải hosted PASS.** B1a không chạy workflow; checks/protection/reviews hiện hành chưa được đánh giá cho merge. Không đổi workflow/job names/repository settings trong documentation scope. Package lifecycle/network/security scan limits xem TEST_STRATEGY.

## PR / approval / release gates

1. Trình scope, full review diff (redact sensitive preimage nếu cần), file hashes, verification commands/results và open risks.
2. Chỉ stage/commit/push hoặc mở PR khi được người dùng cho phép cụ thể. Approval sửa docs không tự cấp quyền publish hoặc mở PR.
3. Sau authorization, PR phải giữ allowlist, nêu concrete behavior/docs change, baseline, test evidence và NOT RUN exclusions. Giữ P/O feature integration độc lập.
4. Merge cần separate owner approval, relevant current checks/review và source safety. Không lấy mergeable=true hoặc historical local PASS làm merge permission. Required checks/settings chỉ thay trong task riêng.
5. Deployment, production configuration, secret rotation, SQL fixture provisioning/migrations/seed/browser E2E/live providers cần scope/approval riêng. Không tự bật jobs hoặc release sau CI xanh.

Với timeout/lost response của stock mutation, reconciliation trước mọi đề xuất gửi lại; không auto-retry/replay để khám phá outcome.

## Handoff and stop

Báo tiếng Việt: goal/scope, branch/HEAD trước-sau, pre-existing changes, exact files changed, API/DTO/DB/RBAC/invariant impact, commands và PASS/FAIL/NOT RUN, side effects, risks/next decisions. Không ghi secrets hoặc historical PASS như current result.

B1a dừng sau canonical docs, static validation và external review bundle. Chờ ChatGPT review/owner duyệt trước commit/push, B1b/B2 hoặc feature development. Rollback candidate chưa commit là xử lý riêng theo owner; không reset/clean original.
