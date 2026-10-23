# K1 — Kitting hardening

Date: 2026-10-23 (Asia/Saigon). Branch: `main`. Base HEAD: `8cc4df1b9043f2d9a4c34c2f728ea4ae1430fa2d`; B3 implementation ancestor: `24dfe4cb4d0fb4f7c844ea27fde04a863d2954c0`. No commit/staging/push. No R1 work.

## Current semantics found

- Actual route: `POST /api/v1/Kitting/assemble`, `KittingController`, roles Admin/WarehouseManager. Existing MediatR/FluentValidation registration already wires the command; no controller/DI change needed.
- Kit is an ordinary active `Product`. There is no kit flag, stored component definition, BOM, assembly document or manufacturing lifecycle. The request defines the recipe: `KitProductId`, `TargetBinId`, `AssembleQuantity`, and `Components[{ComponentProductId, SourceBinId, QuantityPerKit}]`.
- Component requirement = kit quantity × per-kit quantity, aggregated by source bin/product. The contract has no lot/stock selector. K1 requires one unambiguous Available row in each bin/product scope; it rejects multiple Available lots instead of choosing a row or allocating across lots. Held/damaged rows do not become usable.
- Stock identity remains `(BinId, ProductId, LotNumber, Status)` with stock ID/rowversion. K1 also checks normalized lot identity with the existing DB-collation-aware coordinator. Existing output is the sole compatible Available row; its lot/expiry are retained. When none exists, output is Available with `KIT-yyyyMMdd` (UTC), no expiry, as in the original flow. This is request-defined assembly, not component-to-kit expiry/lot genealogy; no new inheritance policy is claimed.
- Supported product modes are None/Lot. Existing stock lot must be nonblank for Lot; expired stock is rejected. Serial mode or any linked serial evidence and nonempty LPN code, including whitespace evidence, are rejected for selected component/output stock. No LPN/serial lifecycle is added.
- ATP uses `BinInventory.Quantity - ReservedQuantity`; reservation ownership/counters are never consumed or reduced. Unreserved ATP on a component row may be consumed while its reserved balance remains intact. New kit output is not merged into reserved/workflow stock.
- Bin occupancy means sum of physical units, not weight/volume/pallet slots. Source deltas and output deltas aggregate per bin. Same-bin assembly uses the net delta; capacity is validated after component consumption and output addition. Existing occupancy drift is rejected, not repaired. Quantity arithmetic uses long before int bounds checks; occupancy rejects values outside exact integer range of double.
- Existing convention is negative `KITTING_ISSUE`, positive `KITTING_RECEIPT`, via normal DbContext SaveChanges/audit. K1 adds exact BinInventoryId links, actual source/destination codes and one operation correlation in ReasonCode, without schema changes.
- Previous handler selected the first bin/product row, ignored reservation/status/lot/LPN/serial/capacity, and never updated occupancy. UnitOfWork only delegated SaveChanges: write atomicity alone did not protect read/check/concurrency. K1 uses the existing transaction/coordinator mechanisms instead.

## Hardened invariants

- Validate kit/component/bin IDs, active products/hierarchy, nonempty component list, positive kit quantity and positive component multipliers. Reject a kit consuming itself. Validate in handler as well as HTTP validator.
- Aggregate duplicate requirements before stock checks; reject overflow/shortage/non-Available or ambiguous Available identities. Never consume more than ATP, change stock status, strip LPN or allocate serials.
- Lock all participating bins in deterministic Guid order, then their stock ranges, and reload tracked values. Check occupancy equals physical quantity under locks. New-row absence and aggregate capacity are protected, rather than relying only on rowversion.
- Validate the complete plan and projected net occupancy before mutation. Apply deductions/output/occupancy/ledger/audit in one transaction. Retain zero stock rows and their existing FK history.
- Reuse `IInventoryMutationCoordinator` (RepeatableRead transaction, rollback/clear), `IInboundReceiveCoordinator` (active hierarchy/bin locks, physical sum, normalized lot and serial evidence locks), and `IOutboundCoordinator` (stock range locks/reload and conflict classification). No shared production helper was modified.
- DbUpdateConcurrencyException, SQL deadlock/lock timeout and existing inventory unique conflicts map through the established conflict policy to COM_409. Unexpected failures propagate with transaction disposal rollback. No blind business retry or external side effect.

## Retry boundary

The existing request has no idempotency key or persisted assembly operation. K1 does not add a reservation/operation subsystem. Each successful invocation is a new assembly and has one correlated issue/receipt set. Repeating with sufficient ATP can intentionally assemble again. Repeating after depletion/capacity exhaustion rejects without changes. A timeout/lost response is not authorization to blindly resend: reload stock/history and reconcile the operation first. Concurrent duplicate requests compete for ATP/capacity; this is concurrency safety, not request deduplication.

## Exact K1 manifest

Production changes (Kitting scope only):

1. `SmartWMS.Application/Features/Kitting/Commands/AssembleKit/AssembleKitCommandHandler.cs`
2. `SmartWMS.Application/Features/Kitting/Commands/AssembleKit/AssembleKitCommandValidator.cs`

New verification/document files:

3. `verification/KittingK1/KittingK1.Verification.csproj`
4. `verification/KittingK1/Program.cs`
5. `verification/KittingK1/FixtureDatabase.cs`
6. `verification/KittingK1/HttpSmoke.cs`
7. `verification/KittingK1/RegressionSmoke.cs`
8. `verification/KittingK1/PrepareMirror.ps1`
9. `docs/PHASE_K1.md`

