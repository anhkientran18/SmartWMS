# H2 — final core hardening

Result: **PASS**. Backend core: **CLOSED** for the supported demo/WebApp scope.
Base: main at S1 `539dc542314a46207cd98313e89d04165ebed9a5`. H2 is uncommitted.
No live Gemini, FE, migration/schema, production package/configuration, or external Postman changes.
S1's documented unresolved product/deployment policy remains unchanged.

## Final contracts

- **GET /api/v1/CycleCounting/assignees**: Admin/WM200; Staff403; anonymous401. Standard Result with an array of active Staff, each exactly `{id,username,fullName}`, ordered by username then ID. Empty array is valid. No security fields, user-management permission or warehouse ACL is added. WM selects an ID here and submits it in create-sheet's existing requestData wrapper. Assignment remains optional; Staff ownership and AM override are unchanged.
- **POST /api/v1/InventoryTransfers**: source and destination must share a warehouse through Bin → Zone → Warehouse. Different zones within that warehouse remain supported. Cross-warehouse rejects400 `VAL_1000` before quantity/occupancy/ledger/audit writes. The guard projects the current hierarchy from SQL under the existing transaction, independently of stale tracked Bin.ZoneId. Staff execution remains allowed; this is not inter-warehouse transfer.
- **GET Products, Products/list, Products/{id}**: all map persisted Barcode and Weight. Supported-field detail/edit/PUT no longer invents an empty barcode. Weight is the stored gram value, including0 when unset; it is not substituted with the packing fallback. Product create/update still cannot edit weight or persist dimensions. Weight advice requires a nonempty legacy orderId through its validator, although its advisory handler does not load the order; its existing formula uses stored positive weight or250g, plus150g packaging.
- **POST /api/v1/Products**: core validation/duplicate behavior is retained. Embedding is best-effort with the existing bounded provider call before save. Known AI dependency/configuration, HTTP, timeout and non-caller cancellation failures do not prevent otherwise-valid core persistence. A vector is stored only if it is real,768-dimensional, finite and nonzero; otherwise the nullable field remains null and the successful core-create message discloses unavailable embedding. Caller cancellation and unexpected programming/storage exceptions are not swallowed by this handler. No vector, stock, AI-success result, job or queue is fabricated.

## Embedding lifecycle review

The nullable embedding column already exists. Semantic registry discovery excludes null/empty vectors, so degraded products can safely remain outside semantic results. Create continues invalidating the registry only after a successful save. Existing semantic rehydration rejects deleted identities and returns current metadata; update still does not regenerate stale description vectors. No cache/read-time regeneration or eventual-completion guarantee was added. Existing explicitly enabled startup seed/backfill can populate missing vectors when its provider works; startup/deployment policy is unchanged. Best-effort creation can still wait for the existing bounded call/retry policy; this is not asynchronous enrichment.

Decision: **safely decoupled**, no larger AI lifecycle design required for core Product creation.

## Verification

All runtime checks used owned LocalDB fixtures and explicit loopback providers or in-process doubles. Production API and H2 verifier builds: **0 warnings / 0 errors**. Test outputs are under ignored obj/H2; [structured evidence](../verification/CoreHardeningH2/VerificationEvidence.json) records the exact manifest/source hashes.

| Suite | Passed |
|---|---:|
| H2 focused HTTP/SQL/enrichment boundaries | 253/253 |
| S1 authorization/execution, including97-route invalid JWT checks | 591/591 |
| S1 cached ownership checks | 24/24 |
| F1 relevant AI/deep-data | 51/51 |
| F1 data | 20/20 |
| Phase4A | 95 |
| Phase4B | 107 |
| Inbound B1 | 142 |
| B3 schema / focused / cached-context / HTTP | 24 / 161 / 5 / 46 |
| K1 focused / HTTP | 127 / 15 |
| R1 focused / HTTP | 136 / 26 |
| ReleaseHardening / DeleteRace | 65 / 31 |
| B2 summary / existing migrations | 15 / 25 |

The11-suite baseline subtotal is884; with Release/DeleteRace/B2 the full regression subtotal is1020. Regression orchestration adds12 checks including the isolated read-only anchor. No historical F1 exhaustive1247 or live89/93 metric is relabeled as rerun H2 evidence.

The ignored mirror carries forward reviewed S1 adapters: an owned anchor for legacy business-DB snapshots; Phase4B's actor constructor; R1 Staff403 replacing its superseded Staff200 assertion. S1's route-inventory input points to H2's97 routes. Repository historical verification/evidence files remain byte-for-byte unchanged. No H2 business assertion was removed.

