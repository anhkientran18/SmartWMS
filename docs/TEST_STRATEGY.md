# SmartWMS — Test strategy

Tài liệu chiến lược kiểm thử cho nhánh `main` (đã hợp nhất PR #7–#15 gồm chuyển kho cùng kho, điều chỉnh/đổi trạng thái tồn kho, xuất Excel, Master Data CRUD, chuẩn hóa `backend/src/`, gia cố RBAC & Executive Dashboard, và 5 bề mặt Advisory AI còn lại). Xem thêm [Demo & E2E Runbook](DEMO_AND_E2E_RUNBOOK.md) và [SmartWMS Postman Collection](postman/SmartWMS.postman_collection.json) cho kịch bản kiểm thử tích hợp trên database cô lập.

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

| Suite | Entry trong frontend/tests | Số lượng tests |
| --- | --- | :-: |
| auth | `auth.test.ts` | 11 |
| inventory | `inventory.test.tsx`, import `transfers.test.tsx`, `stockAdjustment.test.tsx`, `inventoryOperations.test.tsx`, `aiSlotting.test.tsx` | 98 |
| replenishment | `replenishment.test.tsx` | 13 |
| inbound | `inbound.test.tsx`, import `ocrInvoice.test.tsx`, `damageVision.test.tsx` | 53 |
| outbound | `outbound.test.tsx`, import `customerOperations.test.tsx` | 33 |
| cycle-count | `cycle-count.test.tsx` | 29 |
| kitting | `kitting.test.ts` | 35 |
| products | `products.test.tsx`, import `semanticProductSearch.test.tsx`, `productOperations.test.tsx`, `demandForecast.test.tsx` | 82 |
| administration | `administration.test.tsx` (bao gồm Executive Dashboard & RBAC assertions), import `aiChat.test.tsx` | 30 |

Tổng cộng **`384/384` tests PASS trên 9 suites** khi chạy `npm --prefix frontend run test:sprint` hoặc `powershell -ExecutionPolicy Bypass -File .\scripts\verify-local.ps1`. Toàn bộ các mô-đun vận hành từ PR #7–#15 (`transfers`, `stockAdjustment`, `inventoryOperations`, `customerOperations`, `productOperations`, `ExecutiveInsightCard` / K11 RBAC, và đủ 7 bề mặt Advisory AI) đã được đấu nối vào runner chuẩn.

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

## Verified checkpoints

- **Current `main` baseline (sau PR #15 / `79a3a2bebf1a19ced56251eb8ff4d0d5d9732439`):**
  - `scripts/verify-local.ps1`: Release `dotnet build SmartWMS.slnx` (`0` warnings/errors), `npm --prefix frontend run typecheck` (`0` errors), `npm --prefix frontend run test:sprint` (**9 suites / 384 tests passed, 0 failures**: auth 11, inventory 98, replenishment 13, inbound 53, outbound 33, cycle-count 29, kitting 35, products 82, administration 30), và `npm --prefix frontend run build` PASS.
  - **Live SQL + HTTP E2E trên database cô lập `SmartWMS_K13_Verify` (`(localdb)\MSSQLLocalDB`, đã xóa sau kiểm thử):** 31 EF Core migrations áp dụng sạch; Hangfire `/hangfire` bị khóa (`404`); 3-Role RBAC (`Admin`, `WarehouseManager`, `Staff`) xác thực đầy đủ (`403` cho các thao tác quản trị, `200` cho `GET /api/v1/Bins/{id}/contents`); toàn bộ 8 luồng kho lõi (Master Data, Inbound delta/409 concurrency, Putaway/Transfer, Stock Adjustment + XLSX export, Outbound Allocate→Pick→Pack→Ship không trừ kép, Cycle Count ownership, Kitting atomic assembly, Audit Logs) và kiểm chứng không làm biến đổi tồn kho trên cả 7 AI endpoints đều PASS (`48/48` checks).
- **Historical checkpoint (06/11/2026):** source `3b6fcded123f51ff0baafcf5b4917619d495d773` — **9 suites / 183 tests passed** (auth 11; inventory 15; replenishment 13; inbound 20; outbound 26; cycle-count 29; kitting 35; products 24; administration 10).
