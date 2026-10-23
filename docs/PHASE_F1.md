# Phase F1 — API / AI / Postman acceptance

**F1 RESULT: PARTIAL — external Gemini quota/rate limit. NOT COMMITTED. NOT PUSHED.**

Branch `main`; approved HEAD remains `54695729aadbe7753671e0eee00cf4e80734af21` (R1). No migration, business schema redesign, LPN implementation, staging, commit, or push. Evidence is from isolated SQL LocalDB fixtures and actual HTTP, never saved Postman examples.

## API coverage and counting

There are **96 controller method/route pairs**, all present in the refreshed WORKING collection. The old collection contained 95 requests (94 distinct controller routes), including a duplicate inbound create; B3 direct Pick and Pack were missing. The refreshed collection has **119 runtime requests**, including dependency creation, details, mutations, negatives, and safe cleanup. No stale/deleted controller route remains.

The release-ready denominator is **93**: exclude legacy crossdock, wave consolidation, and serial pick-verify. Those three still have explicit runtime checks and classifications; they are not promoted into B3 Stable.

- Latest release-ready complete happy paths: **89 / 93**. Executive HTTP200 with unavailable AI is counted as fallback, not a full AI happy path.
- Earlier complete run: **93 / 93**, with 118/118 requests and 273/273 Postman assertions passing. The subsequent crossdock negative is also verified. Earlier success does not erase the latest rate-limit failures.
- Latest Newman: **115 / 119 request scenarios**, **267 / 271 assertions**. Four failed assertions correspond to four live AI capabilities below.
- SQL/auth/transport F1 checks: **251/251**; SQL AI data correctness: **20/20**. Infrastructure results and combined assertion totals are recorded in `verification/AcceptanceF1/AcceptanceEvidence.json`.
- Latest combined acceptance metric: **545 / 549 assertions/checks**, not raw HTTP200 responses. Regression counts are separate. The acceptance gate returns nonzero when the recorded Newman run contains failures; an individual SQL check summary must not be interpreted as the overall F1 result.

The full method/route/source/Postman/block/auth/dependency/status matrix is in [PHASE_F1_API_MATRIX.md](PHASE_F1_API_MATRIX.md). Anonymous calls were tested against every protected controller route. Real Admin/Staff login, malformed JWT, expired signed JWT, allowed Staff access, and forbidden Staff samples were exercised.

Infrastructure endpoints are outside the 96 controller denominator: Development `GET /openapi/v1.json`, `GET /healthz`, local-only Hangfire HTML dashboard, and SignalR negotiation (anonymous401/authenticated200). SignalR transport connection is not counted as a REST business workflow. No new Hub methods were introduced.

## AI / external results

User Secrets supplies the real backend key; it is never copied into Postman, reports, or source. Live discovery advertised models that returned404 for text generation. `gemini-3-flash-preview` actually generated text and vision responses, and `gemini-embedding-001` returned 768 dimensions. Development/default text settings now select the verified Flash preview model for both DefaultModel and ProModel; these remain independently configurable. This does not claim a Pro-model quality guarantee or future provider availability.

| Endpoint/capability | Live happy evidence | Latest live result | Failure / validation acceptance |
|---|---|---|---|
| POST Chat/ask | HTTP200 nonempty actual text | PASS200 | empty/oversize400; provider429/500, malformed/empty envelopes; actual transport timeout504 and cancellation |
| GET Forecasts/demand-prediction | HTTP200 correct SKU, authoritative history and future nonnegative forecast | PASS200 | missing SKU/history rejected; invalid shape/SKU/date/quantity rejected; provider failures mapped |
| GET Dashboard/executive | HTTP200 core data plus actual nonempty insight | HTTP200 core preserved, `aiInsight.aiAvailable=false`; Gemini429 | fallback explicitly unavailable, no synthetic insight; request cancellation not swallowed |
| GET Dashboard/ai-slotting-recommendations | HTTP200 scoped SKU/current/allowed zone advisory | HTTP502; Gemini429 | outside SKU/invented zone/invalid JSON rejected; no stock mutation |
| GET Products/semantic-search | HTTP200 active fixture identities | PASS200 | empty query400; bad provider/embedding rejected; deleted cache identities excluded |
| POST Products (embedding integration) | HTTP200 actual API-created products, SQL stores 768 finite dimensions | PASS200 | malformed/dimension-mismatch embedding and provider failure leave DB unchanged |
| POST InboundReceipts/scan-invoice | HTTP200 parsed invoice structure | HTTP502; Gemini429 | upload validation plus malformed/provider/empty result checks |
| POST InboundReceipts/report-damage | HTTP200 `analysis` structure (not `data`) | HTTP502; Gemini429 | upload validation plus malformed/provider/empty result checks |