Focused cases include AM/Staff/anonymous lookup, exact DTO fields and active-Staff filtering, WM lookup-to-assignment flow, preserved own/other/null/override semantics, same-warehouse Staff success, three-role cross-warehouse no-mutation and stale-context rejection, barcode/weight projections and edit roundtrip, persisted versus default weight, real/null/malformed vectors, configuration/network/timeout/circuit failures, duplicate/validation rejection, cache invalidation, semantic omission/current metadata/deleted identity, and handler caller cancellation/unexpected error propagation.

Reproduction from the repository root:

```powershell
python verification/CoreHardeningH2/PrepareMirror.py
dotnet build obj/H2/source/SmartWMS.Api/SmartWMS.Api.csproj -p:NuGetAudit=false
dotnet build obj/H2/source/verification/CoreHardeningH2/CoreHardeningH2.Verification.csproj -p:NuGetAudit=false
python verification/CoreHardeningH2/RunRegression.py --with-focused
python verification/CoreHardeningH2/Audit.py
```

Build only the ignored mirror. RunRegression's --resume is only for unchanged-source orchestration/report recovery; do not use it to reuse results after a production change.

## Routes and handoff

Controller actions: **96 → 97**, adding only CycleCounting/assignees. Source catalogue, runtime OpenAPI and the amended [FE handoff](FE_API_HANDOFF.md) match exactly. Historical checkpoint counts retain their original scope.

Handoff edits are limited to the new lookup and picker flow, transfer warehouse invariant/rejection, persisted barcode/weight and legacy weight-validator truth, core-create best-effort enrichment, related readiness/retry guidance, and H2 evidence. Deferred capabilities and existing role policies remain unchanged.

## Exact Postman delta required — not applied

The external S1 WORKING collection remains176 requests with its validated baseline assertions intact. WORKING/environment/TESTED BASELINE hashes were captured before implementation and remain unchanged. Do not replace its S1 role/ownership/B3/K1/R1 cases.

| Existing/new request | Required targeted delta |
|---|---|
| ADD `H2 Admin assignees` / `H2 WM assignees` — GET /api/v1/CycleCounting/assignees | Correct role token;200/isSuccess/array; row keys exactly id/username/fullName. Compare IDs against the known active-Staff fixture set, excluding inactive Staff/Admin/WM. WM captures the assigned Staff ID by username for the existing create-sheet cases. |
| ADD `H2 Staff assignees403` / `H2 anonymous assignees401` — same GET |403/401 respectively; no directory data returned. Keep WM Users/list403; do not widen user-management tests. |
| Existing `S1 resolve configured or fixture actor IDs` | Keep its Admin fixture-directory purpose; use the new WM lookup for the count assignee-picker proof. No rewrite of role login/bootstrap or ownership cases. |
| Existing POST /api/v1/InventoryTransfers | Keep Staff same-warehouse success. Add a separate valid foreign warehouse/zone/bin fixture and `H2 cross-warehouse transfer400`; valid product/lot/positive quantity, expected400/VAL_1000. Compare source/destination contents, occupancy and history before/after; SQL H2 evidence proves audit/ledger no-mutation and stale-context safety. |
| Existing GET /api/v1/Products; GET /api/v1/Products/list; GET /api/v1/Products/{{productId}} | Assert fixture barcode equals persisted input across all three reads. Assert actual stored weight:0 for API-created fixtures; nonzero expectations require an existing authoritative fixture, not unsupported create/update fields or packing fallback250. |
| Existing PUT /api/v1/Products/{{productId}} | Populate supported barcode from detail, edit a supported field, then GET/assert barcode preserved and weight unchanged. Keep unsupported width/height/depth absent. |
| Existing POST /api/v1/Products in component/kit/unused setup | Core creation200/Guid remains correct. Remove any description/expectation that embedding outage must reject core creation; do not weaken unrelated strict live-provider assertions. |
| ADD controlled `H2 Product create provider unavailable` — POST /api/v1/Products | On an explicit unavailable provider fixture:200/isSuccess/Guid, then GET proves product/barcode persisted. No AI-success assertion. SQL supplement proves null vector; after provider restoration semantic search must omit that product. The public Product DTO does not expose embedding state, so HTTP200 alone cannot prove vector persistence or absence. |
| Existing validate-weight cases | Keep current nonempty orderId and Staff-positive valid/invalid advice cases. Product reads expose actual weight; do not infer an editable weight field. |

Keep authorization, deterministic dependency and optional live-provider cases separate. Live Gemini is not required to close H2. Do not silently turn old AI failures into live success.

## Preservation and next step

Baseline25 paths retain status/hash/content; B4 unchanged; historical K1/R1/F1/S1 sources and frozen evidence unchanged; index empty. No stage, commit, push, cleanup/reset/restore/stash, FE change or deferred subsystem work.

Next step: **SYNC POSTMAN FINAL DELTA**.
