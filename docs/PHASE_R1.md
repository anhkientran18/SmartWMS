# R1 — Auto-Replenishment hardening

Date: 2026-10-23 (Asia/Saigon). Branch `main`, base HEAD `d4add410edcc80b2fc87a7f678a18df0e66ccb3c` (approved K1). B3 ancestors: source `24dfe4cb4d0fb4f7c844ea27fde04a863d2954c0`, docs `8cc4df1b9043f2d9a4c34c2f728ea4ae1430fa2d`.

Scope: harden existing quantity movement. No migration, new table/entity, task/planning engine, distributed lock infrastructure, LPN lifecycle, serial lifecycle, FE change or commit. K1 files and preexisting B4 audit remain outside R1.

## Current implementation semantics found before R1

| Concern | Existing behavior |
|---|---|
| Actual route | `POST /api/v1/Inventory/run-auto-replenish`, no body/parameters; `InventoryController.RunAutoReplenish` sends `AutoReplenishCommand`, `Result<int>` |
| Authorization | Controller `[Authorize]`, any authenticated principal; no additional role policy. Preserved, tested with real Admin and Staff authentication |
| Validator | None; command has no input fields to validate |
| Target | Existing positive-quantity row in a bin with MaxCapacity > 0 and occupancy <= 20% of capacity; no status/hierarchy/tracking guard |
| Needed | `(int)Math.Floor(MaxCapacity - CurrentOccupancy)`, fill free physical units; no forecast/demand planner |
| Source | Other bin, same ProductId and literal LotNumber, Available, physical Quantity > needed; unordered FirstOrDefault |
| Geographic scope | No warehouse/zone restriction in old query, despite no explicit cross-warehouse contract |
| Destination identity | Already-existing target row; no new-row creation, no empty-bin/zero-row replenishment. Target status was unchecked |
| Lot/expiry | Lot predicate only; no expiry equality/expiration check. Different expiry could silently merge |
| Reservations | Physical Quantity used instead of ATP; ReservedQuantity/ownership ignored |
| Occupancy | Source -= needed, target += needed; stale candidate list could use a bin multiple times without rechecking threshold/projected capacity |
| Ledger | One TRANSFER with positive moved quantity, source/destination codes, ReasonCode=AUTO_REPLENISHMENT; no stock IDs/lot snapshot/correlation |
| Atomicity | One SaveChanges after loop; normal DbContext audit. No transaction covering reads/checks, no lock/reload/conflict mapping |
| Count | One invocation could move many rows; returned int counts movements, not persisted replenishment tasks |
| Callers | Repository-wide case-insensitive search found only HTTP calling this command. Existing scheduled InventoryJobService locks expiry; AIAgentJobService drafts inbound receipts and does not call AutoReplenish. Neither is a replenishment movement caller; unchanged |
| Overlap/retry | Multiple HTTP invocations or a future background caller could overlap; no operation key or persisted idempotency record |

BinInventory physical Quantity and ReservedQuantity are int; ATP = Quantity - ReservedQuantity. Schema stock identity is `(BinId, ProductId, LotNumber, Status)`, with Id/FKs and rowversion; LpnCode/expiry are additional compatibility metadata. Bin occupancy/capacity are doubles representing physical unit counts. ProductTrackingMode is None/Lot/Serial; serial evidence also exists through ProductSerialNumber.BinInventoryId. Bin/stock rowversions, quantity/reservation/bin-bound checks and Restrict FKs already exist. UnitOfWork delegates SaveChanges; DbContext SaveChanges generates audit entries. Existing mutation/inbound/outbound coordinators provide transaction, bin/row/range locks, reload and SQL conflict classification.

## Final scoped behavior

### Selection, metadata and skip contract