**Latest root cause is observed upstream HTTP429, not a missing key and not a fabricated response.** Text/vision were called live successfully earlier; the final run exceeded the available provider rate/quota. The last four happy assertions intentionally remain failed. Dependency error handling passing does not turn those happy paths into PASS.

Controlled dependency tests use an explicitly separate local HTTP gateway: provider429/500, malformed JSON, missing candidates, empty text, invalid structured business payloads, open circuit, and transport timeout. They verify public failure contracts and complete SQL snapshots, not live-provider happy paths. Chat and executive are text contracts; nonempty text is not subjected to invented exact-wording assertions. Missing-key behavior is tested at the shared production service boundary. Existing voice/forecast/slotting adapter classes with no separate public controller route are not presented as additional release-ready endpoints; the unused `AiForecastingService` placeholder remains outside this route acceptance.

## Upload

Fixtures: `verification/AcceptanceF1/fixtures/invoice.png` (small synthetic invoice) and `damage.png` (synthetic damaged carton). Actual multipart field is `file`; no caller filesystem path is opened or written by the server.

Both routes had real vision HTTP200 earlier and were quota-blocked in the final run. Tested negatives: anonymous401, empty file400, extension/content-type mismatch400, bad signature400, path-containing filename400, and >5 MiB400. Invalid/provider/empty vision output yields dependency502; JSON/required fields are checked. Validation and failure cases preserve the entire SQL database. Signature validation is a header check, not a full image decoder; truncated otherwise-header-valid input still relies on the vision dependency's rejection.

## Business workflows

| Workflow | Actual HTTP / SQL acceptance |
|---|---|
| Master CRUD | API-generated unique fixtures, create/detail/list/paged/update and delete of disposable records; product creation calls actual embedding provider |
| Inbound B1 | Create → detail captures item IDs and expected current quantities → receive → detail verifies exact full receipt; duplicate receive409; separate unused draft update/delete |
| Inventory / Transfer | Summary/alerts/history; adjust+1; valid status contract; transfer1 with captured ID; SQL verifies physical quantities, ATP, occupancy, lot and expiry |
| Cycle Count | Create sheet → detail captures every count item → confirm zero variance; pending tasks query; no invented item IDs |
| Kitting K1 | Assemble2 from component4; actual route200 and SQL issue/receipt ledgers; output quantity2; K1 negative/concurrency matrix retained in regression |
| Replenishment R1 | Existing target1/capacity10 → movement9; repeated run0; SQL target10 and no duplicate movement; ATP/cross-warehouse/LPN/capacity cases in regression |
| B3 Outbound | Create/update → allocate → detail captures reservations → whole-order pick3 → pack → ship → detail Shipped; physical deduction only at Pick; terminal duplicate pick409 |
| Weight | Advisory endpoint200 with `isValid=true` at900g and `isValid=false` at1g; it does not execute B3 Pack/Ship or prove order ownership |
| Crossdock | No-demand advisory200; pending B3 direct order409 with no mutation; legacy matching algorithm remains deferred/unsafe for Stable |
| Legacy wave / serial | B3 orders rejected409. Wave fixture includes enough IDs to pass minimum-count validation; no fabricated wave code or manual serial IDs |
| Reports / audit / dashboards | Actual XLSX ZIP signature, audit query after real mutations, occupancy/chart/metrics routes; scheduler storage initialized on fixture only, workers/jobs disabled |

