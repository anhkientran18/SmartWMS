"""Summarize deterministic certification without changing original live/regression evidence."""
import hashlib, json, pathlib, re, subprocess
root=pathlib.Path(__file__).resolve().parents[2]
out=root/'obj/F1/exhaustive'
preserved=json.loads((out/'preserved-evidence.json').read_text())
for p,h in preserved.items():
    assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h, 'Original evidence changed: '+p
baseline=json.loads((root/'obj/F1/baseline.json').read_text(encoding='utf-8-sig'))
status={x[3:]:x[:2] for x in subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=all'],cwd=root).decode().splitlines()}
for row in baseline:
    p=root/row['Path']; h=hashlib.sha256(p.read_bytes()).hexdigest().upper() if p.exists() else 'ABSENT'
    assert h==row['Hash'] and status[row['Path']]==row['Status'],row['Path']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()=='54695729aadbe7753671e0eee00cf4e80734af21'
assert subprocess.check_output(['git','branch','--show-current'],cwd=root).decode().strip()=='main'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).strip()
for p in ['SmartWMS.Application/Features/Kitting','verification/KittingK1','docs/PHASE_K1.md','SmartWMS.Application/Features/InventoryManagement/Commands/AutoReplenish','verification/ReplenishmentR1','docs/PHASE_R1.md']:
    assert not subprocess.check_output(['git','diff','--name-only','HEAD','--',p],cwd=root).strip()
def checks(folder):
    lines=(out/folder/'results.txt').read_text().splitlines()
    return {'passed':sum(x.startswith('PASS:') for x in lines),'total':len(lines),'failures':[x for x in lines if x.startswith('FAIL:')]}
http=checks('certified-http');deep=checks('deep-data');infra=checks('infra-complete');reg=checks('regression')
newman=json.loads((out/'certified-http/newman.json').read_text())
boundary=json.loads((out/'certified-http/exhaustive/boundary-matrix.json').read_text())
authorization=json.loads((out/'certified-http/exhaustive/authorization-matrix.json').read_text())
assert all(x['passed']==x['total'] for x in [http,deep,infra,reg])
assert newman['stats']['assertions']['failed']==0 and all(x['status']==x['expected'] for x in boundary)
def normalized(text):
    text=re.sub(r'[a-f0-9]{8}-[a-f0-9-]{27}', '{id}',text,flags=re.I)
    return re.sub(r'(?<=sku=)[^&]+','{sku}',text)
matrix={}
for row in authorization:matrix.setdefault(normalized(row['endpoint']),{}).setdefault(row['role'],set()).add(row['status'])
matrix={p:{r:sorted(v) for r,v in roles.items()} for p,roles in sorted(matrix.items())}
expected=[x for x in newman['records'] if x['status'] in [400,409]]
result={'F1_RESULT':'PARTIAL','liveFinalHappy200':89,'liveFinalDenominator':93,'preservedLiveFailures':4,'liveCallsThisCertification':0,
    'deterministic':{'http':http,'deepData':deep,'infrastructure':infra,'newmanAssertions':newman['stats']['assertions'],
        'passed':http['passed']+deep['passed']+infra['passed']+newman['stats']['assertions']['total'],
        'total':http['total']+deep['total']+infra['total']+newman['stats']['assertions']['total']},
    'boundaryScenarios':len(boundary),'boundaryScenariosPassed':sum(x['status']==x['expected'] for x in boundary),
    'newmanRequests':len(newman['records']),'expectedHttpRejections':len(expected),'authorizationMatrix':matrix,
    'regressionChecks':884,'regressionHarness':reg,'originalEvidenceSha256':preserved,
    'baselineTrackedPathsUnchanged':25,'B4Unchanged':True,'K1R1Unchanged':True,'indexEmpty':True,
    'backendLimitations':['Kitting and transfer are not request-ID idempotent; successful resubmission is another command.',
        'Image guards validate signature headers, not complete image decoding.',
        'Semantic registry is single-DB and not tenant/database namespaced; description embeddings can be stale.'],
    'changesAfterReview':['No universal model fallback; Development models explicit; missing model503 except executive fallback.',
        'Reject duplicate slotting SKU recommendations; deduplicate semantic result product IDs.',
        'Existing Postman descriptions explicitly document LPN/Wave/Serial/Crossdock limits.']}