- Preserve the 20% target threshold, positive existing target row and full-needed-from-one-source semantics. `floor(free capacity)` is retained. No implicit partial move, source splitting or new destination row. Source ATP **equal** to required is allowed.
- Scope to active Storage bins/hierarchy, active None/Lot products, Available rows only, no LPN/serial evidence, not expired. Source/destination must be distinct and in the **same warehouse**; different zones within that warehouse remain allowed. Staging bins are excluded because no staging-workflow replenishment contract exists.
- Match normalized lot with the existing DB-collation-aware policy, require exactly one Available row for that normalized Bin/Product/Lot identity, and require nullable expiry equality. Never choose a row from a different lot/status, rewrite lot/expiry, revive held stock, strip LPN or reassign serials.
- Invalid/ambiguous/unsupported/shortage/capacity candidates are skipped; independent valid candidates may still be planned. The HTTP contract remains success with count 0 when no safe movement exists, rather than adding a new per-candidate error API. No ledger/audit writes for skip-only runs.
- Component-like reservation ownership is not introduced. Source ATP may move while its reserved balance remains unchanged. Destination rows with reserved quantity or active workflow are skipped to avoid merging into outbound-owned stock.
- Target order: BinId, ProductId, normalized lot ordinal, row Id. Source order: BinId, row Id. Compatible sources are tried in that stable order; no FEFO policy or quantity ranking is invented.

### Explicit anti-reversal safety guard

The old model has no pick-face/bulk role fields. A donor can become another low target after a fill, causing immediate reverse movement on a repeat invocation. R1 therefore **skips a move if projected donor occupancy is <=20% and it would leave a positive unreserved Available row in that bin**. This applies the existing low-stock threshold as a conservative donor safety condition; it is a deliberate selection-policy tightening, not an inherited old rule.

Empty donors and reserved-only remainders still pass the exact-ATP case because they cannot become eligible targets. Other positive Available unreserved rows in that donor conservatively block the move even if another metadata guard would later exclude them. R1 does not create persistent bin roles or infer them from historical ledger. This can skip a move that the old handler would make; it is preferable to moving stock back and forth between indistinguishable locations. The decision and examples are covered by focused verification.

Within a run, a recipient bin never donates, and a donor bin never becomes a target. Shared sources may serve multiple targets using decreasing projected ATP; incoming units are never re-exported. Thus a physical unit moves at most once per invocation.

### Projected occupancy and capacity

- Reconcile each participating bin's occupancy against its locked physical sum before admitting it to the plan; invalid/drifted bins are skipped, never silently repaired.
- Physical sums must remain within the exact integer range of double. Quantity calculations are checked in long/double before int conversion; no unchecked int wrap/clamp.
- Build a complete projected-quantity/occupancy plan before tracked mutations. Each subsequent candidate uses projections after earlier planned movements. One full refill fills a bin, so later product rows in that bin skip rather than oversubscribe capacity.
- Same-bin movement is excluded. Source loses exactly moved units, target gains exactly those units; total physical quantity and aggregate occupancy are conserved. Equality with capacity succeeds; a candidate exceeding bounds is skipped.

## Concurrency and state-based repeat safety

1. Discovery uses AsNoTracking outside the mutation transaction. It records a bounded set of target IDs and possible source-bin IDs, never authoritative quantities/capacity. Newly eligible targets outside that list wait until another invocation.
2. Begin the existing **RepeatableRead** mutation transaction. Lock participating active bins in deterministic Guid order with existing UPDLOCK/HOLDLOCK hierarchy protection. Lock/read stock ranges and explicitly reload tracked values. Physical sums, product metadata, serial evidence, normalized identity and destination workflow are checked within the transaction.
3. Re-evaluate current target quantity, threshold, projected occupancy, source ATP/status/lot/expiry and warehouse under those locks. A contender with an old discovery list must see the already-filled target and produce zero movements (or clean conflict), not another refill.
4. Track planned deltas separately, with no tracked stock/occupancy mutation until validation ends. Apply all movements and ledger entries once, use normal DbContext SaveChanges/audit, then commit once.
5. Reuse existing stock/bin rowversions as a second protection. DbUpdateConcurrencyException, SQL deadlock/lock timeout/command timeout and existing inventory unique conflicts use the established coordinator conflict policy. COM_409 rolls back the whole batch; no automatic business replay.