Final exact inventory equation: source `120 + 1 - 1 - 4 - 9 - 3 = 104`, destination `1 + 9 = 10`, kit output2. Occupancy equals physical stock, reservations stay within stock and are consumed at Pick, component lot/expiry persist, one outbound ledger and one Kitting issue/receipt pair. Pack and Ship add no second physical deduction. Complete DB snapshots are unchanged by invalid AI/uploads and all controlled AI failures/fallbacks.

SQL data tests also prove forecast aggregation includes negative OUTBOUND/WAVE_OUTBOUND/OUTBOUND_SERIAL, excludes transfer/positive/old/future history, and returns authoritative daily demand17. Scoped slotting includes only in-zone historical source bins and products (demand9), excluding the same SKU's outside-zone movements and an outside-only product.

## Bugs found and fixes

| Severity | Issue | Disposition |
|---|---|---|
| P1 | Provider key embedded in request URI could enter logs | Fixed: key header; safe dependency messages, no raw provider body returned |
| P1 | Legacy crossdock could modify pending B3 lines outside reservation lifecycle | Fixed B3 fail-closed guard before mutation; legacy subsystem still deferred |
| P2 | Retired/inaccessible default text models | Config updated to actually live-tested model; quota remains external blocker |
| P2 | Malformed/empty Gemini envelopes, bad embedding dimensions, cancellation and open circuit could become generic500 | Fixed bounded30s transport, cancellation propagation, safe502/503/504 contracts; real HTTP negatives verified |
| P2 | Forecast could trust fabricated historical values/date range or include future ledger | Fixed authoritative history and output bounds/identity/quantity checks |
| P2 | Slotting could include wrong product/source scope or invented zones | Fixed scoped positive stock/current hierarchy and output validation; advisory only |
| P2 | Executive AI outage hid core dashboard data | Fixed explicit nested availability/error code and empty unavailable summary |
| P2 | Semantic cache could return deleted/stale identities | Fixed active source specification and current entity projection at return time |
| P2 | Upload lacked bounded type/signature/name checks and meaningful structured validation | Fixed5 MiB, extension/MIME/signature/name checks and vision result validation |
| P2 | Old Postman blocked K1/R1/B3 and required fixture copying | Refreshed original collection, generated fixtures/captures/order/current assertions |
| P2 | Initial F1 wrapper did not propagate Newman nonzero exit | Fixed; recorded-result gate verified nonzero against final failed live assertions |

`POLICY AMBIGUOUS`: Inventory and CycleCounting use authenticated-only policy; the existing Staff behavior is retained. Bins class-level Admin/WarehouseManager restriction intersects its contents method roles, so adding Staff at the method does not grant Staff access. Hangfire keeps its existing local-dashboard filter. Business authorization policy requires a separate decision; no new policy was invented.

## Regression

All suites rebuilt against the final mirror. **884/884** regression assertions passed, plus12/12 orchestration/anchor checks.

| Suite | Checks | Result |
|---|---:|---|
| Phase4A |95|PASS|
| Phase4B |107|PASS|
| Inbound B1 |142|PASS|
| B3 schema |24|PASS|
| B3 focused / cached context / HTTP |161 / 5 / 46|PASS|
| K1 focused / HTTP |127 / 15|PASS|
| R1 focused / HTTP |136 / 26|PASS|

Final solution and F1 verification builds: **0 warnings, 0 errors**. Restore uses cached packages with NuGetAudit disabled for the isolated mirror; no package or project dependency change is made to production. Original `obj` files and dirty PasswordHasher are not built or rewritten. The mirror uses committed PasswordHasher. Legacy regression shared-DB read references are redirected in the mirror only to a generated F1 anchor and checked unchanged. Every generated SQL fixture reports verified cleanup.

## Postman ready-to-run

**PARTIAL overall because of live Gemini rate/quota. Business fixture automation is ready-to-run.** Import the updated existing WORKING collection and environment, configure an isolated local backend, set exactly `baseUrl`, `username`, `password` (Admin), and run from folder01. No fixture IDs or token need manual copying. Base URL accepts localhost/127.0.0.1 only; jobs/seed should be disabled on the test server.