(root/'verification/AcceptanceF1/FinalVerificationEvidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
doc=f'''# F1 FINAL EXHAUSTIVE VERIFICATION

**F1 RESULT remains PARTIAL — external provider quota/rate limit. Final live metric remains89/93; four Gemini429 failures are preserved byte-for-byte. No live Gemini calls were made in this certification.**

## Deterministic backend

{result['deterministic']['passed']}/{result['deterministic']['total']} checks/assertions passed: HTTP/provider/auth/upload/SQL {http['passed']}/{http['total']}; deep SQL {deep['passed']}/{deep['total']}; infrastructure {infra['passed']}/{infra['total']}; Newman assertions {newman['stats']['assertions']['total']}/{newman['stats']['assertions']['total']}. Regression is counted separately. These are assertion counts, not a claim that all raw responses are200.

All8 capabilities (Chat, Forecast, Executive, Slotting, Semantic, OCR, Damage, product Embedding) have controlled success, provider400/401/403/404/429/500/503, timeout, circuit-open, invalid JSON, empty response, and business-invalid output coverage. Boundary matrix: {len(boundary)}/{len(boundary)} scenarios, plus missing-model and configured invalid-model404. Embedding/semantic empty-text cases use an empty vector, since embedding has no text field. Provider500/503 use fresh real production policy instances per capability; four attempts (initial+3 retries) are asserted. These retries target loopback fixtures only, never live Gemini.

Provider errors map502; timeout504; open circuit503/AI_PROVIDER_UNAVAILABLE; missing model503/AI_CONFIGURATION_MISSING. Structured invalid responses502/AI_RESPONSE_INVALID. Executive alone keeps HTTP200 with core KPI, empty summary, aiAvailable=false and aiErrorCode=AI_UNAVAILABLE. Core SQL product/bin/occupancy values are compared on success/failure. Caller cancellation propagates, and full SQL snapshots remain unchanged by failures. Embedding success creates exactly one catalog row plus audit, a768 vector and no inventory row.

## Model safety and HOLD resolution

GeminiSettings DefaultModel, ProModel and EmbeddingModel defaults are empty. Production requires explicit valid model configuration; it never silently selects a preview model. Development JSON explicitly retains its local text/vision and embedding choices. Production-mode test hosts provide their own explicit JWT/model/connection settings; none is written into production config. Missing-model tests assert zero provider calls. No key or secret storage change, migration, package dependency, authorization policy or startup/DI redesign was made.

The existing WORKING collection now explicitly labels LPN Unsupported/Deferred, legacy B3 Wave/Serial unsupported, Crossdock Deferred/Partial, and K1/R1/B3 verified scopes. Crossdock no-demand200 is advisory only; pending B3 demand409 and legacy Wave/Serial409 are documented expected rejections. Request count/tree/body/assertions are unchanged by this description-only update.

## Deep correctness

Forecast uses active (not soft-deleted) SKU and authoritative90-day outbound data. Tests include OUTBOUND/WAVE_OUTBOUND/OUTBOUND_SERIAL, same-date aggregation, positive/non-outbound/transfer/old/future exclusions, missing/inactive/no-history SKU, wrong SKU, duplicate dates, negative quantity, past/today/out-of-horizon dates and malformed output. SQL long SUM3b rejects DTO overflow before provider; int.MaxValue is accepted. Fixture total23 spans2 days, including duplicate-date total17.

Slotting fixture includes outside-only and mixed-location products, outside/old/future history, inactive product/bin/zone, foreign-warehouse and inactive suggested zones, hallucinated SKU, invalid velocity and duplicate recommendations. Scoped prompt contains only one eligible SKU with demand9 and the requested current zone. Duplicate recommendations are now rejected. No stock mutation occurs.

Semantic tests use a deliberately stale/duplicated registry: deleted cached product removed, duplicate IDs deduplicated, current name/SKU/description rehydrated, no-match result accepted, and deleted rows excluded on cache rebuild. Existing description vectors are not regenerated on update, so ranking can reflect old description. Registry key remains SmartWMS_Product_Embeddings_Registry, without tenant/database namespacing; deployment remains single DB per host.

## Upload/security

Both routes test valid PNG/JPEG/WebP and uppercase extension; empty, >5 MiB, wrong effective extension, MIME mismatch, fake signatures, ../ traversal, backslash traversal and .png.exe rejection. Valid/rejected input and provider failure cases preserve SQL state. No client image filename becomes a file in the host working directory or parent. No key/raw provider output is returned. Signature checking is not full image decoding; no broader claim is made.

## Business and concurrency

Actual HTTP/Newman workflows create fixtures through APIs and verify inbound receipt quantities/status, transfer, cycle count, K1, R1 and B3. SQL source120+1-1-4-9-3=104; destination1+9=10; kit output2. Physical/reserved/occupancy/lot/expiry/ledger/audit invariants are checked. Pick deducts once; Pack/Ship do not deduct. Duplicate receive/pick reject409; R1 repeat0; cycle double-confirm409 with unchanged snapshot. Authorization mutations additionally prove +1/-1 adjustment and QCHold/Available transitions: two ADJUSTMENT and two zero-quantity STATUS_CHANGE ledgers per role, with new audits and Completed zero-variance sheet.

Kitting and transfer have no request-idempotency key: a successful retry can be another valid movement/assembly. Atomicity/ATP/concurrency protection does not imply network exactly-once. Do not blindly retry an acknowledged or uncertain successful command; this limitation is not redesigned in F1.

Mandatory regression re-runs include existing Kitting-vs-Kitting, R1-vs-R1, R1-vs-outbound reservation, inbound concurrent capacity, cycle stale/double-confirm and B3 double-submit races, plus post-SQL/lock-timeout rollback snapshots. No duplicate parallel race suite was added. Results: Phase4A95, Phase4B107, B1142, B3 schema24/focused161/cached5/HTTP46, K1 focused127/HTTP15, R1 focused136/HTTP26 =884/884, plus12/12 harness/anchor checks.

## Authorization — current behavior, unchanged policy

401 means authentication stopped request;403 means role restriction.200/409 in confirm cells means successful first confirmation plus expected replay rejection. Hangfire is local-filter protected, not JWT-role protected. Direct current Hangfire filter tests reject an external remote IP and permit loopback; proxy deployments still require a security decision.

| Endpoint | Admin | WM | Staff | Anonymous | Malformed | Expired |
|---|---|---|---|---|---|---|
'''
for endpoint,roles in matrix.items():doc+='| '+endpoint+' | '+' | '.join('/'.join(map(str,roles.get(role,[]))) or '—' for role in ['Admin','WarehouseManager','Staff','Anonymous','Malformed','Expired'])+' |\n'
doc+='''
Inventory adjust/change-status/replenish and Cycle create/confirm use authenticated-only policy. Cycle detail has no assignee authorization check; pending tasks are assignment-scoped. These endpoints need a business/security release decision. Staff Forecast403 and Bins contents403 are retained; the latter is the intersection of class Admin/WM and method Admin/WM/Staff. Chat/Executive/Slotting permit authenticated roles and need quota/read-access decisions before public exposure. No policy was changed to make tests pass.

## Infrastructure and Postman

Actual health route is /healthz200; /health is404 and no new alias was invented. Development OpenAPI and Swagger200, SignalR anonymous401/authenticated negotiate200, malformed/expired JWT401, ProblemDetails and cancellation are verified. All databases are generated private LocalDB fixtures with jobs/seed disabled and verified cleanup; Hangfire existing storage is initialized only for those fixtures.

'''
doc+=f'''Newman: {len(newman['records'])} executed,275/275 assertions, {len(expected)}/{len(expected)} expected HTTP400/409 rejections; advisory weight mismatch200/isValid=false is asserted separately. Ten successful provider-dependent collection requests use the controlled gateway; they do not replace live89/93 evidence. Token/dependency IDs auto-captured, codes/SKU/lot/future dates generated; no manual IDs or saved examples. User inputs: baseUrl, username, password. Backend key/model/quota/network remain external setup. Desktop upload may require setting repository working directory or selecting two fixture PNGs; Newman automatically reads repository fixtures.

Pilot test-fixture defects (missing Production JWT issuer/audience, an embedding empty-text case returning a valid vector, inherited Staff token at circuit checks, omitted STATUS_CHANGE ledgers, and standalone Hangfire context setup) were corrected in verification code. Final results below use a complete new deterministic run; no production contract was relaxed to hide these failures.

## Integrity and recommendation

Original live evidence hashes are preserved.25 baseline dirty paths and B4 exact status/hash/content unchanged; K1/R1 source/verification/docs unchanged. Branch main, HEAD54695729aadbe7753671e0eee00cf4e80734af21, index empty. No stage, commit, push, LPN work or next phase. Solution/verification builds0 warnings/errors; F1 diff check passes. Final result remains PARTIAL because live quota evidence is unchanged. Both prior HOLD items are resolved. **READY TO COMMIT F1 as PARTIAL after review; this is not release approval or authorization to commit.** Existing policy decisions, single-DB cache/stale vectors and signature-only image validation remain documented limitations.
'''
(root/'docs/PHASE_F1_FINAL_VERIFICATION.md').write_text(doc,encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k not in ['authorizationMatrix','originalEvidenceSha256']},ensure_ascii=False,indent=2))
