"""Source-only S1 audit. Run before policy edits; never contacts a provider or DB."""
import json, re, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
rows = []
for file in sorted((root / 'SmartWMS.Api/Controllers').glob('*.cs')):
    text = file.read_text(encoding='utf-8-sig')
    head, body = re.split(r'public (?:sealed )?class \w+', text, maxsplit=1)
    controller = file.stem.removesuffix('Controller')
    route = re.search(r'\[Route\("([^"]+)"\)\]', head)[1]
    route = route.replace('{version:apiVersion}', '1').replace('[controller]', controller)
    class_auth = re.findall(r'\[Authorize(?:\(([^\]]*)\))?\]', head)
    # Attributes occur immediately before action declarations, including multipart actions.
    for match in re.finditer(r'((?:\s*\[[^\n]+\]\s*)+)public (?:async )?[^\n]+', body):
        attrs = match[1]
        http = re.search(r'\[Http(Get|Post|Put|Delete|Patch)(?:\("([^"]*)"\))?\]', attrs)
        if not http:
            continue
        method, suffix = http[1].upper(), http[2] or ''
        url = '/' + route + ('/' + suffix if suffix else '')
        auth = class_auth + re.findall(r'\[Authorize(?:\(([^\]]*)\))?\]', attrs)
        anonymous = '[AllowAnonymous]' in attrs
        groups = [set(x.strip() for x in m[1].split(',')) for a in auth if (m := re.search(r'Roles\s*=\s*"([^"]+)"', a))]
        allowed = {role: anonymous or (bool(auth) and all(role in g for g in groups)) for role in ['Admin','WarehouseManager','Staff']}
        intent, staff, ownership, risk = 'WEB_CONTROL', 'Manager only', 'None; no warehouse ACL', 'Role restricted'
        action = controller + ': ' + (suffix or {'GET':'list','POST':'create','PUT':'update','DELETE':'delete'}.get(method, method))
        if controller in ('InboundReceipts','OutboundOrders','InventoryTransfers','Products','Customers'):
            intent, staff, risk = 'UNRESOLVED', 'Unclear', 'POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope'
        if controller == 'Inventory':
            intent, staff, risk = 'SHARED', 'Staff optional', 'Warehouse-wide visibility; decision deferred'
            if method == 'POST':
                intent, staff, risk = 'WEB_CONTROL', 'Manager only', 'HIGH: global correction/status/replenishment open to any authenticated principal; change S1'
        if controller == 'CycleCounting':
            if suffix == 'create-sheet':
                intent, staff, risk = 'WEB_CONTROL', 'Manager only', 'HIGH: creates/assigns other users tasks; change S1'
            else:
                intent, staff = 'STAFF_EXECUTION', 'Staff required'
                ownership = 'AssignedUserId == authenticated UserId' if suffix == 'pending-tasks' else 'MISSING: assignment exists but not enforced; add S1 guard'
                risk = 'Assignment scoped' if suffix == 'pending-tasks' else 'HIGH: cross-assignee read/correction'
        if controller == 'Chat':
            intent, staff, risk = 'SHARED', 'Staff optional', 'Shared assistant; authenticated quota exposure remains, no live call in S1'
        if controller == 'Dashboard':
            risk = 'POLICY DECISION REQUIRED: operational summary visibility'
            if suffix in ('executive','ai-slotting-recommendations'):
                risk = 'HIGH: executive/planning data + provider cost; change S1'
        if controller == 'Auth':
            intent, staff, risk = 'SHARED', 'Staff required', 'Login anonymous; logout authenticated (JWT revocation semantics unchanged)'
        if controller == 'InboundReceipts' and suffix in ('confirm-receipt','putaway-suggestion','report-damage'):
            intent, staff, risk = 'STAFF_EXECUTION', 'Staff required', 'No assignee model; existing stable receive/transfer validations only; preserve role contract'
        if controller == 'InboundReceipts' and suffix == 'scan-invoice':
            intent, staff, risk = 'SHARED', 'Staff optional', 'AI invoice assistance; quota exposure, preserve'
        if controller == 'InventoryTransfers':
            intent, staff, risk = 'STAFF_EXECUTION', 'Staff required', 'Bin move/put-away; no task ownership field; preserve execution'
        if controller == 'OutboundOrders' and (suffix in ('{id:guid}/pick','{id:guid}/pack','validate-weight','pick-verify')):
            intent, staff, risk = 'STAFF_EXECUTION', 'Staff required', 'B3 direct-pick has no assignment support; serial pick legacy unsupported; preserve role contract'
        if controller == 'OutboundOrders' and suffix == '{id:guid}/ship':
            intent, staff, risk = 'UNRESOLVED', 'Staff optional', 'Dispatch confirmation vs managerial release undecided; preserve'
        if controller in ('InboundReceipts','OutboundOrders') and method == 'GET':
            intent, staff, risk = 'SHARED', 'Staff required', 'Execution detail/list needed; no warehouse/task ACL; preserve current visibility'
        if controller == 'Products' and (method == 'GET' or suffix == 'parse-barcode'):
            intent, staff, risk = 'SHARED', 'Staff required', 'Scanner/product lookup; semantic search quota exposure remains'
        if controller in ('Products','Customers') and method in ('POST','PUT','DELETE') and suffix != 'parse-barcode':
            risk = 'POLICY DECISION REQUIRED: existing Staff master-data mutation; no UI/business approval to narrow in S1'
        if controller == 'Bins' and suffix == '{id:guid}/contents':
            intent, staff, risk = 'UNRESOLVED', 'Staff optional', 'Method Staff is intersected with class Admin/WM: Staff403. Scanner need plausible, no automatic widening'
        current = 'AllowAnonymous' if anonymous else ' AND '.join('Authorize(' + a + ')' if a else 'Authorize' for a in auth) or 'NONE'
        rows.append(dict(method=method,route=url,action=action,auth=current,roles=allowed,ownership=ownership,intent=intent,staff=staff,risk=risk,source=str(file.relative_to(root)).replace('\\','/')))