No distributed lock or idempotency table is needed. Locks cover all candidate-product source bins and their stock ranges, so this is intentionally coarser than one-row locking; it protects aggregate capacity and overlap without a new subsystem. No production load/performance certification is claimed.

This is state-based repeat safety, not an immutable exactly-once request key. A run against unchanged post-success state produces no duplicate ledger. Legitimate later stock consumption can make a target eligible again and produce a new operation. After an uncertain response, read inventory/history before deciding whether to invoke again; do not blindly replay stale assumptions. There is no new scheduled caller in R1, but the handler is tested under simultaneous background-style/manual executions.

## Ledger and batch atomicity

Each successful movement produces one `TRANSFER` ledger with **positive moved quantity** (existing transfer convention), ProductId, source/destination BinInventoryId, actual location codes and `AUTO_REPLENISHMENT:<operation-guid>:LOT:<source-original-lot>` in ReasonCode. All movements in the invocation share the operation GUID. Lot fields on stock are preserved, including canonical spelling/whitespace already present; normalized matching does not rewrite them. Existing history readers do not compare the old ReasonCode by equality, verified by repository search.

One transaction covers source deductions, target additions, occupancy, all movement ledger entries and audit. Skip-only runs commit read locks without SaveChanges. Any conflict or unexpected failure after tracked mutation/SQL Save but before commit rolls back the entire planned batch, clears failed tracked state through transaction disposal/rollback and leaves no movement ledger/audit. No external side effect occurs before or after commit in this handler.

## Exact R1 manifest

Production change:

1. `SmartWMS.Application/Features/InventoryManagement/Commands/AutoReplenish/AutoReplenishCommandHandler.cs`

New verification/document files:

2. `verification/ReplenishmentR1/ReplenishmentR1.Verification.csproj`
3. `verification/ReplenishmentR1/Program.cs`
4. `verification/ReplenishmentR1/FixtureDatabase.cs`
5. `verification/ReplenishmentR1/HttpSmoke.cs`
6. `verification/ReplenishmentR1/RegressionSmoke.cs`
7. `verification/ReplenishmentR1/PrepareMirror.ps1`
8. `docs/PHASE_R1.md`

No controller/command contract/validator/DI change was needed. All shared production helpers are reused **without modification**. K1 source, verification and document files are unchanged from their approved commit. No schema/package/generated file is part of R1.

## Verification commands and isolation

```powershell
& verification/ReplenishmentR1/PrepareMirror.ps1
dotnet build obj/R1/source/SmartWMS.slnx --nologo -v minimal -p:NuGetAudit=false
dotnet build obj/R1/source/verification/ReplenishmentR1/ReplenishmentR1.Verification.csproj --nologo -v minimal -p:NuGetAudit=false
dotnet obj/R1/source/verification/ReplenishmentR1/bin/Debug/net10.0/ReplenishmentR1.Verification.dll --focused obj/R1/reports/focused
dotnet obj/R1/source/verification/ReplenishmentR1/bin/Debug/net10.0/ReplenishmentR1.Verification.dll --http obj/R1/reports/http obj/R1/source/SmartWMS.Api/bin/Debug/net10.0/SmartWMS.Api.dll
```

Build existing `verification/<suite>/<suite>.Verification.csproj` in the mirror for Phase4A, Phase4B, InboundB1, OutboundB3 and KittingK1, with the same build options, then:

```powershell
dotnet obj/R1/source/verification/ReplenishmentR1/bin/Debug/net10.0/ReplenishmentR1.Verification.dll --regression obj/R1/reports/regression obj/R1/source
git diff --check
```

