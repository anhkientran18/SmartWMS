# AGENTS.md — SmartWMS working rules

Scope: toàn repository. Đọc [PROJECT_CONTEXT](docs/PROJECT_CONTEXT.md) trước task; [workflow](docs/DEVELOPMENT_WORKFLOW.md), [test strategy](docs/TEST_STRATEGY.md) và [inventory/API rules](docs/API_CONTRACT.md) là references chính. Hướng dẫn task cụ thể của owner có ưu tiên trong phạm vi được phép.

## Start with evidence

1. Xác định read-only, implementation hay verification. Read-only không ghi files hoặc chạy build/test có output.
2. Đọc branch/HEAD/status, source liên quan và AGENTS/override trong thư mục con. Snapshot và historical PASS không thay code/current verification.
3. Giữ nhãn nguồn: M = selected main, P = PR #7, O = original enhancements, G = verification clones. Chỉ có trong P/O/G không có nghĩa đã có trong M.
4. Thực hiện scope đã được cấp phép; không tự mở rộng hoặc hỏi lại quyền đã có. Nếu ambiguity ảnh hưởng business invariant, trình phương án và chờ quyết định.

## Architecture and contracts

- .NET 10: API → Application + Infrastructure; Application → Domain; Infrastructure → Application + Domain. Domain không phụ thuộc Infrastructure.
- Luồng: controller/authorization → MediatR/validator/handler → persistence/provider interfaces → Infrastructure/SQL Server. SQL Server/EF Core là nguồn tồn kho.
- Frontend production routing bắt đầu ở `frontend/src/app/App.tsx`; phân biệt API mode, demo và legacy. Controller/handler/DTO hiện hành quyết định route, payload và lỗi; API thường dùng `/api/v1`.
- Giữ kiến trúc/cách làm hiện có khi hợp lý; không refactor rộng hoặc đổi API/DTO/schema/RBAC để làm tests xanh.

## Inventory invariants

- Physical quantity khác ATP: `ATP = Quantity - ReservedQuantity`; stock-summary vẫn là physical.
- Receive: `quantityReceived` là delta dương, giữ `expectedReceivedQuantity` concurrency precondition.
- B3 allocate → pick → pack → ship: Pick trừ physical đúng một lần; Pack/Ship không trừ lại. Whole-order, một source bin, None/Lot, không LPN.
- Transfer: cùng warehouse, giữ availability/capacity/metadata và transaction guards.
- Cycle Count: snapshot ID/rowversion/quantity, đủ counted items; Staff chỉ sheet được giao, Admin/WM override theo handler.
- Kitting: recipe theo request, stock movement atomic; không suy stored BOM. Replenishment: mutation toàn cục, không body; 0 movement hợp lệ.
- Không bỏ transaction, SQL locks, rowversion, constraints, audit/ledger hoặc conflict handling. Không auto-retry/replay stock mutations sau timeout/lost response khi chưa có idempotency/reconciliation contract; đối soát trước.
- Entity/endpoint không chứng nhận Serial/LPN/Wave, stored BOM, cross-warehouse, mobile/PDA thật hoặc post-pick reversal end-to-end.

## Git, security and side effects

- Bảo toàn mọi work có sẵn. Không reset/clean/stash/checkout phục hồi, worktree prune/gc, xóa artifacts/locks, đổi branch, stage/commit/push/merge/publish nếu task chưa cho phép thao tác đó. Branch/clone riêng chỉ tạo trong scope đã duyệt.
- Package/schema/public contract/role changes, migrations hoặc thao tác không dễ đảo ngược cần approval trước nếu chưa được cấp. Không sửa database shared/demo; SQL write tests chỉ dùng fixture riêng được owner xác nhận.
- Backend thực thi quyền; ẩn menu không phải bảo mật. Ba roles Admin/WarehouseManager/Staff; inbound create Admin/WM, receiving giữ Staff. Chưa có warehouse ACL/multi-tenancy.
- Không ghi/log secrets, JWT, credentials, private connection settings hoặc dữ liệu cá nhân vào docs/diff/ZIP. Không lấy secret examples từ lịch sử; exposure/rotation do owner quyết định riêng.
- Đọc scripts/imports trước chạy để biết file writes, network, SQL, process launch và cleanup. Build ghi bin/obj/dist; generated/ignored không tự an toàn để xóa.
- Không tự bật startup migration/seed, Hangfire/jobs hoặc AI actions. Background AI có đường tạo receipt; provider lỗi phải giữ lỗi/fallback trung thực. Product core save không được phụ thuộc embedding thành công.