The same original collection identity is retained. Stale future/manual blocks are removed for K1/R1/B3 and live-tested AI. Unsupported legacy routes are exercised through safe rejection/no-op cases instead of asking for invented IDs. All saved response examples are removed; none is runtime evidence. Environment values remain empty; password is marked secret. Backend provider key remains server-side.

- Generated: unique per-run prefix, codes, SKU, lot, fixture email/password, receipt/order/reference codes, future delivery/ship dates and expiry.
- Captured: JWT; user/warehouse/zone/source/destination/kit-bin/product/kit-product/supplier/customer IDs; inbound receipt/item/current receive items; count sheet/all count item IDs; transfer ID; outbound order/item/reservation/allocation/source inventory IDs; ledger transaction/reference strings and Kitting/replenishment transaction IDs. Bin contents does not expose inventory PK; that PK is captured from outbound reservation detail. Wave is unsupported for B3, so no fake wave ID is generated.
- End-to-end: master CRUD, inbound, inventory/transfer, cycle count, K1, R1, B3, audit/report/dashboard; AI/vision prepared with valid fixture data and previously live-verified, currently rate-limited.
- External setup: valid backend Gemini key/model entitlement/quota/network; Hangfire storage for metrics. No provider secret belongs in Postman.
- Uploads: repository-relative files are attached automatically by Newman with repository root as working directory. Desktop Postman may require setting that working directory/enabling local file access or selecting these two local fixtures once; no ID editing is needed.
- Safe cleanup deletes unused fixture records; referenced stock/order/history is intentionally retained for inspection. The dedicated C# runner drops its own generated DB only.

Actual files updated (outside Git workspace):

1. `C:\Users\Tak18\OneDrive\Desktop\Test Postman\SmartWMS.Api - v1 - WORKING.postman_collection.json`
2. `C:\Users\Tak18\OneDrive\Desktop\Test Postman\SmartWMS Local.postman_environment.json`

`SmartWMS.Api - v1 - TESTED BASELINE.postman_collection.json` remains unchanged (SHA256 `A2336EB2C2044BE108650219107C69C40FB4A685DF309614860E95CC41267D71`). Review copies and originals are in ignored `obj/F1/postman` and `obj/F1/postman-original` respectively.

Reproduction: run `PrepareMirror.ps1`, build the mirror solution and F1 project, build the six regression projects, then run F1 `--data`, `--http`, `--infra`, and `--regression` modes. `F1_REPO` must be the absolute repository root for HTTP mode. Install Newman6.2.1 under ignored `obj/F1/tools/newman`; the wrapper passes runtime credentials in memory and writes only sanitized statuses/assertion failures. `--results <report> <newman.json>` gates an existing report and returns1 when live assertions failed. `RefreshPostman.py <existing-collection> <existing-environment>` writes refreshed review copies; do not use the refreshed copies as an old-baseline comparison. `Summarize.py` validates baseline/checkpoint/index before writing matrix and sanitized evidence.

## Not release ready / review boundary

Four latest AI happy paths are blocked by external429: executive insight, slotting, scan-invoice, report-damage. No further live retry is made to manufacture a green run. Gemini quota availability must be restored before an all-green release acceptance can be claimed. Earlier successful live calls remain supporting evidence only.

Legacy crossdock remains deferred; B3 wave and serial pick remain unsupported; LPN stays outside scope. Semantic embeddings are generated on create, not automatically regenerated when description changes; current identity projection is safe, but semantic ranking may reflect the previous description until a separate embedding refresh design is approved. AI outputs remain advisory and do not execute stock movements.

## Baseline integrity / diff / commit

25 tracked dirty baseline paths preserve exact status/SHA256/content, including absent generated paths. B4 audit preserves exact untracked status/hash. K1/R1 source and approved checkpoints are unchanged; HEAD still R1. Index empty; no commit or push. F1-only `git diff --check` passes; baseline paths are excluded rather than cleaned. No production migration/schema/package/generated file was added. New verification images are small explicit input fixtures.

