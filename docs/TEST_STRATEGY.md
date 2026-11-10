# SmartWMS — Test strategy

> Active source coverage guide: **10/11/2026**, main **`ad8b620038b5beab5f6225fb5a01460bf2414b97`**.
> B1a đọc workflow/projects/runners/imports và kiểm tài liệu tĩnh; **không chạy application build, typecheck hoặc test runner**.

## Evidence levels

| Label | Meaning in this guide |
| --- | --- |
| Tests configured | Source workflow → command → runner → entry/import chain đã đối chiếu |
| Tests actually executed | Cần command/environment/exact source, exit code và output của một run thật |
| Historical PASS | Chỉ gắn với run/source cũ; không chứng nhận selected main hoặc docs candidate |
| Current NOT RUN | B1a không execute application/test checks; chỉ static documentation checks có kết quả mới |
| NOT VERIFIED | SQL/production host/browser/live provider/deployment behavior chưa được chứng minh bởi wiring hoặc mock checks |

Không dùng test file tồn tại, compile thành công hoặc tên suite để suy tests đã chạy. Không đưa total tests historical183/197/254/267 vào current acceptance. Results phải lấy từ actual run trên exact candidate khi có task được phê duyệt.

## CI configured at selected main

Source: [ci.yml](../.github/workflows/ci.yml), [package.json](../frontend/package.json), [solution](../SmartWMS.slnx).

| Layer | Configured command / scope | What it can establish when actually run |
| --- | --- | --- |
| Backend compile | SDK10 restore SmartWMS.slnx; Release build --no-restore | Compile4 production projects; không production host hoặc SQL behavior |
| Inbound RBAC | dotnet run --project verification/InboundCreateRbac/InboundCreateRbac.Verification.csproj --configuration Release --no-launch-profile | Isolated loopback authorization/controller dispatch assertions; không business execution |
| Frontend install | npm ci --no-audit --no-fund tại frontend, Node22 | Lock/manifest install consistency; không vulnerability scan |
| TypeScript | npm run typecheck → tsc --noEmit | tsconfig include src +vite.config; không typecheck toàn bộ frontend tests |
| Frontend regression | npm run test:sprint |9 suites qua esbuild/Node test, controlled adapters/SSR/source assertions |
| Frontend bundle | npm run build → vite build | Build static assets; không xác nhận live API/browser |

Hai check IDs là backend-build và frontend-quality. Workflow không SQL service/deploy/jobs; frontend cwd/cache/evidence settings xem [DEVELOPMENT_WORKFLOW](DEVELOPMENT_WORKFLOW.md). B1a không thay hoặc chạy CI; hosted status **NOT VERIFIED**.

## Frontend runner/import matrix

[run-sprint.mjs](../frontend/tests/run-sprint.mjs) gọi9 runners tuần tự, ghi log/result và trả failure nếu runner lỗi. Runners bundle entry bằng esbuild rồi Node --test theo cwd frontend.

| Suite | Runner tại frontend/tests | Entry | Additional test import at M |
| --- | --- | --- | --- |
| auth | run-auth.mjs | auth.test.ts | — |
| inventory | run-inventory.mjs | inventory.test.tsx | Không có transfers/inventoryOperations import |
| replenishment | run-replenishment.mjs | replenishment.test.tsx | — |
| inbound | run-inbound.mjs | inbound.test.tsx | — |
| outbound | run-outbound.mjs | outbound.test.tsx | — |
| cycle-count | run-cycle-count.mjs | cycle-count.test.tsx | — |
| kitting | run-kitting.mjs | kitting.test.ts | — |
| products | run-products.mjs | products.test.tsx | `import './semanticProductSearch.test';` |
| administration | run-administration.mjs | administration.test.tsx | — |

Configured semantic path:

~~~text
package.json test:sprint
 → tests/run-sprint.mjs (products)
 → tests/run-products.mjs
 → tests/products.test.tsx:1
 → tests/semanticProductSearch.test.tsx
~~~

`test:products` chạy products runner trực tiếp và có cùng semantic import. Semantic tests dùng controlled HTTP adapters/test doubles và SSR: kiểm GET text query, validation/encoding, response/error/provider handling, cancellation, result rendering và mutation boundary. Đây **không** là live Gemini/SQL/browser acceptance; **NOT RUN trong B1a**.

M không có năm O-only AI test files `aiChat`, `demandForecast`, `aiSlotting`, `damageVision`, `executiveDashboardOcr` (đuôi .test.tsx). Câu “sáu AI files absent/unwired” trong guide cũ lỗi thời vì semanticProductSearch hiện đã có và được import. M cũng không có inventoryOperations/customerProductOperations supplementary suites từ O. Không copy feature/test code O trong docs task.

P có transfers.test.tsx và inventory import, nhưng **P chưa merge**: không claim main configured transfer-workspace tests. P test đọc controller theo old root path; adaptation thuộc B2/PR7 integration riêng, không sửa B1a.

## Backend project discovery and runner safety

[SmartWMS.slnx](../SmartWMS.slnx) chỉ có4 production projects. Source có12 console verification projects net10.0/OutputType Exe ngoài solution; không tìm thấy dedicated test-SDK/IsTestProject unit suite. `dotnet test SmartWMS.slnx` không discover/execute các console assertions đó.