## Verification and handoff

Chạy checks phù hợp scope; docs-only dùng links/Markdown/whitespace và source checks, không cần application build. Solution không discover mọi console harness; kiểm runner/imports trước khi báo coverage. M có products → semanticProductSearch import; không suy tất cả AI suites đã chạy.

Báo ngắn bằng tiếng Việt: goal/scope, branch/HEAD trước-sau và work có sẵn, exact files changed, API/DTO/DB/RBAC/UI/invariant impact, commands/results/environment/side effects và NOT RUN, risks/next steps. Không gọi historical PASS là current PASS; nếu chưa giải quyết phải nêu blocker.

## Bảo vệ môi trường phát triển Windows

- Áp dụng cùng quy tắc tài nguyên cấp người dùng tại `%USERPROFILE%\.codex\AGENTS.md`. Chỉ làm scope được giao; ưu tiên fixture an toàn/số mẫu tối thiểu, không tạo hàng trăm/hàng nghìn thư mục hoặc tự chạy stress test, ACL probe, recursive filesystem test, migration rehearsal, fixture-generation hàng loạt.
- Trước tác vụ dự kiến tạo trên 1.000 file mới hoặc 250 MB dữ liệu tạm: nêu mục đích, phạm vi, vị trí và xin owner approval. Đây là ngưỡng owner đặt, không phải giới hạn mặc định của Codex; dữ liệu lớn cần giới hạn số lượng/thời gian và phương án artifacts.
- Chọn focused test đủ kiểm chứng; Markdown-only không chạy build/test. Không lặp Full Audit/regression/suite nặng đã PASS khi không có thay đổi liên quan hoặc rủi ro mới; không chạy verification sessions sinh artifacts trùng lặp. Kiểm tác động `bin/obj/dist/node_modules` và test outputs trước build; phân biệt current HEAD PASS với historical PASS.
- Theo dõi vị trí/ownership file tạm; chỉ xử lý disposable của task khi không còn tiến trình sử dụng. Không cleanup toàn Temp/artifacts task khác, đổi TEMP/TMP toàn hệ thống hoặc dùng OneDrive cho build/scratch/fixtures. Chỉ tạo report/ZIP/manifest/evidence bundle khi task cần.
- Không tự động xóa Codex visualizations/sessions, SQLite/sandbox state, Git stores/worktrees, workspace chính/PR7/Migration-Recovery, OneDrive cũ, source/patches/checkpoints/dirty work; bảy linked worktrees là dữ liệu thật. Không tự reset/clean/stash/gc/prune hoặc sửa/xóa Git metadata.
- Không dùng takeown/icacls reset/grant hàng loạt, sửa ACL AppData/sandbox/CodexSandboxUsers, đổi startup type CodexSandboxService.OpenAI.Codex, bật/tắt Services/scheduled tasks hoặc đổi Codex Sandbox. Access-Denied là blocker; không xin Administrator để vượt sandbox khi chưa được owner duyệt.
- Không tạo clone/worktree/sandbox instances không cần thiết, cài lại dependencies còn hợp lệ hoặc để servers/test runners do task khởi chạy tồn tại sau task khi không được yêu cầu duy trì.
- Giữ nguyên inventory/API/RBAC/DB/transaction/audit/concurrency và work có sẵn; mục này không cấp quyền commit/push/merge hoặc tích hợp PR #7/#8.