- Build targets are the ignored `obj/R1/source` mirror, excluding original obj/bin/user files. The dirty PasswordHasher is neither rewritten nor relied upon: the mirror uses its committed HEAD version. Original baseline caches are never build outputs.
- Use cached dependencies with explicit NuGetAudit=false because vulnerability-feed access was unavailable in the preceding K1 session. This flag is limited to build commands; no package/project change or vulnerability-status certification.
- SQL executions require access outside the sandbox, as established in K1. All R1 DB creation/mutations/cleanup use generated `SmartWMS_R1_Verify_*` names with ownership guards. HTTP seed/migrations/Hangfire server/recurring registration/schema preparation are disabled at startup. The fixtures explicitly execute the existing 31 migrations.
- Only mirror copies of legacy Phase4A/4B replace their read-only shared-DB snapshot connection with a required R1_REGRESSION_ANCHOR environment variable. The runner supplies an empty migrated R1 fixture and checks its full snapshot remains unchanged. No original test assertion or production behavior is changed; original regression files remain untouched.
- Focused scenarios retire previous generated fixture bins only after each scenario's invariants/snapshot assertions; no shared data or baseline is touched. Deliberate drift is restored in the test fixture only after unchanged-on-skip is proven. Initial cross-warehouse fixture setup needed explicit registration of its new Zone graph; that test setup was corrected before the final successful run.

## Verification results

- Focused SQL: **136 PASS**.
- Actual HTTP: **26 PASS**, including anonymous 401, actual Admin/Staff authentication, one successful fill, repeat=0, insufficient ATP, source/destination LPN and Serial skip=0, with complete unchanged snapshots on skipped mutations.
- Inventory Phase4A **95 PASS**, Phase4B **107 PASS**; Inbound B1 focused/HTTP **142 PASS**.
- B3 schema **24 PASS**, focused **161 + 5 cached-context = 166 PASS**, HTTP **46 PASS**.
- K1 focused **127 PASS**, HTTP **15 PASS**; no K1 source or verification changes.
- Regression runner **10 PASS**: nine successful suite invocations plus unchanged isolated reference DB snapshot; these wrapper checks are not added twice to suite counts.
- Final solution/R1/regression builds: PASS, 0 warnings/errors with explicit NuGetAudit=false.

Focused checks cover exact ATP including reserved remainder, no partial/zero movement, low-threshold boundary, no empty destination creation, donor anti-reversal, status/identity/warehouse/hierarchy/expiry/LPN/serial/drift/overflow guards, nullable expiry, normalized/ambiguous lot, correct selection among multiple lots/statuses/sources, cross-zone same-warehouse movement, None mode, invalid candidate alongside valid movement, multi-target shared-source projections, multi-product target capacity, correlation/sign/ledger/audit, stale context, rollback, real SQL1222, overlap and outbound allocation race.

Rollback proof uses test-only SaveChangesInterceptor failures **after SQL writes and before commit**, for a two-movement batch. Both concurrency and unexpected failures restore a complete DB snapshot, including source/target/occupancy/ledger/audit/rowversion/schema; the failed context is cleared. No production fault hook is added.

Concurrency proof deliberately pauses an execution at SaveChanges while it holds locks, starts a second execution with the old discovery list, observes its lock attempt and releases the first: one refill/one ledger in total, contender returns 0. A second test gives two targets only one exact source: only one movement across two executions. An outbound allocation test pauses allocation before SQL Save, starts replenishment, then proves the newly committed reserved=95 leaves insufficient ATP on physical=100 and no transfer occurs. Destination **creation** race is not applicable because this contract never creates rows; destination update/capacity races and missing/zero-target no-create behavior are tested.

## Baseline integrity / stop point

Preflight saved `obj/R1/status-before.txt` and SHA256/status records in `obj/R1/baseline.json`: exactly 25 tracked dirty baseline paths plus the preexisting untracked `docs/PHASE_B4_LPN_AUDIT.md`. These are excluded from the R1 manifest. No reset/restore/checkout/stash/stage/format or baseline rewrite is used. Final comparison verifies the original statuses and contents/absence and verifies K1 paths still match `d4add410edcc80b2fc87a7f678a18df0e66ccb3c`.

R1 remains unstaged/uncommitted for review. Stop after the R1 report; no push, commit or next phase.
