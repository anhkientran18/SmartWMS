# SmartWMS — Development workflow

Vòng làm việc cho một developer. [AGENTS](../AGENTS.md) quy định an toàn; [PROJECT_CONTEXT](PROJECT_CONTEXT.md) ghi source snapshot. Source layout vẫn ở root, chưa có `backend/src/`.

## One task, one reviewable change

1. Chốt một kết quả cụ thể và scope files/module. Đọc status/branch/HEAD và code thật trước sửa.
2. Giữ nguyên dirty work. Khi task cho phép, dùng branch/clone sạch từ commit đã chọn; không đưa cả O/P feature history vào patch docs/tooling.
3. Sửa nhỏ theo kiến trúc hiện có. Với nghiệp vụ, kiểm controller → DTO/validator → handler/coordinator → SQL và production UI tương ứng.
4. Chạy checks cần thiết trong [TEST_STRATEGY](TEST_STRATEGY.md), báo rõ NOT RUN. Không lặp suite đã PASS nếu không có thay đổi/rủi ro mới.
5. Review `git diff --check`, diff và file list; loại nhầm generated outputs khỏi patch bằng cách kiểm scope, không reset/clean protected work.
6. Bàn giao kết quả, evidence và giới hạn. Commit/push/PR/merge/deploy chỉ khi owner đã cho phép riêng; CI xanh không tự cấp quyền publish.

Database mutation, migration/schema, package, public contract và RBAC changes cần scope/approval tương ứng. Không chạy rehearsal hoặc seed để có dữ liệu demo tiện hơn.

## Documentation ownership

| Chủ đề | Nguồn chính |
| --- | --- |
| Onboarding/run | [README](../README.md) |
| Codex/Git/data safety | [AGENTS](../AGENTS.md) |
| Architecture, implemented/deferred scope | [PROJECT_CONTEXT](PROJECT_CONTEXT.md) |
| Inventory lifecycle và retry | [API_CONTRACT](API_CONTRACT.md) |
| Endpoint/DTO/RBAC/provider/refresh catalogue | [FE_API_HANDOFF](FE_API_HANDOFF.md) |
| Verification selection | [TEST_STRATEGY](TEST_STRATEGY.md) |

Cập nhật tài liệu chính khi behavior đổi; tài liệu khác dẫn link thay vì lặp toàn bộ bảng. Giữ provenance M/P/O/G. Reports cũ giữ ngày/checkpoint và không điều khiển current implementation.

Trước xóa tài liệu: kiểm nội dung độc nhất, links, scripts đọc file và evidence cần giữ. Historical certifiers có thể đọc/ghi docs và phụ thuộc snapshot; không chạy chúng để tái tạo PASS sau consolidation. Không chuyển cả tập reports sang archive chỉ để đổi vị trí.

## Local checks and CI

Onboarding commands ở README. `scripts/verify-local.ps1` là orchestration có writes: dirty guard, SDK 10/Node 22, dependencies, restore/build/typecheck/sprint/build. Đọc trước chạy; `-AllowDirty` không snapshot work, `-SkipFrontendTests` phải ghi NOT RUN.

[ci.yml](../.github/workflows/ci.yml) có `backend-build` (production build + isolated InboundCreateRbac probe) và `frontend-quality` (Node 22 install/typecheck/sprint/build). Không có SQL service, deployment, production startup hoặc live Gemini acceptance. CI configured khác actual run; kiểm exact head/status khi owner xét merge.

Docs-only: kiểm Markdown links/headings/references, whitespace và chỉ Markdown thay đổi. Application build không cần thiết. Với feature change, chọn build/suites theo module; SQL/API mutation tests cần fixture được xác nhận, không fallback sang shared/default configuration.

## Review handoff

Nêu problem/result, branch/full HEAD, pre-existing work, files/contract impact, commands và PASS/FAIL/NOT RUN, side effects và open risks. Không chép historical PASS thành current acceptance. Nếu request chưa được giải quyết, ghi blocker thay vì kết luận hoàn tất.