The exact backend, verification and documentation manifest is appended below. This report and the route matrix are for review; F1 is not approved for commit by this task.

<!-- F1_MANIFEST -->

**Backend source/config — 23 files**

- `SmartWMS.Api/Controllers/ChatController.cs`
- `SmartWMS.Api/Controllers/DashboardController.cs`
- `SmartWMS.Api/Controllers/ForecastsController.cs`
- `SmartWMS.Api/Controllers/InboundReceiptsController.cs`
- `SmartWMS.Api/Controllers/ProductsController.cs`
- `SmartWMS.Api/Extensions/ResultExtensions.cs`
- `SmartWMS.Api/Middleware/GlobalExceptionHandler.cs`
- `SmartWMS.Api/appsettings.Development.json`
- `SmartWMS.Application/Common/Exceptions/AiDependencyException.cs`
- `SmartWMS.Application/Common/Interfaces/IAiInsightService.cs`
- `SmartWMS.Application/Common/Interfaces/IEmbeddingService.cs`
- `SmartWMS.Application/Common/Models/Configurations/GeminiSettings.cs`
- `SmartWMS.Application/Features/Chat/Queries/GetAiChatResponse/GetAiChatResponseQueryHandler.cs`
- `SmartWMS.Application/Features/Dashboard/DTOs/Queries/DashboardInsightDto.cs`
- `SmartWMS.Application/Features/Dashboard/Queries/GetDashboardInsightQuery/GetDashboardInsightQueryHandler.cs`
- `SmartWMS.Application/Features/Forecasts/Queries/GetStockForecast/GetStockForecastQueryHandler.cs`
- `SmartWMS.Application/Features/InboundReceipts/Commands/ProcessCrossDocking/ProcessCrossDockingCommandHandler.cs`
- `SmartWMS.Application/Features/InventoryManagement/Queries/GetSlottingRecommendations/GetSlottingRecommendationsQueryHandler.cs`
- `SmartWMS.Application/Features/Products/Commands/Create/CreateProductCommandHandler.cs`
- `SmartWMS.Application/Features/Products/Queries/GetSemanticProducts/GetSemanticProductsQueryHandler.cs`
- `SmartWMS.Application/Features/Products/Specifications/Queries/ProductWithEmbeddingSpec.cs`
- `SmartWMS.Infrastructure/Services/GeminiEmbeddingService.cs`
- `SmartWMS.Infrastructure/Services/GeminiInsightService.cs`

**Verification/documentation — 18 files**

- `docs/PHASE_F1.md`
- `docs/PHASE_F1_API_MATRIX.md`
- `verification/AcceptanceF1/AcceptanceEvidence.json`
- `verification/AcceptanceF1/AcceptanceF1.Verification.csproj`
- `verification/AcceptanceF1/AiChecks.cs`
- `verification/AcceptanceF1/DataChecks.cs`
- `verification/AcceptanceF1/FailureHttp.cs`
- `verification/AcceptanceF1/FixtureDatabase.cs`
- `verification/AcceptanceF1/HttpSmoke.cs`
- `verification/AcceptanceF1/InfrastructureChecks.cs`
- `verification/AcceptanceF1/PrepareMirror.ps1`
- `verification/AcceptanceF1/Program.cs`
- `verification/AcceptanceF1/RefreshPostman.py`
- `verification/AcceptanceF1/RegressionSmoke.cs`
- `verification/AcceptanceF1/RunPostman.cjs`
- `verification/AcceptanceF1/Summarize.py`
- `verification/AcceptanceF1/fixtures/damage.png`
- `verification/AcceptanceF1/fixtures/invoice.png`

## Final exhaustive follow-up

The original live89/93 metric and four Gemini429 failures above remain unchanged. Production model defaults are now empty and require explicit configuration; only Development/local settings retain configured preview choices. Both prior HOLD items are resolved. Updated deterministic certification, authorization matrix, limitations and final manifest are in [PHASE_F1_FINAL_VERIFICATION.md](PHASE_F1_FINAL_VERIFICATION.md). The original manifest above records the earlier review checkpoint.