out = root / 'obj/S1'
out.mkdir(parents=True,exist_ok=True)
if (out/'audit-before.json').exists():
    raise SystemExit('Refusing to overwrite pre-edit audit')
(out/'audit-before.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
doc = '''# S1 role and API policy matrix

Pre-edit audit completed on 2026-10-24 at F1 checkpoint ead3c3a0b3cfd53a8248fe49062023686d671fc0, branch main. The table below records BEFORE authorization. Role cells mean role-policy admission, not successful business execution. All protected controller routes require a valid JWT. Class and method Authorize attributes intersect (AND), roles inside one attribute are alternatives (OR); no named/custom permission policy is present. No production edit preceded this matrix.

## Role model and clients

- Admin: system/configuration, user/role management, administrative warehouse-wide visibility; demo execution override retained.
- WarehouseManager: primary WebApp operator; operational control, corrective inventory, count creation/assignment, replenishment, executive/planning AI.
- Staff (API/JWT string; WarehouseRole.Staff enum): warehouse execution actor; receiving, put-away/movement, picking, packing, assigned counting, scanner and damage assistance. CreatedBy is audit metadata, not ownership.
- WebApp -> Admin / WarehouseManager. Future Mobile/Handheld -> WarehouseStaff (API role Staff).

Mobile/handheld client is outside current demo scope; backend role/API contracts are preserved for that presentation layer. No mobile app is claimed. Client intent below follows domain/workflow/controller source, not an inspected frontend implementation.

## Complete controller audit before edit

METHOD | ROUTE | BUSINESS ACTION | CURRENT AUTH | ADMIN | WM | STAFF | OWNERSHIP CHECK | CLIENT INTENT | RISK
---|---|---|---|---|---|---|---|---|---
'''
for r in rows:
    doc += '|'.join([r['method'],r['route'],r['action'],r['auth'],*['YES' if r['roles'][role] else 'NO' for role in ('Admin','WarehouseManager','Staff')],r['ownership'],r['intent'],r['risk']])+'\n'
doc += f'''
Controller action total: **{len(rows)}**. Source-only audit JSON retained in ignored obj/S1/audit-before.json. Route inventory is validated against runtime OpenAPI during focused verification.

## Infrastructure and non-controller routes

METHOD | ROUTE | BUSINESS ACTION | CURRENT AUTH | ADMIN | WM | STAFF | OWNERSHIP CHECK | CLIENT INTENT | RISK
---|---|---|---|---|---|---|---|---|---
GET/POST/WS | /hubs/inventory, /hubs/inventory/negotiate | inventory notifications | Hub Authorize | YES | YES | YES | no assignment scope | SYSTEM/INFRA | JWT via query accepted for hubs; broad notifications unchanged
GET | /healthz | storage/provider health | anonymous | YES | YES | YES | none | SYSTEM/INFRA | GeminiHealthCheck hardcodes Google models URL; public health can cause external requests; S1 tests avoid this route
GET/* | /hangfire and dashboard subroutes | background job console | Hangfire default LocalRequestsOnlyAuthorizationFilter | local only | local only | local only | local address equality, not JWT | SYSTEM/INFRA | reverse proxy loopback may expose dashboard; block /hangfire upstream, restrict listener/network; no role retrofit
GET | /openapi/v1.json, /swagger and assets | developer API UI | Development only, anonymous | YES | YES | YES | none | SYSTEM/INFRA | absent in Production; do not expose Development externally

Program.cs has no UseForwardedHeaders/known-proxy configuration. The default Hangfire filter admits loopback or matching local/remote addresses; a same-machine proxy can appear local. X-Forwarded-For alone is not a trustworthy auth source. Deployment must deny public /hangfire at proxy/firewall and protect backend listener. No JWT-role conversion or public dashboard exposure is introduced. /health does not exist (404). Route placeholders require a supported API version (v1).

## Actor and assignment findings

CycleCountSheet.AssignedUserId is the authoritative nullable assignment. Pending tasks already filters by authenticated GUID; operatorName cannot override it. Detail and confirm lack ownership before S1. Confirm has a transaction/locked sheet, enabling an assignment guard before corrections under the same lock. Admin/WM override fits existing managerial correction responsibility. Null assignment never belongs to Staff. CountedItems must exactly match sheet details, preventing foreign item injection. No ConfirmedBy field or separate submission/approval phase exists; Staff confirmation remains existing final correction behavior, now assigned only.

InboundReceipt has no assignee field. OutboundIssue has no assignee field; legacy PickTask has AssignedUserId but B3 Allocate rejects a non-null assignedUserId. Direct-pick whole-order B3 therefore cannot safely gain task ownership by reusing legacy pick-task assignment. Transfer has no assignment model. Existing receive/pick/pack/move actor access remains intact; no new ACL or schema is invented. CreatedBy literals (WarehouseManager/WarehouseStaff/Serial_Scanner) do not establish task ownership. User creation/update remains Admin-only.

## Staff execution contract

METHOD | ROUTE | CLASSIFICATION | S1 INTENT
---|---|---|---
POST | /api/v1/InboundReceipts/confirm-receipt | Staff required | receive execution, keep
GET | /api/v1/InboundReceipts/putaway-suggestion | Staff required | put-away lookup, keep
POST/GET | /api/v1/InventoryTransfers and detail/list | Staff required | move/put-away, keep
POST | /api/v1/OutboundOrders/{{id}}/pick, /{{id}}/pack, /validate-weight | Staff required | B3 execution, keep
POST | /api/v1/OutboundOrders/pick-verify | Staff required | preserve role; Serial path remains unsupported in B3
POST | /api/v1/OutboundOrders/{{id}}/ship | Staff optional | dispatch role decision deferred; keep
GET | /api/v1/CycleCounting/pending-tasks, /{{id}} | Staff required | assigned tasks only
POST | /api/v1/CycleCounting/confirm | Staff required | assigned sheet only; current final correction semantics retained
GET/POST | /api/v1/Products lookup/qrcode/parse-barcode | Staff required | scanner support, keep
POST | /api/v1/InboundReceipts/report-damage | Staff required | advisory analysis, keep
POST | /api/v1/InboundReceipts/scan-invoice, /api/v1/Chat/ask | Staff optional | shared assistance, quota exposure documented
GET | /api/v1/Bins/{{id}}/contents | Unclear | class/method intersection denies Staff; leave until scanner lookup decision
POST | /api/v1/Kitting/assemble | Manager only | existing K1 policy retained; no assigned kitting task model
POST | Inventory adjust-stock/change-status/run-auto-replenish; CycleCounting/create-sheet | Manager only | corrective/global/control actions
GET | Dashboard/executive, Dashboard/ai-slotting-recommendations; Forecasts/demand-prediction | Manager only | planning/sensitive executive data

## High-confidence changes authorized after audit

Inventory adjust-stock/change-status/run-auto-replenish and CycleCounting/create-sheet: authenticated -> Admin OR WarehouseManager. Change-status is arbitrary lot-wide hold/damage/release (handler logs WarehouseManager), not a task-specific transition. Dashboard executive/ai-slotting-recommendations: authenticated -> Admin OR WarehouseManager; executive aggregates warehouse-wide financial/inventory/operational KPIs, slotting plans movements. Cycle detail/confirm remain available to Admin/WM/Staff; Staff requires its authenticated GUID equal AssignedUserId, manager/admin override; unknown roles fail closed. No schema or permission table needed.

## Unchanged policy decisions

POLICY DECISION REQUIRED: Staff product/customer master CRUD; inbound/outbound create/update/delete and allocation/wave planning; cross-dock role (legacy Deferred/Partial); outbound dispatch release versus Staff shipping confirmation; bin contents widening; dashboard chart/occupancy/AI-agent-metrics and global inventory summary/history visibility. Keep current behavior rather than infer policy from missing mobile UI. Shared Chat/semantic/vision remain authenticated per current roles; quotas need a separate policy decision. Existing role matrix is not warehouse tenancy: no warehouse ACL can be claimed. Legacy serial/wave/LPN routes are not promoted to Stable by authorization admission.

## Verification and review

Pending focused role/ownership/no-mutation/provider checks and regression. F1 evidence is frozen; no live Gemini calls. Builds run in an ignored S1 source mirror, with committed PasswordHasher instead of dirty baseline. No stage, commit or push.
'''
(root/'docs/PHASE_S1_ROLE_MATRIX.md').write_text(doc,encoding='utf-8')
print(f'Pre-edit audit complete: {len(rows)} controller routes; matrix written before any policy edit')
