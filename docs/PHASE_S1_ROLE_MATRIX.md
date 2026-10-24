# S1 role and API policy matrix

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
GET|/api/v1/AuditLogs|AuditLogs: list|Authorize(Roles = "Admin")|YES|NO|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
POST|/api/v1/Auth/login|Auth: login|AllowAnonymous|YES|YES|YES|None; no warehouse ACL|SHARED|Login anonymous; logout authenticated (JWT revocation semantics unchanged)
POST|/api/v1/Auth/logout|Auth: logout|Authorize|YES|YES|YES|None; no warehouse ACL|SHARED|Login anonymous; logout authenticated (JWT revocation semantics unchanged)
GET|/api/v1/Bins/list|Bins: list|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Bins|Bins: list|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Bins/{id:guid}|Bins: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Bins/{id:guid}/contents|Bins: {id:guid}/contents|Authorize(Roles = "Admin,WarehouseManager") AND Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|NO|None; no warehouse ACL|UNRESOLVED|Method Staff is intersected with class Admin/WM: Staff403. Scanner need plausible, no automatic widening
POST|/api/v1/Bins|Bins: create|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
PUT|/api/v1/Bins/{id:guid}|Bins: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
DELETE|/api/v1/Bins/{id:guid}|Bins: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
POST|/api/v1/Chat/ask|Chat: ask|Authorize|YES|YES|YES|None; no warehouse ACL|SHARED|Shared assistant; authenticated quota exposure remains, no live call in S1
GET|/api/v1/Customers/list|Customers: list|Authorize(Roles = "Admin, WarehouseManager, Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
GET|/api/v1/Customers|Customers: list|Authorize(Roles = "Admin, WarehouseManager, Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
GET|/api/v1/Customers/{id:guid}|Customers: {id:guid}|Authorize(Roles = "Admin, WarehouseManager, Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
POST|/api/v1/Customers|Customers: create|Authorize(Roles = "Admin, WarehouseManager, Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: existing Staff master-data mutation; no UI/business approval to narrow in S1
PUT|/api/v1/Customers/{id:guid}|Customers: {id:guid}|Authorize(Roles = "Admin, WarehouseManager, Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: existing Staff master-data mutation; no UI/business approval to narrow in S1
DELETE|/api/v1/Customers/{id:guid}|Customers: {id:guid}|Authorize(Roles = "Admin, WarehouseManager, Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: existing Staff master-data mutation; no UI/business approval to narrow in S1
POST|/api/v1/CycleCounting/create-sheet|CycleCounting: create-sheet|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|HIGH: creates/assigns other users tasks; change S1
GET|/api/v1/CycleCounting/{id:guid}|CycleCounting: {id:guid}|Authorize|YES|YES|YES|MISSING: assignment exists but not enforced; add S1 guard|STAFF_EXECUTION|HIGH: cross-assignee read/correction
POST|/api/v1/CycleCounting/confirm|CycleCounting: confirm|Authorize|YES|YES|YES|MISSING: assignment exists but not enforced; add S1 guard|STAFF_EXECUTION|HIGH: cross-assignee read/correction
GET|/api/v1/CycleCounting/pending-tasks|CycleCounting: pending-tasks|Authorize|YES|YES|YES|AssignedUserId == authenticated UserId|STAFF_EXECUTION|Assignment scoped
GET|/api/v1/Dashboard/executive|Dashboard: executive|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|HIGH: executive/planning data + provider cost; change S1
GET|/api/v1/Dashboard/inbound-outbound-chart|Dashboard: inbound-outbound-chart|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|POLICY DECISION REQUIRED: operational summary visibility
GET|/api/v1/Dashboard/warehouse-occupancy|Dashboard: warehouse-occupancy|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|POLICY DECISION REQUIRED: operational summary visibility
GET|/api/v1/Dashboard/ai-agent-metrics|Dashboard: ai-agent-metrics|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|POLICY DECISION REQUIRED: operational summary visibility
GET|/api/v1/Dashboard/ai-slotting-recommendations|Dashboard: ai-slotting-recommendations|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|HIGH: executive/planning data + provider cost; change S1
GET|/api/v1/Forecasts/demand-prediction|Forecasts: demand-prediction|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
POST|/api/v1/InboundReceipts|InboundReceipts: create|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
POST|/api/v1/InboundReceipts/confirm-receipt|InboundReceipts: confirm-receipt|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|No assignee model; existing stable receive/transfer validations only; preserve role contract
PUT|/api/v1/InboundReceipts/{id:guid}|InboundReceipts: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
DELETE|/api/v1/InboundReceipts/{id:guid}|InboundReceipts: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
GET|/api/v1/InboundReceipts|InboundReceipts: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Execution detail/list needed; no warehouse/task ACL; preserve current visibility
GET|/api/v1/InboundReceipts/{id:guid}|InboundReceipts: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Execution detail/list needed; no warehouse/task ACL; preserve current visibility
GET|/api/v1/InboundReceipts/list|InboundReceipts: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Execution detail/list needed; no warehouse/task ACL; preserve current visibility
GET|/api/v1/InboundReceipts/putaway-suggestion|InboundReceipts: putaway-suggestion|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Execution detail/list needed; no warehouse/task ACL; preserve current visibility
POST|/api/v1/InboundReceipts/process-crossdock|InboundReceipts: process-crossdock|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
POST|/api/v1/InboundReceipts/scan-invoice|InboundReceipts: scan-invoice|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|AI invoice assistance; quota exposure, preserve
POST|/api/v1/InboundReceipts/report-damage|InboundReceipts: report-damage|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|No assignee model; existing stable receive/transfer validations only; preserve role contract
GET|/api/v1/Inventory/stock-summary|Inventory: stock-summary|Authorize|YES|YES|YES|None; no warehouse ACL|SHARED|Warehouse-wide visibility; decision deferred
GET|/api/v1/Inventory/low-stock-alerts|Inventory: low-stock-alerts|Authorize|YES|YES|YES|None; no warehouse ACL|SHARED|Warehouse-wide visibility; decision deferred
POST|/api/v1/Inventory/adjust-stock|Inventory: adjust-stock|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|HIGH: global correction/status/replenishment open to any authenticated principal; change S1
GET|/api/v1/Inventory/stock-history|Inventory: stock-history|Authorize|YES|YES|YES|None; no warehouse ACL|SHARED|Warehouse-wide visibility; decision deferred
POST|/api/v1/Inventory/change-status|Inventory: change-status|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|HIGH: global correction/status/replenishment open to any authenticated principal; change S1
POST|/api/v1/Inventory/run-auto-replenish|Inventory: run-auto-replenish|Authorize|YES|YES|YES|None; no warehouse ACL|WEB_CONTROL|HIGH: global correction/status/replenishment open to any authenticated principal; change S1
GET|/api/v1/InventoryTransfers|InventoryTransfers: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|Bin move/put-away; no task ownership field; preserve execution
GET|/api/v1/InventoryTransfers/list|InventoryTransfers: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|Bin move/put-away; no task ownership field; preserve execution
GET|/api/v1/InventoryTransfers/{id:guid}|InventoryTransfers: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|Bin move/put-away; no task ownership field; preserve execution
POST|/api/v1/InventoryTransfers|InventoryTransfers: create|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|Bin move/put-away; no task ownership field; preserve execution
POST|/api/v1/Kitting/assemble|Kitting: assemble|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/OutboundOrders/list|OutboundOrders: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Execution detail/list needed; no warehouse/task ACL; preserve current visibility
GET|/api/v1/OutboundOrders|OutboundOrders: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Execution detail/list needed; no warehouse/task ACL; preserve current visibility
GET|/api/v1/OutboundOrders/{id:guid}|OutboundOrders: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Execution detail/list needed; no warehouse/task ACL; preserve current visibility
POST|/api/v1/OutboundOrders|OutboundOrders: create|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
PUT|/api/v1/OutboundOrders/{id:guid}|OutboundOrders: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
DELETE|/api/v1/OutboundOrders/{id:guid}|OutboundOrders: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
POST|/api/v1/OutboundOrders/allocate-pick-task|OutboundOrders: allocate-pick-task|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
POST|/api/v1/OutboundOrders/create-wave-pick|OutboundOrders: create-wave-pick|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: broad Staff access without task/warehouse scope
POST|/api/v1/OutboundOrders/pick-verify|OutboundOrders: pick-verify|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|B3 direct-pick has no assignment support; serial pick legacy unsupported; preserve role contract
POST|/api/v1/OutboundOrders/{id:guid}/pick|OutboundOrders: {id:guid}/pick|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|B3 direct-pick has no assignment support; serial pick legacy unsupported; preserve role contract
POST|/api/v1/OutboundOrders/{id:guid}/pack|OutboundOrders: {id:guid}/pack|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|B3 direct-pick has no assignment support; serial pick legacy unsupported; preserve role contract
POST|/api/v1/OutboundOrders/{id:guid}/ship|OutboundOrders: {id:guid}/ship|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|Dispatch confirmation vs managerial release undecided; preserve
POST|/api/v1/OutboundOrders/validate-weight|OutboundOrders: validate-weight|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|STAFF_EXECUTION|B3 direct-pick has no assignment support; serial pick legacy unsupported; preserve role contract
GET|/api/v1/Products/{id:guid}|Products: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Scanner/product lookup; semantic search quota exposure remains
GET|/api/v1/Products/list|Products: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Scanner/product lookup; semantic search quota exposure remains
GET|/api/v1/Products|Products: list|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Scanner/product lookup; semantic search quota exposure remains
POST|/api/v1/Products|Products: create|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: existing Staff master-data mutation; no UI/business approval to narrow in S1
PUT|/api/v1/Products/{id:guid}|Products: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: existing Staff master-data mutation; no UI/business approval to narrow in S1
DELETE|/api/v1/Products/{id:guid}|Products: {id:guid}|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|UNRESOLVED|POLICY DECISION REQUIRED: existing Staff master-data mutation; no UI/business approval to narrow in S1
GET|/api/v1/Products/semantic-search|Products: semantic-search|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Scanner/product lookup; semantic search quota exposure remains
GET|/api/v1/Products/{sku}/qrcode|Products: {sku}/qrcode|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Scanner/product lookup; semantic search quota exposure remains
POST|/api/v1/Products/parse-barcode|Products: parse-barcode|Authorize(Roles = "Admin,WarehouseManager,Staff")|YES|YES|YES|None; no warehouse ACL|SHARED|Scanner/product lookup; semantic search quota exposure remains
GET|/api/v1/Reports/export/excel|Reports: export/excel|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Suppliers/list|Suppliers: list|Authorize(Roles = "Admin, WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Suppliers|Suppliers: list|Authorize(Roles = "Admin, WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Suppliers/{id:guid}|Suppliers: {id:guid}|Authorize(Roles = "Admin, WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
POST|/api/v1/Suppliers|Suppliers: create|Authorize(Roles = "Admin, WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
PUT|/api/v1/Suppliers/{id:guid}|Suppliers: {id:guid}|Authorize(Roles = "Admin, WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
DELETE|/api/v1/Suppliers/{id:guid}|Suppliers: {id:guid}|Authorize(Roles = "Admin, WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Users/list|Users: list|Authorize(Roles = "Admin")|YES|NO|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Users/{id:guid}|Users: {id:guid}|Authorize(Roles = "Admin")|YES|NO|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Users|Users: list|Authorize(Roles = "Admin")|YES|NO|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
POST|/api/v1/Users|Users: create|Authorize(Roles = "Admin")|YES|NO|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
PUT|/api/v1/Users/{id:guid}|Users: {id:guid}|Authorize(Roles = "Admin")|YES|NO|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
DELETE|/api/v1/Users/{id:guid}|Users: {id:guid}|Authorize(Roles = "Admin")|YES|NO|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Warehouses|Warehouses: list|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Warehouses/list|Warehouses: list|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Warehouses/{id:guid}|Warehouses: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
POST|/api/v1/Warehouses|Warehouses: create|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
PUT|/api/v1/Warehouses/{id:guid}|Warehouses: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
DELETE|/api/v1/Warehouses/{id:guid}|Warehouses: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Zones/list|Zones: list|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Zones/warehouse/{warehouseId:guid}|Zones: warehouse/{warehouseId:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
GET|/api/v1/Zones|Zones: list|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
POST|/api/v1/Zones|Zones: create|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
PUT|/api/v1/Zones/{id:guid}|Zones: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted
DELETE|/api/v1/Zones/{id:guid}|Zones: {id:guid}|Authorize(Roles = "Admin,WarehouseManager")|YES|YES|NO|None; no warehouse ACL|WEB_CONTROL|Role restricted

Controller action total: **96**. Source-only audit JSON retained in ignored obj/S1/audit-before.json. Route inventory is validated against runtime OpenAPI during focused verification.

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
POST | /api/v1/OutboundOrders/{id}/pick, /{id}/pack, /validate-weight | Staff required | B3 execution, keep
POST | /api/v1/OutboundOrders/pick-verify | Staff required | preserve role; Serial path remains unsupported in B3
POST | /api/v1/OutboundOrders/{id}/ship | Staff optional | dispatch role decision deferred; keep
GET | /api/v1/CycleCounting/pending-tasks, /{id} | Staff required | assigned tasks only
POST | /api/v1/CycleCounting/confirm | Staff required | assigned sheet only; current final correction semantics retained
GET/POST | /api/v1/Products lookup/qrcode/parse-barcode | Staff required | scanner support, keep
POST | /api/v1/InboundReceipts/report-damage | Staff required | advisory analysis, keep
POST | /api/v1/InboundReceipts/scan-invoice, /api/v1/Chat/ask | Staff optional | shared assistance, quota exposure documented
GET | /api/v1/Bins/{id}/contents | Unclear | class/method intersection denies Staff; leave until scanner lookup decision
POST | /api/v1/Kitting/assemble | Manager only | existing K1 policy retained; no assigned kitting task model
POST | Inventory adjust-stock/change-status/run-auto-replenish; CycleCounting/create-sheet | Manager only | corrective/global/control actions
GET | Dashboard/executive, Dashboard/ai-slotting-recommendations; Forecasts/demand-prediction | Manager only | planning/sensitive executive data

## High-confidence changes authorized after audit

Inventory adjust-stock/change-status/run-auto-replenish and CycleCounting/create-sheet: authenticated -> Admin OR WarehouseManager. Change-status is arbitrary lot-wide hold/damage/release (handler logs WarehouseManager), not a task-specific transition. Dashboard executive/ai-slotting-recommendations: authenticated -> Admin OR WarehouseManager; executive aggregates warehouse-wide financial/inventory/operational KPIs, slotting plans movements. Cycle detail/confirm remain available to Admin/WM/Staff; Staff requires its authenticated GUID equal AssignedUserId, manager/admin override; unknown roles fail closed. No schema or permission table needed.

## Unchanged policy decisions

POLICY DECISION REQUIRED: Staff product/customer master CRUD; inbound/outbound create/update/delete and allocation/wave planning; cross-dock role (legacy Deferred/Partial); outbound dispatch release versus Staff shipping confirmation; bin contents widening; dashboard chart/occupancy/AI-agent-metrics and global inventory summary/history visibility. Keep current behavior rather than infer policy from missing mobile UI. Shared Chat/semantic/vision remain authenticated per current roles; quotas need a separate policy decision. Existing role matrix is not warehouse tenancy: no warehouse ACL can be claimed. Legacy serial/wave/LPN routes are not promoted to Stable by authorization admission.

## Verification and review

**S1 RESULT: PARTIAL — high-confidence authorization hardening verified; unresolved product/deployment policy remains documented.**

### Exact policy changes after the frozen pre-edit matrix

METHOD | ROUTE | OLD | NEW | REASON
---|---|---|---|---
POST | /api/v1/Inventory/adjust-stock | any authenticated | Admin/WM | global corrective stock mutation
POST | /api/v1/Inventory/change-status | any authenticated | Admin/WM | arbitrary managerial hold/damage/release
POST | /api/v1/Inventory/run-auto-replenish | any authenticated | Admin/WM | global planning engine
POST | /api/v1/CycleCounting/create-sheet | any authenticated | Admin/WM | create/assign count task
GET | /api/v1/Dashboard/executive | any authenticated | Admin/WM | warehouse-wide executive data and provider cost
GET | /api/v1/Dashboard/ai-slotting-recommendations | any authenticated | Admin/WM | planning recommendation and provider cost
GET | /api/v1/CycleCounting/{id:guid} | any authenticated, no assignment check | Admin/WM override; Staff assigned only | task data isolation
POST | /api/v1/CycleCounting/confirm | any authenticated, no assignment check | Admin/WM override; Staff assigned only | correction restricted to assigned task

CycleCountAccess accepts Admin or WarehouseManager; Staff must have a non-empty valid GUID matching AssignedUserId. Unknown/missing role, bad/empty user ID, other assignee, null assignment fail closed. Confirm checks assignment after LockSheetAsync reloads the locked row, before correction/status/ledger/audit writes. Transaction disposal clears rejected tracking. Detail checks before mapping the returned DTO. Complete-item, snapshot, reservation, occupancy and replay rules are unchanged. Pending tasks retains its authenticated assignment filter.

### Verification results

- Solution build: PASS, 0 warnings/errors. All six regression projects and final focused executable build with 0 warnings/errors in isolated outputs.
- Focused S1: **588/588** checks; **79** recorded role/ownership HTTP cases, all matching expected statuses. Six required identities plus unknown valid role.
- Complete inventory: **96** controller routes, exact match with fresh B3 HTTP OpenAPI. **285** invalid-JWT route checks (95 protected actions x 3).
- **57** individual full SQL snapshots preserve every table/schema/stock/ledger/business audit for rejected/read requests; each checks zero additional loopback provider calls. Additional batch and handler snapshots cover invalid identities, reassignment and forged detail/replay attempts.
- Ownership: Staff own detail/confirm succeeds; other assignee and unassigned sheet403; Admin/WM overrides succeed; foreign items400; replay409. Five direct invalid-role/identity/non-owner pairs reject detail and confirm. Pretracked old assignment is reloaded under lock and denied after reassignment.
- Staff happy path: manager-created receipt -> Staff receive -> Staff transfer/put-away -> manager allocation -> Staff whole-order B3 pick -> Staff pack -> Staff ship. Final source24 + destination1, occupancy24/1, reservations0, ledger receive+4/pick-2; Pack/Ship never deduct again. Scanner parsing, QR/product/task lookups and damage advice remain usable by Staff.
- F1 relevant deterministic: **51/51**, reusing committed provider-envelope/cancellation and deep SQL AI/cache checks. S1 HTTP checks supersede old F1 broad-role assumptions without editing F1 verification/evidence.
- Regression: **884/884** across Phase4A95, Phase4B107, B1 142, B3 24/161/5/46, K1 127/15, R1 136/26. Orchestration12/12 combines 10 original suite passes, unchanged generated anchor, and isolated R1 HTTP retry.
- R1 compatibility: untouched legacy HTTP test initially fails its last Staff200 auto-replenish assertion. S1 PrepareMirror explicitly replaces only that historical assertion with Staff403 plus a SQL no-mutation check in the ignored mirror. Business checks and committed R1 source/evidence remain unchanged. Adapted HTTP26/26 passes. Original failure logs remain; historical role compatibility is intentionally changed.
- Pilot S1 fixture failures (missing outbound demand and exact dry-zone name) were corrected; complete final run588/588 passes. Rebuilding while a test held the executable caused a file-lock build failure; final focused build uses separate output and passes0/0.
- Sandbox denied LocalDB registry access initially. Actual SQL runs used approved access to generated fixtures only, with verified cleanup; no shared application DB was touched.
- Live Gemini calls in S1: **0**. Readiness uses a protected endpoint's401, avoiding /healthz. Production GeminiHealthCheck hardcodes the external Google models endpoint: public health traffic can cause external calls. This deployment finding is documented, not changed. S1 provider responses are explicit loopback doubles, not live evidence.
- Frozen F1 remains **PARTIAL — external provider quota/rate limit**, live89/93, deterministic1247/1247. No evidence regeneration or live retry.

### Artifacts and reproduction

Pre-edit audit is the first matrix above. Structured summary: verification/AuthorizationS1/VerificationEvidence.json. Detailed logs/per-case matrix remain in ignored obj/S1/http-final, f1-approved, regression and r1-policy-http.log. Certify.py verifies runtime route inventory, baseline/evidence integrity and aggregate counts without rerunning tests.

From repository root, run PrepareMirror.ps1, build the mirrored solution, AuthorizationS1 and six regression projects. Invoke S1 with --http <report> <api-dll>, --f1-relevant <report> ignored, or --regression <report> <mirror>. Set S1_REPO to repository root for the frozen audit. Audit.py performs the one-time pre-edit capture and refuses to overwrite existing evidence. PrepareMirror uses committed PasswordHasher, redirects legacy read-only DB anchors to generated fixtures, supplies Phase4B's actor constructor dependency only in the mirror, and adapts the historical R1 assertion explicitly. LocalDB may require host approval. Pre-commit review runs only --ownership <report> ignored and builds the Phase4B mirror; no full regression rerun.

### Pre-commit production and historical verification review

- CycleCountingController: three method attributes only: create-sheet Admin/WM; detail and confirm Admin/WM/Staff. Existing class Authorize remains; actions/DTOs unchanged.
- DashboardController: two attributes only, Admin/WM on executive and ai-slotting-recommendations.
- InventoryController: three attributes only, Admin/WM on adjust-stock, change-status, run-auto-replenish.
- ConfirmCycleCountCommandHandler: required ICurrentUserService constructor parameter and AUTH_403 guard after LockSheetAsync; no correction/occupancy/ledger/audit algorithm change.
- CycleCountAccess: new shared authorization predicate, Admin/WM override or Staff's valid non-empty GUID equal AssignedUserId; other cases fail closed.
- GetCountSheetByIdQueryHandler: inject/store ICurrentUserService and AUTH_403 guard after sheet lookup, before DTO mapping; final newline normalized.

No unrelated business logic is introduced. All six production files preserve their already-reviewed bytes during this pre-commit review.

**Phase4B verification file: REMOVE FROM S1.** The sole former repository diff was adding `new VerifyUser(userId)` as the fourth ConfirmCycleCountCommandHandler argument. S1's required actor dependency made that compile adapter necessary; it was not a generic verification bug fix. No Phase4B assertion, expected behavior or historical evidence changed. The file is now restored to HEAD F1 (identical Git blob, repository CRLF working-tree convention). S1 PrepareMirror applies the same constructor adaptation to exactly one call in the ignored mirror, preserving the existing fixture Staff/user ID and all assertions. Phase4B mirror and S1 focused build pass0 warnings/errors. Separate generated-DB --ownership check: **24/24 PASS**, cleanup verified, no HTTP/provider/full regression. Approved588/588 focused and884/884 regression evidence remains historical evidence from the prior completed run; those suites are not rerun in this review.

### Integrity and scope

Main/HEAD ead3c3a0b3cfd53a8248fe49062023686d671fc0 unchanged; index empty. 25 baseline paths preserve exact status/SHA256/content; B4 unchanged. K1/R1 source, verification and docs unchanged. F1 business implementations, verification/evidence unchanged; DashboardController's two role attributes are the explicit S1 edit to an F1-touched file. No schema/migration, permission tables, warehouse ACL, identity redesign, production package/startup/config change, mobile or LPN implementation. NOT COMMITTED. NOT PUSHED. Stop for review.

### Exact S1 repository manifest

- `SmartWMS.Api/Controllers/CycleCountingController.cs`
- `SmartWMS.Api/Controllers/DashboardController.cs`
- `SmartWMS.Api/Controllers/InventoryController.cs`
- `SmartWMS.Application/Features/CycleCounting/Commands/ConfirmCycleCount/ConfirmCycleCountCommandHandler.cs`
- `SmartWMS.Application/Features/CycleCounting/CycleCountAccess.cs`
- `SmartWMS.Application/Features/CycleCounting/Queries/GetCountSheetById/GetCountSheetByIdQueryHandler.cs`
- `docs/PHASE_S1_ROLE_MATRIX.md`
- `verification/AuthorizationS1/Audit.py`
- `verification/AuthorizationS1/AuthorizationChecks.cs`
- `verification/AuthorizationS1/AuthorizationS1.Verification.csproj`
- `verification/AuthorizationS1/Certify.py`
- `verification/AuthorizationS1/HandlerChecks.cs`
- `verification/AuthorizationS1/PrepareMirror.ps1`
- `verification/AuthorizationS1/Program.cs`
- `verification/AuthorizationS1/StaffExecution.cs`
- `verification/AuthorizationS1/TestHost.cs`
- `verification/AuthorizationS1/VerificationEvidence.json`

Total: **17 files** (6 production, 10 S1 verification/audit/evidence, 1 documentation). All historical verification files are unchanged in the repository.
