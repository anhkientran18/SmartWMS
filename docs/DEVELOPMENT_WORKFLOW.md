# SmartWMS — Development workflow

## Baseline và phạm vi

CI Foundation được đối chiếu ngày 2026-11-07 trên `main` của `anhkientran18/SmartWMS`, commit `e35c6d1037a8b23c57b0e446ad783c74e0b95e6e`, sau Security PR #3 và Full-stack PR #2. Bộ năm file được chuẩn bị trước trên working copy `feature/post-submission-enhancements`; tài liệu này đã được cập nhật cho baseline main mới. Kết quả test cũ không chứng nhận baseline này.

PR chỉ thêm workflow, PR template, hai tài liệu và script local. Không đưa enhancement commits, production source, SQL configuration, migrations, generated artifacts hoặc local context vào PR.

## Quy trình làm việc

1. Xác định yêu cầu, phạm vi và tiêu chí nghiệm thu. Đọc `AGENTS.md`, `docs/PROJECT_CONTEXT.md` nếu có; kiểm tra branch, HEAD, status và source hiện hành.
2. Giữ nguyên các thay đổi đang có. Tạo branch/worktree sạch từ main đã xác minh; không tự reset, clean, stash, đổi branch trong working copy đang dùng.
3. Sửa patch nhỏ, giữ API/DTO/DB/RBAC và bất biến WMS nếu task không cho phép đổi. Review side effects của scripts trước khi chạy.
4. Chạy verification phù hợp; báo command, environment, PASS/FAIL/BLOCKED/NOT RUN và giới hạn. Không dùng kết quả lịch sử thay test hiện tại.
5. Sau khi chủ dự án duyệt commit/push, mở draft PR chỉ chứa scope được phép. Review CI và regression trước khi merge; không tự merge/deploy.

## CI Foundation không cần database

Workflow `.github/workflows/ci.yml` có đúng hai jobs độc lập:

| Check | Runner | Nội dung |
|---|---|---|
| `backend-build` | `windows-2025` | Install .NET SDK `10.0.x`, tạo `global.json` tạm để chọn SDK 10, restore và Release build `SmartWMS.slnx` với `--no-restore` ở bước build. |
| `frontend-quality` | `ubuntu-24.04` | Node.js 22, `npm ci --no-audit --no-fund`, `npm run typecheck`, tạo evidence directory, `npm run test:sprint`, `npm run build`. |

`frontend/package.json` không có script `test`; CI dùng `test:sprint` hiện có, không thêm alias hoặc sửa package files. `typecheck` là `tsc --noEmit`; Vite build không thay thế typecheck. Coverage và exclusions nằm trong [TEST_STRATEGY.md](TEST_STRATEGY.md).

Triggers: mọi `pull_request`, push vào `main`, và `workflow_dispatch`. Không dùng path filters; hai checks luôn được lên lịch trên PR. Concurrency hủy run cũ trên cùng ref. Mỗi job timeout 25 phút.

Token chỉ có `contents: read`; checkout đặt `persist-credentials: false`. Không dùng `pull_request_target`, self-hosted runner, production secrets, database service, API host, migration, seed, Hangfire hoặc Gemini. Build chỉ compile bốn production projects, không thực thi ứng dụng.

Actions dùng major tags theo tài liệu chính thức: [checkout v7](https://github.com/actions/checkout), [setup-dotnet v6](https://github.com/actions/setup-dotnet), [setup-node v7](https://github.com/actions/setup-node). Tags có thể di chuyển; chưa pin commit SHA. Runner-local `global.json` dùng SDK `10.0.100` và `latestFeature` để chọn SDK 10 mới nhất đã cài, kể cả image có SDK mới hơn.

Frontend cache là npm download cache, key theo `frontend/package-lock.json`; không cache `node_modules`. Cache path tính từ checkout root; mọi frontend `run` step có working directory `frontend`. `npm ci` vẫn bắt buộc chạy dù cache hit và sẽ fail khi manifest/lockfile không đồng bộ. Backend không bật setup-dotnet cache vì chưa có `packages.lock.json`; restore thường vẫn chạy, không giả lập locked restore.

Package root không có install lifecycle hooks. Lockfile có hooks của `@google/genai`, `esbuild`, `fsevents`, `protobufjs` và esbuild lồng trong `tsx`; `npm ci` chạy hooks theo platform. Review lại khi dependencies thay đổi. Chỉ cài trong environment tách biệt không có production credentials. `--no-audit` chỉ bỏ npm advisory request trong install; CI Foundation chưa có dependency vulnerability scan.

## Verification local

Cần PowerShell, .NET SDK 10 được chọn, Node.js 22 và npm đi kèm. Dùng isolated worktree nếu phải giữ artifacts. Trong `frontend`, chạy `npm ci --no-audit --no-fund` sau khi review package scripts; script không tự cài dependencies.

```powershell
# Kiểm tra phiên bản đang được chọn:
dotnet --version
node --version
# Nếu máy chọn SDK mới hơn, tạo global.json trong worktree tạm:
dotnet new globaljson --sdk-version 10.0.100 --roll-forward latestFeature
# global.json này chỉ dùng local; không đưa vào PR CI Foundation.
./scripts/verify-local.ps1
# Chỉ sau khi đã review working tree và chấp nhận artifact writes:
./scripts/verify-local.ps1 -AllowDirty
```

Script kiểm tra dirty tree, dependencies, SDK 10 và Node 22 trước build. `-AllowDirty` chỉ xác nhận đã review, không bảo vệ artifacts. `-SkipFrontendTests` có sẵn cho chẩn đoán local, phải báo NOT RUN; không dùng tùy chọn này để nghiệm thu CI và CI luôn chạy test.

Restore/build ghi `bin/obj`; một số `obj` đã tracked trong baseline, vì vậy không stage generated changes. Khi verification phải giữ diff chỉ gồm CI files, có thể chạy từng lệnh restore/build với cùng `--artifacts-path <thu-muc-output-ben-ngoai-worktree>`. Vite ghi `frontend/dist`; sprint ghi bundle/log/JSON vào `frontend/verification`, tạo rồi xóa hai temporary bundles Kitting/Products. Evidence directory phải được tạo trước trên checkout mới. Script không cleanup Git/artifacts hoặc chạy SQL/API. Output ngoài worktree cũng cần giữ để review, không đưa vào PR.

## Các bước tiếp theo cần phê duyệt riêng

- Chạy workflow thật sau khi được duyệt commit/push; local PASS chưa chứng nhận GitHub-hosted runner hoặc Linux.
- Sau hai checks xuất hiện và PASS ở commit thật, chủ dự án có thể cấu hình required checks `backend-build`, `frontend-quality` và PR review cho main. CI Foundation không thay repository settings.
- Test quality: wire và xác minh sáu nhóm AI chưa có trong sprint; port backend harness có chọn lọc, không copy nguyên mirror hoặc nới assertions.
- SQL integration: chỉ thiết kế/chạy sau khi xác nhận fixture riêng. Không dùng demo database, default LocalDB hoặc production connection strings.
- Browser E2E, live Gemini, vulnerability scanning và deployment thuộc task riêng.
