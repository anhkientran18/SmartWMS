# SmartWMS — Test strategy

## Phạm vi CI hiện tại

Source baseline: `main` tại `a31bb37d16799decfe0b6a5dc2cac31f828eaea9`, đối chiếu 2026-11-07. CI gồm compile backend, InboundCreateRbac regression và frontend quality không cần SQL. Kết quả thực thi local nằm trong báo cáo bàn giao ngoài branch; tài liệu này mô tả coverage từ source, không tuyên bố GitHub Actions đã PASS.

| Lớp | CI chạy | Điều được kiểm tra |
|---|---|---|
| Backend build | `dotnet restore SmartWMS.slnx --nologo`; `dotnet build SmartWMS.slnx --configuration Release --no-restore --nologo` | Compile bốn production projects bằng SDK 10; không chạy production application. |
| Backend RBAC | `dotnet run --project verification/InboundCreateRbac/InboundCreateRbac.Verification.csproj --configuration Release --no-launch-profile` | Chạy console assertions sau production build trong `backend-build`; exit code khác 0 làm job fail. Host loopback riêng, JWT Bearer và authorization middleware thật, production inbound controller và safe MediatR probe; không chạy business handlers hoặc SQL. |
| Dependency install | `npm ci --no-audit --no-fund` trong `frontend` với Node 22 | Manifest/lockfile đồng bộ, cài dependencies theo lockfile và platform. Không phải vulnerability scan. |
| TypeScript | `npm run typecheck` | `tsc --noEmit` theo `frontend/tsconfig.json`: `src` và `vite.config.ts`; không typecheck toàn bộ test files. |
| Frontend tests | `npm run test:sprint` | Chín suites dùng Node test + esbuild, Axios mock adapters, SSR và source assertions. |
| Frontend build | `npm run build` | Vite bundle production; không xác nhận API runtime hoặc trình duyệt. |

Không dùng `npm run test`: package.json hiện không khai báo script đó. Không dùng `dotnet test SmartWMS.slnx` để nhận coverage backend: solution chỉ chứa production projects, không chứa các console verification harness.

InboundCreateRbac kiểm tra create: anonymous/invalid/expired JWT trả 401; Staff và authenticated role không phù hợp trả 403; Admin/WarehouseManager vượt authorization tới `RBAC_FIXTURE_STOP` (HTTP 400), không tạo receipt. Denied requests không dispatch MediatR, kể cả malformed JSON. Regression giữ Staff confirm-receipt và GET page/list/detail/putaway; kiểm tra exact metadata và combined policies của cả 11 inbound actions. Số assertions thực tế lấy từ output mỗi lần chạy, không dùng số lịch sử để suy ra PASS. Xem [harness README](../verification/InboundCreateRbac/README.md).

## Test wiring đã đối chiếu

`frontend/tests/run-sprint.mjs` gọi tuần tự các runner bên dưới. Mỗi runner bundle đúng entry test bằng esbuild rồi gọi Node `--test`; runner sprint trả exit code lỗi nếu bất kỳ suite không thành công. Không bỏ suite hoặc tắt assertions để làm CI xanh.

| Suite | Entry test | Import test bổ sung |
|---|---|---|
| auth | `auth.test.ts` | — |
| inventory | `inventory.test.tsx` | — |
| replenishment | `replenishment.test.tsx` | — |
| inbound | `inbound.test.tsx` | — |
| outbound | `outbound.test.tsx` | — |
| cycle-count | `cycle-count.test.tsx` | — |
| kitting | `kitting.test.ts` | — |
| products | `products.test.tsx` | — |
| administration | `administration.test.tsx` | — |

Những tests này kiểm tra logic frontend, HTTP payload/error mapping, quyền UI, cache/mutation behavior, SSR và source guards. URL localhost trong runner là cấu hình fixture; HTTP được mock. Đây không phải chứng nhận backend authorization, SQL locks, transaction atomicity hoặc WMS end-to-end.

Khác working copy enhancement cũ, baseline main này không có `inventoryOperations.test` hoặc `customerProductOperations.test`; hai entry Inventory/Products không import các nhóm bổ sung đó. Không nhận coverage từ working copy cũ.

Sáu file AI được nhắc trong tài liệu chuẩn bị cũng không có tại baseline này: `aiChat.test.tsx`, `demandForecast.test.tsx`, `semanticProductSearch.test.tsx`, `aiSlotting.test.tsx`, `damageVision.test.tsx`, `executiveDashboardOcr.test.tsx`. Runner không liệt kê/import chúng. Tên file hoặc test lịch sử không chứng minh chúng đã chạy trong CI này. Không tự copy AI suites hoặc feature changes từ enhancement branch vào scope CI.

