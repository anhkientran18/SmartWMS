# SmartWMS — Test strategy

Source: B1a `f74b00e2fdf2d9c06c59334e7b1038fa9c7766bc` (code từ M trong [PROJECT_CONTEXT](PROJECT_CONTEXT.md)). Consolidation này chỉ kiểm tài liệu tĩnh; **không chạy application build/typecheck/test, SQL/API/browser hoặc live AI**.

## Select the smallest meaningful check

| Loại thay đổi | Checks thông thường khi task cho phép | Giới hạn |
| --- | --- | --- |
| Markdown | Links/headings/references, `git diff --check`, file allowlist và source claims | Không cần build; kiểm riêng untracked additions nếu có |
| Backend code | SDK 10 restore/Release build của `SmartWMS.slnx`; harness phù hợp sau review runner | Solution chỉ có 4 production projects |
| Frontend code | `npm --prefix frontend run typecheck`, targeted suite hoặc sprint, build khi cần | Typecheck chỉ scope tsconfig; mock/SSR không phải SQL/browser acceptance |
| Inbound authorization | Isolated [InboundCreateRbac](../verification/InboundCreateRbac/README.md) khi task cho phép host/artifacts | Loopback host + production controller/JWT + safe MediatR probe; không production Program/business handlers/SQL |
| Inventory/concurrency/RBAC integration | Approved isolated SQL fixture + module/API harness | Có writes; không chạy mặc định hoặc trên database shared/demo |
| Browser/live provider | Environment/account/provider scope riêng | Không suy từ compile hoặc mock PASS |

Build/typecheck không chạy WMS mutation; chúng vẫn ghi artifacts, có thể restore packages/lifecycle hooks. Phân biệt **configured**, **actually executed tại exact SHA**, **historical PASS** và **NOT RUN/NOT VERIFIED**.

## Ordinary commands

Từ checkout riêng được phép ghi outputs, SDK 10 và Node 22 đã chọn đúng:

~~~powershell
dotnet restore SmartWMS.slnx --nologo
dotnet build SmartWMS.slnx --configuration Release --no-restore --nologo
npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run typecheck
New-Item -ItemType Directory -Path frontend/verification/shared/evidence -Force
npm --prefix frontend run test:sprint
npm --prefix frontend run build
~~~

Chỉ chọn lệnh phù hợp task. `npm ci` thay node_modules và chạy hooks; npm `--no-audit` không chứng nhận dependencies an toàn. Build/restore ghi bin/obj; Vite ghi dist; một số generated files đã tracked. Không stage output hoặc clean/reset work có sẵn.

[CI](../.github/workflows/ci.yml) cấu hình `backend-build` trên Windows/SDK 10 và `frontend-quality` trên Ubuntu/Node 22. Nó không chạy tất cả console harnesses hoặc production startup. Actual CI status chỉ có giá trị cho run/head tương ứng, không cho diff tài liệu chưa commit.

## Frontend runner coverage

[run-sprint.mjs](../frontend/tests/run-sprint.mjs) chạy chín suites bằng esbuild/Node test, controlled HTTP adapters, source assertions và SSR:

| Suite | Entry trong frontend/tests |
| --- | --- |
| auth | auth.test.ts |
| inventory | inventory.test.tsx |
| replenishment | replenishment.test.tsx |
| inbound | inbound.test.tsx |
| outbound | outbound.test.tsx |
| cycle-count | cycle-count.test.tsx |
| kitting | kitting.test.ts |
| products | products.test.tsx, import semanticProductSearch.test.tsx |
| administration | administration.test.tsx |

Products → semantic import thuộc configured coverage tại B1a; `test:products` có cùng import. Chưa có P transfers import hoặc O inventoryOperations/customerProductOperations và năm AI UI suites (chat/forecast/slotting/damage/executive-OCR) trong source này. Không nhận coverage chỉ vì tên file tồn tại ở checkout khác.

Sprint ghi bundles tại `frontend/verification/{f1..f6,shared}/scripts`, logs/JSON tại `shared/evidence`; cần tạo evidence directory trước. Products/Kitting tạo rồi xóa temporary root bundles. Individual npm scripts xem [package.json](../frontend/package.json); administration dùng runner trực tiếp. Không có npm script `test`.

## SQL and API mutation tests

M có 12 console verification projects **ngoài solution**. `dotnet test SmartWMS.slnx` không tự discover/execute chúng. InboundCreateRbac là isolated authorization probe; các harness AcceptanceF1, AuthorizationS1, BackendB2, CoreHardeningH2, InboundB1, KittingK1, OutboundB3, Phase4A, Phase4B, ReleaseHardening, ReplenishmentR1 cần review SQL/HTTP/provider/fixture side effects trước khi chọn.

Các điều kiện bắt buộc cho write tests:

- Owner xác nhận exact isolated fixture/target/ownership và setup/cleanup scope. Fail closed; không fallback appsettings/user secrets hoặc attach default/shared/demo database.
- Đọc runner/imports, không chỉ tên project. PrepareMirror/Certify/Audit/Summarize có thể copy/rewrite source mirrors, ghi evidence/docs hoặc chạy processes.
- `prepare-local-demo.mjs`, `rehearse-local.mjs`, Postman/Newman và production host không thuộc ordinary frontend checks; có thể gọi mutation thật.
- Không tự bật migration, seed, Hangfire/jobs, AI actions hoặc retry inventory mutation để khám phá outcome.

Coverage cần giữ: [inventory rules](API_CONTRACT.md), quantity/reservation bounds, receiving delta/precondition, Pick deduct once, same-warehouse transfer/capacity/metadata, count snapshot/full-set/ownership/override, Kitting atomic recipe, global replenishment zero-op, audit/ledger/rowversion và lost-response reconciliation. Fixture adapters lịch sử không tự chứng nhận current source.

## Evidence and remaining gaps

Mỗi run thật ghi command, exact source/patch, OS/SDK/Node/npm, exit code/count thực tế, outputs/side effects và PASS/FAIL/BLOCKED/NOT RUN. Giữ historical evidence theo checkpoint; không regenerate reports để source mới trông đã PASS.

SQL migration apply state, production authorization/token lifecycle, browser E2E, live Gemini, realtime FE, dependency/security scan, performance/backup/deployment chưa được chứng nhận bởi consolidation này. Source migrations không chứng minh database đã apply.

## Historical frontend checkpoint

Giữ evidence trước đây ở frontend README: **06/11/2026**, source `3b6fcded123f51ff0baafcf5b4917619d495d773`, isolated Windows worktree, Node 22.23.4/npm 10.9.9/.NET SDK 10.0.202; backend restore/build, frontend clean install/typecheck/build và **9 suites/183 tests passed**.

Counts lịch sử: auth 11; inventory 15; replenishment 13; inbound 20; outbound 26; cycle-count 29; kitting 35; products 24; administration 10. Đây không phải run trên B1a/consolidation, không SQL integration/live API/browser/live AI acceptance, không thay current coverage inspection.