No migration, entity, DTO, FE, LPN subsystem, shared production helper or unrelated file is included. `BinInventoryForKittingSpec` remains unused by the hardened handler; no unrelated deletion/cleanup.

## Verification environment and commands

All build output is in ignored `obj/K1/source`, prepared from current production source plus K1 verification. `PrepareMirror.ps1` excludes tracked obj/bin/user files and uses the **committed** PasswordHasher dependency in the mirror. It neither rewrites nor relies on the dirty PasswordHasher baseline. Original source and baseline obj caches are not build targets.

```powershell
& verification/KittingK1/PrepareMirror.ps1
dotnet build obj/K1/source/SmartWMS.slnx --nologo -v minimal -p:NuGetAudit=false
dotnet build obj/K1/source/verification/KittingK1/KittingK1.Verification.csproj --nologo -v minimal -p:NuGetAudit=false
dotnet obj/K1/source/verification/KittingK1/bin/Debug/net10.0/KittingK1.Verification.dll --focused obj/K1/reports/focused
dotnet obj/K1/source/verification/KittingK1/bin/Debug/net10.0/KittingK1.Verification.dll --http obj/K1/reports/http obj/K1/source/SmartWMS.Api/bin/Debug/net10.0/SmartWMS.Api.dll
```

Build the four existing regression projects in the mirror (`Phase4A`, `Phase4B`, `InboundB1`, `OutboundB3`, each `verification/<suite>/<suite>.Verification.csproj`) with the same build options, then:

```powershell
dotnet obj/K1/source/verification/KittingK1/bin/Debug/net10.0/KittingK1.Verification.dll --regression obj/K1/reports/regression obj/K1/source
dotnet obj/K1/source/verification/OutboundB3/bin/Debug/net10.0/OutboundB3.Verification.dll --cached-context obj/K1/reports/regression/OutboundB3-cached-context
git diff --check
```

NuGet vulnerability-feed access was unavailable (NU1900), including an elevated retry. Final builds use cached dependencies and explicit `NuGetAudit=false`; this does not certify dependency vulnerability status. Final solution/K1/regression builds have zero compiler warnings/errors. Initial verification compile error in the post-Save test interceptor was fixed before running the final suite.

SQL LocalDB requires execution outside the sandbox; the sandbox attempt failed to connect. All runtime commands use generated `SmartWMS_K1_Verify_*` databases, plus existing suites' generated fixture names. No shared/business DB is read or written. Each fixture is removed by its ownership-checked cleanup, not by filesystem cleanup.

Phase4A/4B originally read a shared business connection to take preservation snapshots. Only their **mirror copies** replace that constant with a required `K1_REGRESSION_ANCHOR` environment variable. RegressionSmoke supplies a newly migrated empty K1 database as the read-only anchor and verifies its complete snapshot is unchanged. No assertion or production behavior in those suites is changed. Original regression source is untouched. InboundB1/B3 already use isolated fixtures. HTTP hosts disable migration-on-startup, seed, Hangfire server/recurring registration/schema preparation; fixtures explicitly apply the existing 31 migrations first.

## Results

- K1 focused: **127 PASS** on SQL Server LocalDB.
- K1 actual HTTP: **15 PASS**, including authenticated happy path, anonymous 401, explicit LPN rejection, capacity rejection, invalid quantity and null component binding/validation; complete snapshots unchanged on rejection.
- Phase4A: **95 PASS**; Phase4B: **107 PASS**; Inbound B1 focused/HTTP: **142 PASS**.
- Outbound B3 schema: **24 PASS**; focused **161 PASS** plus cached-context **5 PASS** = checkpoint **166 PASS**; HTTP **46 PASS**.
- Isolated regression runner: **7 PASS** (six suite invocations and unchanged reference fixture snapshot); each suite's checks are listed separately above, not added twice.
- Final solution, K1 and four regression project builds: **PASS, 0 warnings/errors** with explicit NuGetAudit=false as explained above.

Focused coverage includes multiplier/multiple components, duplicate aggregate shortage, ATP preservation, exact consumption to zero, None/Lot, status/identity/expiry/hierarchy guards, component/output LPN/serial evidence, output reservation/overflow/ambiguity, source/destination/same-bin occupancy, capacity boundary/overflow, ledger links/sign/correlation/audit, stale context reload, post-SQL rollback, Kitting/Kitting and Kitting/outbound ATP races, absent output row/capacity race, actual SQL1222 and no hidden retry.

Rollback proof uses test-only EF SaveChangesInterceptor faults **after SQL SaveChanges completes but before commit**: both concurrency and unexpected failures leave full DB snapshots (stock, output, occupancy, ledger, audit, rowversion, schema) identical; failed contexts have no tracked entries. No production fault-injection hook exists. An initially overbroad final fixture invariant assertion included the deliberately drifted rejection fixture; the test now restores that deliberately injected test drift only after its unchanged-on-rejection snapshot has been proven. The final suite then verifies all fixture bins again.

## Scope/baseline integrity

Preflight snapshots and SHA256 records are saved in ignored `obj/K1/status-before.txt` and `obj/K1/baseline.json`: exactly 25 preexisting tracked dirty paths plus the preexisting untracked B4 audit. These paths are outside the K1 manifest. Final comparison confirms both status and content/absence match, including preservation of B4. `git diff --check` passes; unexpected paths: none. No reset/checkout/restore/stash, formatting pass or baseline rewrite is used.

Stop after K1 report for review. No commit, stage, push, R1, manufacturing/BOM expansion or LPN implementation.