| Console project group under verification/ | Classification / execution gate |
| --- | --- |
| InboundCreateRbac | Isolated HTTP authorization probe không SQL; chỉ run khi task cho phép local host/artifacts |
| AcceptanceF1, AuthorizationS1, BackendB2, CoreHardeningH2 | SQL/HTTP/provider/fixture/mirror-capable historical tooling; không chạy mặc định |
| InboundB1, KittingK1, OutboundB3, Phase4A, Phase4B, ReleaseHardening, ReplenishmentR1 | Business/SQL/concurrency verification; cần source/runner review và approved isolated fixture |

Compile solution không chứng nhận compile các harness. Future task cần enumerate từng csproj/build target/import rồi chọn compile/run allowlist; không sửa assertions hoặc schema/roles để cho green. CertifyFinal/Summarize/Audit/PrepareMirror helpers có thể ghi docs/evidence, copy/rewrite source mirrors hoặc chạy processes; không dùng để tái chứng nhận lịch sử sau rename.

[InboundCreateRbac README](../verification/InboundCreateRbac/README.md) mô tả empty Kestrel host trên ephemeral loopback, actual JWT Bearer/authorization và production inbound controller, safe MediatR probe. Denied requests phải zero dispatch; admitted create trả RBAC_FIXTURE_STOP (HTTP400), không tạo receipt. Staff create denied, Admin/WM admitted; regression nhận hàng/GET và combined policies. Không load production Program/config/user secrets/Infrastructure DI/business handlers/SQL/live AI. Đây là authorization boundary evidence khi chạy, không unit suite hoặc full business acceptance.

G0/G1A ở independent checkouts, không thuộc main CI hay production solution. Historical fake-policy results không chứng nhận live infrastructure/SQL/browser hoặc cấp quyền execution.

## Commands for an approved future verification task

Run từ root của clone tách biệt, sau đọc side effects và kiểm SDK10/Node22; không execute trong B1a:

~~~powershell
dotnet restore SmartWMS.slnx --nologo
dotnet build SmartWMS.slnx --configuration Release --no-restore --nologo
npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run typecheck
New-Item -ItemType Directory -Path frontend/verification/shared/evidence -Force
npm --prefix frontend run test:sprint
npm --prefix frontend run test:products
npm --prefix frontend run build
~~~

Chỉ cần targeted suites phù hợp changes; không repeat build/tests khi không có thay đổi hoặc unresolved concern. Không có npm script `test`; administration dùng runner trực tiếp hoặc sprint. Offline RBAC console command trong CI table chỉ chạy khi authorization task đã review và cho phép host riêng; không phải yêu cầu cho docs patch.

## Side effects and data safety

- Restore/build ghi bin/obj, có thể làm dirty artifacts đã tracked; output redirection phải nhất quán giữa restore/build và reviewed runner paths.
- npm ci tạo/thay node_modules và chạy dependency lifecycle hooks. Dùng fresh isolated environment; không junction original dependencies, không đưa production credentials vào process.
- Sprint ghi bundles tại frontend/verification/{f1..f6,shared}/scripts, logs/results tại shared/evidence; evidence directory cần tạo trước. Kitting/Products tạo rồi xóa đúng2 temporary root bundles. Không gọi Git cleanup.
- Vite ghi frontend/dist; dev:demo là server riêng không phải production acceptance.
- Không chạy prepare-local-demo.mjs, rehearse-local.mjs, Newman/Postman, SQL-capable harness, migration/seed/reset/cleanup hoặc production API/Hangfire/live AI như bước test mặc định.
- Không có SQL integration trên SmartWMS_DB/shared/default target. Fixture phải được owner xác nhận, fail closed với exact target/ownership, không fallback appsettings/user secrets. B1a không tạo fixture hoặc thay runtime configuration.

## Coverage gaps / future acceptance

Chưa chứng nhận current SQL transaction/concurrency/ledger, migrations deployed, all-controller RBAC, login/revocation lifecycle, browser E2E, live Gemini, realtime integration, dependency scan, performance/backup/deployment. Mock API URLs localhost là controlled fixture configuration, không bằng chứng gọi host thật.

Future approved integration cần bảo toàn physical≠ATP, receiving delta/precondition, Pick deduct once, same-warehouse transfer/capacity/metadata, count snapshot/full-set/ownership/override, atomic request-recipe Kitting, global bodyless zero-op Replenishment, ledger/audit/rowversion và uncertain-outcome reconciliation. Source M có31 migrations (exclude Designer/Snapshot); apply state UNKNOWN, không migrate shared DB để kiểm count.

## Reporting

Mỗi actual run ghi branch/fullSHA/patch scope, OS/SDK/Node/npm, exact command, exit code, count thực tế, PASS/FAIL/BLOCKED/NOT RUN và evidence location. Tránh sensitive logs; không ghi tokens/credentials/connections. Local PASS không chứng nhận hosted platform hoặc end-to-end.

Documentation verification của B1a gồm allowlist, links/Markdown/whitespace, source provenance, secret-preimage exclusion và source-preservation checks. `git diff --check` không cover untracked files; validate AGENTS/context additions riêng. Application checks trong tài liệu này vẫn **NOT RUN**.