## Side effects và bảo vệ dữ liệu

- Backend restore/build ghi artifacts và có thể cập nhật `obj` đang tracked; không stage các output này. Có thể chuyển artifacts ra ngoài worktree bằng `--artifacts-path` cho cả restore và build khi verify local.
- Sprint ghi bundles tại `frontend/verification/{f1..f6,shared}/scripts`, log và JSON tại `frontend/verification/shared/evidence`. Workflow/script tạo evidence directory trước vì runner không tự tạo. Kitting/Products xóa đúng hai temporary bundles chúng tạo tại root frontend.
- Vite ghi `frontend/dist`; npm ci tạo/thay `frontend/node_modules` và chạy dependency lifecycle hooks. Dùng install mới trong worktree tách biệt, không junction tới dependencies của working copy gốc.
- Chỉ chạy `verification/InboundCreateRbac` trong các console harness: empty host không load production Program.cs/configuration/user secrets, Infrastructure DI, business handlers hoặc live AI services. Không chạy các harness khác, `frontend/tests/rehearse-local.mjs`, production API host, SQL scripts, migration, seed, cleanup hoặc Hangfire/background AI jobs. Không cần database/production secrets.
- Review runner, imports, project files, Vite config và lifecycle hooks lại khi source thay đổi. Không auto-retry stock mutation sau timeout/lost response.

## Những lớp chưa được CI bao phủ

Backend unit/business integration/concurrency harness và HTTP/RBAC ngoài phạm vi inbound endpoint của InboundCreateRbac; production startup, login/token lifecycle, SQL migrations và dữ liệu thật, browser E2E, frontend AI suites, live Gemini và background AI actions, dependency/security scanning, deployment/rollback. Build và inbound authorization assertions thành công không chứng nhận các lớp này.

SQL integration chỉ được chạy trên fixture/database tách biệt đã được chủ dự án xác nhận. Runner phải fail closed nếu target không đúng fixture, không fallback sang appsettings/user secrets, không attach demo database. Dùng dữ liệu tổng hợp; setup/migration/cleanup chỉ tác động database do runner sở hữu. Chưa chọn hoặc thêm Testcontainers/package/schema trong CI Foundation.

Các bất biến cần integration coverage tiếp theo:

1. Physical stock khác ATP; reservation/rowversion, conflict, ledger/audit và lost response reconciliation.
2. Receiving delta và `expectedReceivedQuantity`; stale/concurrent receive.
3. Outbound allocate → pick → pack → ship; chỉ Pick trừ physical stock đúng một lần.
4. Transfer cùng warehouse, capacity/metadata/availability guards và rollback.
5. Cycle Count snapshot, đầy đủ counted items, Staff ownership và Admin/WM override.
6. Kitting atomic theo recipe request; Replenishment bodyless, zero movement hợp lệ.
7. Backend three-role authorization ngoài inbound endpoint; SQL integration xác nhận request bị từ chối không thay dữ liệu. InboundCreateRbac đã kiểm tra authorization và zero MediatR dispatch cho denied requests, nhưng không dùng database.
8. Migration chain và upgrade dữ liệu theo source hiện hành; không suy ra migration đã apply từ việc build.

Browser tests tiếp theo cần environment fixture, production routing với API mode và ba role. Mock/SSR PASS không chứng nhận browser hay database demo. Serial/LPN/Wave, stored BOM, cross-warehouse transfer, mobile/PDA và post-pick reversal chưa được chứng nhận end-to-end.

## Ghi nhận evidence

Mỗi lần verify ghi branch, full HEAD, patch scope, OS, SDK/Node/npm, command, exit code, số tests thực tế và PASS/FAIL/BLOCKED/NOT RUN. Phân biệt lỗi sandbox/network với lỗi source; retry chỉ lệnh verification an toàn sau khi được cho phép môi trường. Không tắt test, audit mặc định của .NET hoặc sửa assertions để đạt PASS.

Logs, exact diff và final report giữ ngoài PR; không ghi credentials, JWT hoặc connection strings. `git diff --check` không thấy untracked files, nên phải whitespace-check các file mới bằng diff từ empty file hoặc cơ chế tương đương nếu có. GitHub-hosted checks chỉ được ghi PASS sau run thật; local Windows/Node 22 không chứng nhận frontend Ubuntu runner.
