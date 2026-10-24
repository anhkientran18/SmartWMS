# SmartWMS backend → frontend API handoff

Checkpoint: branch `main`, S1 HEAD **`539dc542314a46207cd98313e89d04165ebed9a5`**, `feat: harden authorization and cycle count ownership`. Source inspection: 2026-10-24 (Asia/Saigon).

This is the FE integration contract for the S1 baseline plus **H2 uncommitted worktree hardening**. It describes actual routed controllers, bound DTOs, validators and handlers; legacy/deferred scope remains unchanged. H2 adds a scoped count-assignee lookup, same-warehouse transfer validation, truthful product projections and best-effort product embedding. Focused and regression evidence is recorded in [H2 report](PHASE_H2.md). No FE change, live Gemini request, stage, commit or push was performed.

**Tóm tắt cho FE:** Có thể tích hợp các luồng None/Lot đã mô tả, bao gồm nút “Tự động châm hàng” dành cho Admin/WM. Phải dùng đúng payload, trạng thái, role/ownership và refresh map; không dựng luồng LPN, Serial, Wave hay Cross-dock end-to-end. AI có contract đã kiểm chứng nhưng vẫn phụ thuộc provider. Các contract H2 bên dưới đã sửa projection barcode/weight và bổ sung assignee lookup; weight/dimension editing và các capability deferred vẫn không được suy đoán thành API hỗ trợ.

## 1. Readiness and role legend

Endpoint tables use these exact classifications:

| Code | Classification | FE interpretation |
|---|---|---|
| S | **STABLE — FE CAN INTEGRATE** | Supported contract in the documented scope; authentication/roles still apply. |
| C | **STABLE WITH ROLE/OWNERSHIP CONSTRAINT** | Supported, but gate controls and handle server-side role/assignment rejection. |
| E | **EXTERNAL DEPENDENCY** | Contract is usable; provider/storage availability is not guaranteed. Never fake a successful response. |
| P | **PARTIAL / DEFERRED** | Expose limitations if discussed; do not build a production execution workflow around it. |
| U | **UNSUPPORTED — DO NOT INTEGRATE** | Route/model presence is not workflow readiness. |

Roles: **A** = `Admin`, **M** = `WarehouseManager`, **T** = `Staff`, **AUTH** = any authenticated principal. `AM` means A **OR** M, not both; `AMT` means any of the three. All non-login controller actions require a valid JWT. Class and method authorization attributes intersect; a method attribute cannot widen a narrower controller attribute.

| Role | Responsibility | Client mapping |
|---|---|---|
| Admin | System/configuration authority, users/roles, administrative visibility and managerial override. | WebApp management/control console. |
| WarehouseManager | Primary WebApp operator: inventory control, replenishment, count creation/assignment, planning, dashboards/AI and operational orchestration. | WebApp. |
| Staff | Execution: receive, put-away/move, pick, pack, assigned count, product/scanner lookup, damage reporting. | Future handheld/mobile. |

**WebApp → Admin / WarehouseManager. Future handheld/mobile → Staff.** Mobile/handheld is not implemented in the current demo. Staff API access is preserved independently of available WebApp screens.

S1 remains **PARTIAL — high-confidence authorization hardening verified; unresolved product/deployment policy remains documented.** Existing Staff master CRUD and planning privileges are not a new product recommendation. Tables state actual server admission; recommended WebApp controls remain A/M. No warehouse-level ACL/tenant isolation is implied.

## 2. Wire conventions, envelopes and FE error handling

- Use configurable backend origin + the exact `/api/v1/...` paths below; send HTTPS in deployment. Do not hardcode a developer's port, filesystem path, DB connection, Gemini model/key or JWT secret in FE.
- Current CORS allows origins whose host is localhost/127.0.0.1; a deployed WebApp on another host needs a separate deployment configuration decision. This document does not change CORS or authentication.
- JSON requests/responses use ASP.NET web camelCase. Request bodies are **DTOs directly**, except **CycleCounting/create-sheet**, which binds the command and therefore requires `{ "requestData": {...} }`.
- IDs are GUID strings. Dates use ISO 8601; send explicit UTC dates/times where relevant. State strings are case-sensitive workflow values in this guide. Query names come from controller bindings, not internal DTO names.
- Most successful controller responses are **HTTP200**, including create/delete. Do not require201/204. `R<T>` below means the standard successful `Result<T>` envelope with `data:T`:

```json
{"isSuccess":true,"message":"...","error":null,"errors":[],"data":true}
```

`message`/`error` can be null; use `data` and `isSuccess`, never translated message text, for behavior. GUID creation results are `data:"<guid>"`; booleans are `data:true`; arrays are `data:[...]`.

Returned business failures (`ToActionResult`) use:

```json
{"isSuccess":false,"message":"...","errorCode":"COM_409","errors":[]}
```

Validation/dependency exceptions use ProblemDetails, not the above envelope:

```json
{"status":503,"title":"AI Dependency Error","detail":"...","instance":"/api/v1/...","code":"AI_CONFIGURATION_MISSING"}
```

Validation ProblemDetails includes `errors:{"field":["message"]}`. Automatic model-binding400 can use ASP.NET ValidationProblemDetails. Controller path/body-ID mismatch can return only `{isSuccess:false,message}`. JWT middleware401/403 may have an empty body. FE must tolerate all these shapes and fall back to HTTP status if no machine code exists.

| HTTP | Actual meaning/contract | FE handling |
|---|---|---|
| 400 | Binding/validation; `VAL_1000`, `ERR_GENERAL`, `OLD_ERR` or legacy code; some handlers use400 even for a missing object. | Show field/business errors; retain form. Do not assume all missing objects return404. |
| 401 | Missing/malformed/expired JWT; bad login can return `AUTH_401`. | Clear expired session and ask login; no silent mutation replay. |
| 403 | Role policy or cycle ownership; handler failures use `AUTH_403`, middleware can be bodyless. | Hide/disable forbidden action; assignment rejection: reload task list/detail as appropriate, do not retry as another identity. |
| 404 | Mapped `COM_001`, `PRD_001`, `BIN_001`, `ZON_001`, or absent route. | Remove stale selection and refresh its list. |
| 409 | `COM_409`, `PRD_002`/`PRD_003`: state, stock, capacity/concurrency, replay, dependency/reference or uniqueness conflict. | Refetch authoritative state; explain conflict. Require a new user decision before mutation retry. |
| 502 | `AI_RESPONSE_INVALID` from business validation or ProblemDetails; provider HTTP/network failures via `HttpRequestException`. Provider429/401/403/404/5xx can map here after retry policy. | Show dependency error, not an application-crash page or fake result. Provider401 is not FE login401. |
| 503 | ProblemDetails `AI_CONFIGURATION_MISSING` / `AI_PROVIDER_UNAVAILABLE` (including open circuit). | Show unavailable/configuration state; do not request server secrets from FE users. |
| 504 | Provider timeout / server-side cancellation timeout; not a guaranteed response after caller abort. | Show timeout; allow deliberate retry for advisory reads. Reconcile mutations before retrying. |
| 500 | Unexpected runtime/storage error; `SYS_5002` may map here. | Preserve correlation/context, show failure, reconcile uncertain mutations. |

All tables list **business** rejection statuses; global401 and role403 apply additionally, as do unexpected500 errors. Read tables with these inherited defaults. A response body with `isSuccess:false` is a failure even if an adapter/proxy behaves unexpectedly. Weight advice is a special successful result with `data.isValid:false`, described below.

`Page<T>` is `R<{items:T[],pageIndex,pageSize,totalCount,totalPages,hasPreviousPage,hasNextPage,firstItemIndex,lastItemIndex}>`. Public paging query is generally `pageNumber=1&pageSize=10`, not `pageIndex`. Exceptions: stock-history directly binds `pageIndex`; audit pageSize defaults20; Users uses `R<{items,totalRecords,totalPages}>`. Use a positive page size and respect validation; there is no one universal pagination DTO.

Enums use **numeric JSON** (no string-enum converter is registered): `ProductTrackingMode` None0/Lot1/Serial2; `BinPurpose` Storage0/Staging1; `InventoryStatus` Available1/Reserved2/QCHold3/Damaged4/Expired5. Response `status` on bin-content rows is instead a **string**, and `expirationDate` there is a display string (`yyyy-MM-dd` or `Không có hạn dùng`). Capacity/occupancy represents physical **unit counts**, not grams, cubic volume or pallet slots. FE must not equate Quantity to ATP; ATP is Quantity minus ReservedQuantity.

## 3. Authentication

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/Auth/login | S / anonymous | Body: required `username`, `password`. | 200 `R<{token,username,role,fullName}>`. | 400 validation;401 invalid/inactive account. | Issues signed JWT; no refresh-token/session resource returned. | Set `Authorization: Bearer <token>` on protected calls; derive role/UI gates from returned role and token. |
| POST | /api/v1/Auth/logout | S / AUTH | Body `LogoutRequest` has `token` string; send current token, plus Authorization header. | 200 `R<bool>`. | Global auth/binding errors. | Handler returns success; **no token revocation/blacklist**. | Clear FE token/cached private state. Captured JWT remains valid until configured expiry; no routed refresh-token endpoint. |

JWT contains user GUID/name/role/email and exp; lifetime comes from server `JwtSettings:ExpiryInDays` (service fallback7 days). Login response has no user `id` or `expiresAt` property: use JWT subject/nameidentifier and exp if needed. Server validates issuer/audience/signature/lifetime with zero clock skew. Role/password/deactivation changes do not revoke already-issued tokens through a separate session subsystem. Never log tokens/passwords or put credentials in URLs.

## 4. Dashboard: operational, executive and planning are distinct

Response contracts:

- `ChartPoint`: `dateUtc,inboundQuantity,outboundQuantity` (long totals); days1..365, zero-filled UTC daily series.
- `WarehouseOccupancy`: `warehouseId,warehouseCode,warehouseName,binCount,totalCapacity,currentOccupancy,occupancyPercentage` (nullable percentage).
- `Executive`: `warehouse,inventory,inboundReceiptsByStatus,outboundOrdersByStatus,aiInsight`.
- `warehouse`: `totalProducts,totalActiveBins,globalOccupancyRate,lowStockAlerts[{productId,sku,productName,currentStock}],recentTransactions[{sku,transactionType,quantityChanged,location,createdAt}]`.
- `inventory`: `totalProducts,totalQuantity,lowStockItems`.
- `aiInsight`: `totalProducts,totalBins,overallOccupancyPercentage,aiExecutiveSummary,aiAvailable,aiErrorCode`.
- `AgentMetrics`: `recurringJobId,isRegistered,registeredAtUtc,cron,timeZoneId,lastScheduledExecutionAtUtc,nextScheduledExecutionAtUtc,lastJobId,lastJobState`; absent job yields false/null fields, not invented executions.
- `Slotting`: array of `sku,productName,currentZone,suggestedZone,velocityClass,aiReasoning`.

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| GET | /api/v1/Dashboard/inbound-outbound-chart | S / AUTH | Operational chart; optional `days=7`, range1..365. | 200 `R<ChartPoint[]>`. | 400 invalid days. | Read-only ledger aggregation; no state transition. | Refetch after receive/pick; transfer/kit movements are not outbound demand. |
| GET | /api/v1/Dashboard/warehouse-occupancy | S / AUTH | Operational occupancy; no input. | 200 `R<WarehouseOccupancy[]>`. | No special business rejection. | Read-only warehouse/bin aggregate. | Refetch after physical moves/corrections; not automatically scoped to user's warehouse. |
| GET | /api/v1/Dashboard/ai-agent-metrics | E / AUTH | Existing scheduler visibility; no input. | 200 `R<AgentMetrics>`. | Hangfire storage failure can become500; no bespoke AI fallback. | Reads recurring-job metadata, does not run AI. | Poll conservatively if shown; needs working Hangfire storage, not live Gemini availability. |
| GET | /api/v1/Dashboard/executive | E / AM | Warehouse-wide executive view; no query/body. | 200 `R<Executive>`, including core data with AI unavailable. | Core failures still propagate; provider failure usually becomes fallback, not502. | Read-only SQL + optional AI insight. | Check `data.aiInsight.aiAvailable`; display core even when false, summary empty and `aiErrorCode:"AI_UNAVAILABLE"`. Staff403 before AI. |
| GET | /api/v1/Dashboard/ai-slotting-recommendations | E / AM | Planning advice; optional query `zoneId` GUID. | 200 `R<Slotting[]>`. | 400 invalid/inactive scope or no eligible30-day outbound data;502/503/504 dependency. | Reads positive active stock and scoped outbound demand; **does not move stock**. | Show advice only. No silent execution button backed by an invented slotting mutation endpoint. |

There is no routed `/Dashboard/warehouse-dashboard`, `/Dashboard/insight` or separate executive-insight HTTP endpoint despite internal query/DTO classes. Ordinary operational cards and executive access have different roles; do not make Staff executive access depend on whether a screen exists.

## 5. Inbound B1 and put-away

Usable flow: create/list/detail → receive deltas → put-away suggestion → inventory transfer. Receipt `binId` is the actual receiving destination; receiving already adds physical stock there. Suggestion is read-only and does not move a receipt. Transfer moves inventory between bins, without a separate receipt-putaway task lifecycle.

Request contracts (unmarked optional fields can be omitted; required fields marked **R**):

- **InCreate**: **R** `receiptNumber` (nonempty <=50), `supplierId`, `binId`, `expectedDeliveryDate` (>=UTC today), nonempty `items[]`; each **R** `productId,expectedQuantity>0`; optional `lotNumber,expirationDate`; optional header `referenceDocument,notes`. Source stores blank lot as `N/A`; for supported None/Lot flows send an explicit consistent lot rather than relying on that fallback.
- **InUpdate**: **R** `id`, nonempty `items[{productId,expectedQuantity>0}]`; optional `binId,supplierId`; send current `expectedDeliveryDate,referenceDocument,notes` explicitly. No receipt-number, item-ID, lot or expiry update field. Retained unique product lines keep their IDs/metadata; duplicate existing product lots cannot be disambiguated. Adding a new Lot line cannot supply lot/expiry through this DTO: use correct creation workflow, not an invented field.
- **Receive**: **R** `inboundReceiptId`, nonempty `receivedItems[{itemId,quantityReceived,expectedReceivedQuantity}]`. `quantityReceived` is a **positive DELTA**, not cumulative. `expectedReceivedQuantity` is required, nonnegative, taken from latest detail's `quantityReceived`. A batch may include selected lines, but no duplicate item ID, foreign detail or over-receipt.
- **Receipt** response: `id,receiptNumber,status,expectedDeliveryDate,referenceDocument,notes,binId,createdAt,createdBy,supplierId,supplierName,items[]`; item fields `id,productId,productName,quantityExpected,quantityReceived,lotNumber,expirationDate`.
- Receipt **detail** maps those items; paged projection leaves items empty, and `/list` also leaves binId at its defaultnull. Do not use list defaults as evidence that the actual receipt has no bin/lines; fetch by ID before edit/receive.
- **Putaway** response: `binId,binCode,zoneName,availableSpaceBeforePutaway`.

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/InboundReceipts | C / AMT | Create header/details; body InCreate. | 200 `R<Guid>` receipt ID. | 400 duplicate number/invalid bin/validation; invalid references can also surface storage errors. | Creates **New** receipt, quantityReceived0; no physical stock yet. | Refetch receipt/list; retain returned ID. Actual broad Staff planning permission remains a policy decision. |
| GET | /api/v1/InboundReceipts | C / AMT | Paged monitor; query `pageNumber=1,pageSize=10,searchTerm?`. | 200 `Page<Receipt>`. | 400 invalid paging. | Read-only. | Refresh on create/update/delete/receive. |
| GET | /api/v1/InboundReceipts/list | C / AMT | Lookup/filter; `supplierId?,status?,searchKeyword?`. | 200 `R<Receipt[]>`. | 400 invalid filters/binding. | Read-only. | Use current status from response, not a guessed Pending initial state. |
| GET | /api/v1/InboundReceipts/{id:guid} | C / AMT | Detail; required path `id`. | 200 `R<Receipt>`. | **400** missing receipt in current handler. | Read-only. | Required immediately before receive, and after409. |
| PUT | /api/v1/InboundReceipts/{id:guid} | C / AMT | Edit unreceived header/lines; path ID equals InUpdate.id. | 200 `R<bool>`. | 400 state/metadata ambiguity/mismatch;409 concurrent update. | Allowed New/Pending/Draft with no received quantity; preserves retained detail metadata. | Refetch detail/list. Not PATCH; omitted optional header fields can clear/reset values. |
| DELETE | /api/v1/InboundReceipts/{id:guid} | C / AMT | Delete untouched receipt; required path `id`. | 200 `R<bool>`. | 400 missing receipt or state !=New. | Deletes New receipt/header/details; not received-stock reversal. | Refetch list; stop editing removed receipt. |
| POST | /api/v1/InboundReceipts/confirm-receipt | C / AMT | Execution; body Receive. | 200 `R<bool>`. | 400 over-receipt/capacity/unsupported Serial/LPN metadata;409 stale precondition/state/occupancy/concurrency. | New/Pending/Processing → Processing or Completed; adds physical stock/occupancy, INBOUND ledger/audit atomically. | Refetch detail, inventory, relevant bins, history, charts/occupancy. Stale retry409 must not add twice. |
| GET | /api/v1/InboundReceipts/putaway-suggestion | C / AMT | Read recommendation; required `sku`, `quantity>0`. | 200 `R<Putaway>`. | 400 unknown SKU/no matching capacity/validation. | No movement or reservation. | Suggestion uses name-based Dry/Cold zone heuristic, not a locked or reserved destination. Revalidate by actual transfer result. |
| POST | /api/v1/InboundReceipts/scan-invoice | E / AMT | Multipart **file**; image rules in AI section. | 200 custom `{isSuccess,data:{SupplierName,InvoiceNumber,InvoiceDate,Items[]}}`. | 400 image validation;502/503/504 provider/schema. | OCR advice only; creates no receipt/inventory. | Review extracted lines and map SKU/product/supplier IDs before InCreate. No automatic receipt import. |
| POST | /api/v1/InboundReceipts/report-damage | E / AMT | Multipart **file** image. | 200 custom `{isSuccess,analysis:{DamageType,Severity,DamageDescription,ActionRecommended},generatedAt}`. | 400 image validation;502/503/504 provider/schema. | Analysis only; **does not set inventory Damaged**. | Display advice; managerial change-status is a separate protected command. |
| POST | /api/v1/InboundReceipts/process-crossdock | P / AMT | Legacy body `productId,incomingQuantity>0,sourceDockCode` (default RECEIVING_DOCK). | Legacy200 `R<{productId,totalIncomingQuantity,crossDockedQuantity,remainderForPutaway,executionSummary}>`. | 400 invalid input;409 when pending direct-pick B3 lines exist. | Legacy line matching/splitting + TRANSFER ledger; no stable receive/reserve/ship integration. | **Do not integrate execution.** A no-match200 can be a no-op, not an inbound receipt/put-away. |

B1 supports None/Lot quantity receiving, rejects Serial products, expired receipt stock and incompatible existing LPN/serial evidence. No request field receives or creates an LPN. Existing lot/expiry and tracking snapshots are checked and preserved on receive. Receipt/detail preconditions and atomic batch validation protect concurrent/replayed receives; post-commit notifications are best effort and do not replace a refetch.

## 6. Inventory control and Staff transfer/put-away

- **Adjust** body: **R** `binId,productId,adjustmentQuantity` (nonzero signed delta), `reasonCode`; `lotNumber` selector (supply the actual lot). Returns `R<bool>`.
- **Status** body: **R** `binId,productId,newStatus` (numeric InventoryStatus), `reasonCode`; `lotNumber` selector. This is managerial quarantine/hold/release, not a Staff scan confirmation.
- **Transfer** body: **R** `productId,sourceBinId,destinationBinId,transferQuantity>0`; `lotNumber` (actual source identity), optional `reason`. Source and destination must differ. Returns transfer ledger GUID, not a task/order ID.
- **StockHistory**: `id,productId,productName,transactionType,quantityChanged,sourceBinCode,destinationBinCode,reasonCode,createdAt,createdBy`.
- **TransferRow**: `id,productId,productName,sku,quantityTransferred,sourceBinCode,destinationBinCode,reasonCode,transferredAt,transferredBy`.

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| GET | /api/v1/Inventory/stock-summary | S / AUTH | Physical totals; no input. | 200 `R<{totalProducts,totalQuantity,lowStockItems}>`. | No special business rejection. | Read-only, active-product inventory aggregate. | Not an ATP/reserved balance; no warehouse filter. Refetch after physical mutation. |
| GET | /api/v1/Inventory/low-stock-alerts | S / AUTH | Global low stock; **no supported query filters**. | 200 `R<{productId,sku,productName,currentStock}[]>`. | No special business rejection. | Groups physical stock by active product, totals **<20**. | Products with no inventory rows are absent. This threshold differs from replenishment's bin20% rule. |
| GET | /api/v1/Inventory/stock-history | S / AUTH | Ledger; query `pageIndex=1,pageSize=10,productId?,transactionType?`. | 200 `Page<StockHistory>`. | 400 invalid query. | Read-only. | Reservation/release ledger deltas0 are not physical movement; transfer delta is positive moved units, not net stock creation. |
| POST | /api/v1/Inventory/adjust-stock | C / AM | Body Adjust. | 200 `R<bool>`. | 400 unsupported/ambiguous stock, negative/reserved/capacity violation;409 concurrency. | Signed quantity + occupancy change; ADJUSTMENT ledger/audit in transaction; can create missing Available row for positive delta. | Refresh inventory, bins, history, dashboards. Not a receiving, LPN or serial-reconciliation API. |
| POST | /api/v1/Inventory/change-status | C / AM | Body Status. | 200 `R<bool>`. | 400 missing/ambiguous stock;409 reservation/workflow/Reserved transition or concurrency. | Changes status; physical quantity/occupancy not deducted. STATUS_CHANGE ledger delta0; unchanged status succeeds without another change. | Refresh bin contents/status, summary/alerts/history. Do not expose arbitrary status control to Staff. |
| POST | /api/v1/Inventory/run-auto-replenish | S / AM | Global action; **no body, path or query inputs**. | 200 `R<int>` committed movement count. | 409 atomic conflict;401/403 auth; unexpected storage500. Unsupported/ineligible candidates can yield successful0. | Atomic state-based refill; detailed rules next section. | Refresh inventory/alerts/bins/history/occupancy. Staff403 before handler. |
| POST | /api/v1/InventoryTransfers | C / AMT | Staff move/put-away; body Transfer. | 200 `R<Guid>` transfer ledger ID. | 400 cross-warehouse/shortage/identity/metadata/capacity/Serial/LPN violation;409 concurrency. | ATP-safe physical source deduction + destination addition, occupancy, TRANSFER ledger/audit atomically. | Refresh both bins/inventory/history/transfer list. No request-idempotency key. |
| GET | /api/v1/InventoryTransfers | C / AMT | Paged history; `pageNumber=1,pageSize=10,productId?,searchKeyword?`. | 200 `Page<TransferRow>`. | 400 invalid query. | Read-only. | Refresh after transfer/refill if displayed. |
| GET | /api/v1/InventoryTransfers/list | C / AMT | Lookup; `productId?,searchKeyword?`. | 200 `R<TransferRow[]>`. | 400 invalid query. | Read-only. | Not a pending movement-task list. |
| GET | /api/v1/InventoryTransfers/{id:guid} | C / AMT | Required ledger path ID. | 200 `R<TransferRow>`. | **400** missing transaction. | Read-only. | Use returned transfer ID, not bin/inventory ID. |

Transfer uses Available ATP, preserves source lot/expiry, requires compatible destination metadata/capacity and supports None/Lot scope. It is not an LPN/Serial movement API. Source and destination **must belong to the same warehouse**, including moves between different zones in that warehouse. Cross-warehouse requests reject400 before stock/occupancy/ledger/audit mutation. This is internal movement, not inter-warehouse transfer or warehouse ACL. Stock-control endpoints must not be used as a backdoor LPN workflow even where generic legacy validation is broader than stable scope.

Bin-content DTO does **not** expose BinInventory ID, reservedQuantity or ATP. Obtain B3 reservation/source-inventory identity from order detail, not by fabricating it from bin contents. There is no public generic inventory-row/ATP-detail route in this controller.

### 6.1 Auto Replenishment — explicit FE integration contract

**`POST /api/v1/Inventory/run-auto-replenish` — STABLE — FE CAN INTEGRATE.** Roles `Admin,WarehouseManager`; Staff **403**. Recommended WebApp action: Inventory / Low Stock → **“Tự động châm hàng”**. A confirmation should state this is a global operation, not a refill limited to the currently selected product/bin; the route accepts no scope selector. Disable duplicate clicks while pending.

Actual command is `IRequest<Result<int>>`. Happy responses can be:

```json
{"isSuccess":true,"message":"Không có target cần replenishment.","error":null,"errors":[],"data":0}
```

```json
{"isSuccess":true,"message":"Đã commit 2 replenishment movements. Operation: ...","error":null,"errors":[],"data":2}
```

`data` is **number of movements**, not moved units, target bins or a task ID. Operation correlation is currently in `message`/ledger `reasonCode`, not a dedicated JSON field. Do not parse localized messages as protocol. A successful0 means **no eligible movement**, which may include insufficient ATP/metadata, capacity/hierarchy issues, donor rules or unsupported LPN/Serial; do not claim goods were moved. `isSuccess:false`/409/500 must never be presented as generic success.

Actual refill algorithm and limits:

1. Discovers **existing positive Available inventory rows** in active Storage bins with occupancy <=20% of capacity; not empty-bin slotting or product-level `<20` low-stock alerts.
2. Rechecks under deterministic bin/stock locks. Target must be unreserved, have no conflicting workflow, valid occupancy and supported None/Lot/no-LPN/no-serial evidence.
3. Uses **source ATP (`quantity-reservedQuantity`)**, never reserved balance. Available stock only; active **same warehouse**, same product/normalized lot and exact matching expiry. Expired/ambiguous stock is skipped.
4. Required refill is `floor(targetBin.maxCapacity-currentOccupancy)`. One donor must supply it; no partial refill or splitting across sources. Source selection uses ascending bin ID then stock ID (not a promised FEFO choice). Lot/expiry remain unchanged.
5. Checks source/target capacity and occupancy, prevents donors from immediately becoming eligible reverse-refill bins; quantity arithmetic is bounded. Newly eligible targets outside discovery wait for another invocation.
6. Commits all planned movements/occupancy/positive TRANSFER ledgers/audits once in one transaction, or rolls the batch back. Overlapping executions reload the filled target, giving0 or a clean conflict rather than duplicate refill for unchanged state. Later consumption can legitimately make a new refill possible.

After success refetch stock-summary, low-stock-alerts, relevant Bins contents/list/detail, warehouse-occupancy, stock-history and transfer history if shown. A lost response is not an instruction to blindly resend: inspect stock/history first. No immutable request-ID idempotency key, dry-run endpoint, per-product selector, Staff handheld trigger, LPN or Serial refill is offered.

## 7. Cycle Counting — role plus assignment

- **CountAssignee**: `id,username,fullName` only. `GET /CycleCounting/assignees` returns active Staff for Admin/WM; no email, role or security data.
- **CountCreate** is the exceptional command-shaped body: `{"requestData":{"binId":"<guid>","zoneId":null,"assignedUserId":"<guid>","notes":"..."}}`. At least one valid binId/zoneId is required; if both supplied, bin must belong to zone. Assignment is optional, but must reference an active user if present.
- **CountConfirm** directly: `countSheetId`, `notes?`, nonempty `countedItems[{itemId,countedQuantity}]`. Every sheet detail must occur **exactly once**; countedQuantity is required, >=0 and is the **final count**, not a delta.
- **CountSheet**: `id,sheetNumber,batchCode,zoneId,zoneName,binId,binCode,status,assignedUserId,notes,createdAt,createdBy,items[]`. Items: `id,binId,binCode,lotNumber,status,productId,productName,sku,systemQuantity,countedQuantity,variance`; pending counts/variance are null.
- **CountTask**: `countSheetId,itemId,sheetNumber,binId,binCode,lotNumber,systemQuantity,productId,sku,productName,abcClassification,scheduledIntervalDays,targetZone,priorityMessage`. Classification/schedule text is current presentation data, not an independent scheduling API.

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| GET | /api/v1/CycleCounting/assignees | C / AM | Staff assignment lookup; no input. | 200 `R<CountAssignee[]>`; empty array valid. | Staff403; anonymous401. | Read-only active Staff, ordered by username then ID. | Populate the WebApp assignee picker; use returned ID in CountCreate. Does not grant user management. |
| POST | /api/v1/CycleCounting/create-sheet | C / AM | Snapshot/assign scope; body CountCreate with requestData wrapper. | 200 `R<Guid>` sheet ID. | 400 unsupported/no stock/invalid active user/scope;409 ambiguous/stale stock conflict. | Creates Pending sheet/items with inventory ID/rowversion/quantity snapshots; no correction yet. | Retain ID, load detail; refresh assigned pending tasks. Staff403. |
| GET | /api/v1/CycleCounting/pending-tasks | C / AUTH, own assignments | Optional legacy `operatorName` is ignored for authorization. | 200 `R<CountTask[]>`. | 400 if actor has no valid GUID. | Read-only pending/counting tasks for **authenticated user**, including managers only when assigned to them. | Refetch after create/confirm/403. Cannot request another operator's tasks by name. |
| GET | /api/v1/CycleCounting/{id:guid} | C / AM override; T assigned only | Required path sheet `id`. | 200 `R<CountSheet>`. | 400 missing sheet;403 other/null assignment for Staff. | Read-only, ownership checked before DTO mapping. | On403 stop task, refresh own pending list; do not silently switch operator. |
| POST | /api/v1/CycleCounting/confirm | C / AM override; T assigned only | Body CountConfirm; all detail IDs from latest sheet. | 200 `R<bool>`. | 400 invalid/incomplete/unsupported rows;403 assignment;409 completed/stale snapshot/concurrency. | Pending/Counting → Completed, items Matched/Discrepancy; applies net quantity/occupancy correction + ADJUSTMENT ledgers/audit atomically. | Refetch sheet, pending tasks, inventory, bins, history/occupancy. |

Staff other-assignee/unassigned sheet =>403; own =>allowed. Admin/WM can access/confirm regardless of assignment. Confirm uses assignment from locked/reloaded sheet, not a stale EF entity, before correction/occupancy/ledger/audit. The current confirm operation **finalizes physical correction**, not an invented Staff-submit → manager-approve lifecycle. No separate approval API exists.

Snapshot mismatch409 means count evidence became stale. Refetch; do not resubmit edited values against a silently refreshed inventory snapshot or reuse a completed sheet. No cancel/reassign HTTP route, general sheet list or paginated cycle-controller route is exposed. Internal query/command classes are not FE APIs. Manager WebApp should retain created IDs/use known references; pending-tasks is not a global management listing. **Users list remains Admin-only**. Admin/WM populate the Staff assignee picker using `/CycleCounting/assignees` and submit the returned ID as assignedUserId. A manual/known GUID workaround is no longer required. This lookup does not grant WM user CRUD or change Staff ownership semantics.

## 8. Kitting K1

Body **KitAssembly** (direct, no requestData wrapper): required `kitProductId,targetBinId,assembleQuantity>0,components[]`; each component requires `componentProductId,sourceBinId,quantityPerKit>0`.

```json
{"kitProductId":"<kit-product-guid>","targetBinId":"<bin-guid>","assembleQuantity":2,"components":[{"componentProductId":"<component-guid>","sourceBinId":"<source-guid>","quantityPerKit":3}]}
```

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/Kitting/assemble | C / AM | Assemble requested recipe; body KitAssembly. | 200 `R<bool>`; no kit-order ID returned. | 400 shortage/lot ambiguity/unsupported LPN/Serial/expiry/capacity/input;409 concurrent conflict. | Consumes component ATP, adds kit stock; net occupancy, KITTING_ISSUE and KITTING_RECEIPT ledger/audit atomically. | Refetch component + kit inventory, participating bins/history/occupancy. Staff403. |

The kit is an ordinary active Product; **no stored BOM/component-definition or assembly-document API**. Request supplies the recipe. Need = assembleQuantity × quantityPerKit; duplicate bin/product requirements aggregate before checks, self-consumption and overflow reject. Source requires one unambiguous compatible Available row per bin/product: request has no lot or inventory-row selector. Multiple Available lots reject rather than choosing one. Reservations are not consumed; only ATP is usable.

Destination must be active and capacity-valid, considering net changes when component and kit share a bin. Existing compatible output row retains its lot/expiry; new output uses `KIT-yyyyMMdd` UTC with no expiry. This is **not component-to-kit expiry inheritance or genealogy**. LPN/Serial/expired/unsupported workflow rows reject. Repeating a successful request with enough stock assembles again; **no request-idempotency key**. On timeout/lost response reconcile inventory/history before another execution.

## 9. Outbound B3 — stable direct-pick only

Stable flow: **Pending → Allocated → Picked → Packed → Shipped**. One source bin/order, None/Lot, no LPN, whole-order allocation and pick. Physical inventory is deducted **at Pick**, never again at Pack/Ship. Legacy Wave/Serial are separate and not the FE route to this flow.

Request/response contracts:

- **OutCreate**: required `orderNumber` (nonempty<=50), `binId`, `expectedShipDate` (nonpast), nonempty `items[{productId,requestedQuantity>0}]`; optional `customerId,priority` (default Normal), `notes`.
- **OutUpdate**: required `id`, nonempty `items[{productId,requestedQuantity>0}]`; send current `expectedShipDate,priority,notes`, optional `customerId`; no source-bin or order-number update field. Only untouched Pending direct-pick orders are editable.
- **Allocate**: required `outboundOrderId`; **omit/null `assignedUserId`**, which direct-pick rejects if non-null. The route name says task but no assigned Staff pick task is created for B3.
- **Pick**: required nonempty `items[{reservationId,quantity}]`, **all active reservations exactly once with their full reserved quantities** from latest detail; route supplies order ID. No partial pick, stock-ID replacement or scan-count guessing.
- **Order**: `id,orderNumber,isDirectPick,customerId,customerName,binId,status,createdAt,createdBy,items[]`. Lines: `id,productId,productName,sku,quantity,isDirectPick,trackingModeSnapshot,reservedQuantity,pickedQuantity,shippedQuantity,status,reservations[]`. Reservation fields: `id,allocationId,sourceBinInventoryId,lotNumber,expirationDate,quantity,pickedQuantity,shippedQuantity,releasedQuantity,status`. Detail is authoritative; list projections may omit item/reservation detail. Response line `quantity` differs from request `requestedQuantity`.
- **Weight**: required nonempty `orderId` (legacy validator requirement), `sku,quantity>0,actualWeightGrams>0` (finite). The advisory handler does not load/validate the order identity. DTO also has legacy `actualWeight`; calculation uses **actualWeightGrams**, not actualWeight. Result: `isValid,expectedTotalWeightGrams,actualWeightGrams,deviationPercentage,statusMessage`.

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/OutboundOrders | C / AMT | Create order; OutCreate. | 200 `R<Guid>`. | **400** invalid/Serial/inactive product/bin/customer or duplicate order number. | New direct-pick Pending order/lines, no stock deduction/reservation yet. | Refetch order/list. WebApp planning action recommended AM; broad Staff permission is unresolved. |
| GET | /api/v1/OutboundOrders | C / AMT | Paged monitor; `pageNumber=1,pageSize=10,searchTerm?,customerId?`. | 200 `Page<Order>`. | 400 invalid query. | Read-only. | Refetch after workflow changes; use detail for progress/reservation payload. |
| GET | /api/v1/OutboundOrders/list | C / AMT | Lookup; `customerId?,status?,searchKeyword?`. | 200 `R<Order[]>`. | 400 invalid filters. | Read-only. | No invented wave/task ID required. |
| GET | /api/v1/OutboundOrders/{id:guid} | C / AMT | Required order path `id`. | 200 `R<Order>`. | 404 missing order. | Read-only. | Refetch after every transition and409; no B3 assignee ownership model. |
| PUT | /api/v1/OutboundOrders/{id:guid} | C / AMT | Path ID equals OutUpdate.id. | 200 `R<bool>`. | **400** mismatch/input/missing header/ineligible state;409 progress/history/concurrency conflict. | Replaces editable Pending line demand (legacy New/Draft accepted by handler); no physical movement. | Refetch order/list, don't edit Allocated/Picked orders. |
| DELETE | /api/v1/OutboundOrders/{id:guid} | C / AMT | Cancel via required order ID. | 200 `R<bool>`. | 400 invalid ID;404 missing;409 state/reservation inconsistency. | Pending/Allocated → Cancelled + soft-delete; releases reservations, no physical deduction. | Refetch list, inventory/reservation state/history. Picked/Packed reversal is outside scope. |
| POST | /api/v1/OutboundOrders/allocate-pick-task | C / AMT | Current B3 preparation; body Allocate. | 200 `R<bool>`. | 400 assignee/input;404 missing;409 shortage/state/identity/capacity/concurrency. | Pending → Allocated; ATP reserved across eligible None/Lot stock in source bin, FEFO by expiry then ID; physical unchanged. | Refetch detail/reservations and inventory/history; no second allocate on already-Allocated state. |
| POST | /api/v1/OutboundOrders/{id:guid}/pick | C / AMT | Execution; order path ID, body Pick. | 200 `R<bool>`. | 400 malformed/incomplete payload;404 missing;409 state/snapshot/metadata/replay/concurrency. | Allocated → Picked, consumes reservations and deducts physical/occupancy once, OUTBOUND ledger. | Refetch detail/progress, inventory, bins/history/charts. Duplicate pick409, not another deduction. |
| POST | /api/v1/OutboundOrders/{id:guid}/pack | C / AMT | Execution; order ID; **no body required**. | 200 `R<bool>`. | 400 invalid ID;404 missing;409 wrong/inconsistent state. | Picked → Packed, no physical deduction; same-target repeat can succeed without repeated side effects. | Refetch order; no separate staged-bin movement. |
| POST | /api/v1/OutboundOrders/{id:guid}/ship | C / AMT | Current dispatch; order ID; **body `{}`**. | 200 `R<bool>`. | 400 nonempty legacy packingChecks/input;404 missing;409 wrong/inconsistent state. | Packed → Shipped, finalizes progress; no second deduction, same-target repeat safe under consistency checks. | Refetch order/list and overview/history if shown. Staff admission preserved; release-policy decision remains open. |
| POST | /api/v1/OutboundOrders/validate-weight | C / AMT | Advisory validation; Weight body. | 200 `R<WeightResult>`, even `data.isValid:false`. | 400 invalid weight/SKU/quantity or missing product. | Read-only; does not pack, ship, persist a scale approval or deduct inventory. | Show isValid/deviation; do not treat HTTP200 as weight accepted. |
| POST | /api/v1/OutboundOrders/create-wave-pick | U / AMT | Legacy `outboundOrderIds[],wavePriority`. | Legacy string result is not a stable FE workflow. | 400 invalid set;409 for B3 direct-pick. | Legacy wave/grouping code exists; not B3 preparation. | **Do not integrate**; allocate each direct-pick order instead. |
| POST | /api/v1/OutboundOrders/pick-verify | U / AMT | Legacy serial DTO: `orderId,orderCode,productId,binId,serialNumber,scannedSerials[]`. | Legacy string-array result is not B3 support. | 400 legacy validation;409 on B3 None/Lot/direct-pick. | Legacy serial mutations exist; not certified stable end-to-end Serial receiving/allocation/shipping. | **Do not integrate** for current product scope. |

Weight formula: `(product.Weight >0 ? product.Weight : 250g) × quantity + 150g packaging`; deviation <=5% is valid. B3 Pack/Ship **do not enforce** this advice: shipping requires `{}`, and nonempty `packingChecks` is rejected as legacy Serial input. The existing Product create/update DTOs cannot set Weight. Do not invent a mandatory weight-approval token or configure weight through an unsupported field.

No direct-pick staff assignment, partial order picking, multi-source-bin order, staging relocation, pick/ship request-idempotency token or Picked/Packed cancellation/reversal API is offered. Use state/progress shown by order detail. Existing reservations can expose source lot/expiry; do not substitute product-level FIFO or independently select stock from the bin-content display.

## 10. Products and scanner

- **ProductCreate**: required `sku` (<=50), `name` (<=200); optional `barcode,description,unit` (default Pcs), `trackingMode` (default0), `width,height,depth`. Create handler does **not persist the dimensions**; no weight input. Embedding is best-effort within the existing bounded provider call before save; known provider/configuration/invalid-response/timeout failures do not prevent valid core creation.
- **ProductUpdate**: required `id,sku,name`; send current `barcode,description,unit` explicitly (unit default differs: Cái); nullable `trackingMode` preserves existing mode if omitted. No weight/dimension update fields. Mode change with stock, serial or open workflow dependencies rejects409.
- **Product** DTO fields: `id,sku,barcode,name,description,unit,weight,trackingMode`. **Paged/list/detail all map persisted barcode and weight**. Detail can supply supported fields for GET→edit→PUT without inventing an empty barcode. Weight is the actual stored gram value, including0 when unset; create/update still have no supported weight editor. Packing advice separately falls back to250g when stored weight<=0; product reads never substitute that fallback.
- **ParsedBarcode**: `productId,sku,productName,lotNumber,expirationDate,stockStatus` (default Available). This is product/label parsing, not verified stock availability/reservation.
- **SemanticHit**: `id,sku,name,description,similarityScore` (percentage).

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| GET | /api/v1/Products | C / AMT | Paged products; `pageNumber=1,pageSize=10,searchKeyword?`. | 200 `Page<Product>`. | 400 invalid query. | Read-only active products. | Maps persisted barcode/weight; never use pageNumber as an inventory selector. |
| GET | /api/v1/Products/list | C / AMT | Lookup/dropdown; `searchKeyword?`. | 200 `R<Product[]>`. | 400 invalid query. | Read-only. | Maps persisted barcode and weight. |
| GET | /api/v1/Products/{id:guid} | C / AMT | Required product path ID. | 200 `R<Product>`. | 404 missing product. | Read-only. | Use latest supported fields for GET→edit→PUT; no weight/dimension editor. |
| POST | /api/v1/Products | C / AMT | ProductCreate body. | 200 `R<Guid>` core creation, including unavailable embedding; message discloses degraded enrichment. | 400 input;409 detected duplicate SKU; unmapped unique-index/storage failures can be500. Known embedding failures do not become502/503/504 here. | Best-effort enrichment; saves Product with real768-dimensional finite/nonzero vector or null, then invalidates registry cache. No stock is created. | Refresh product list/detail/semantic display. Null vector products are omitted from semantic results; core success is not AI-success certification. Barcode uniqueness remains DB-constrained; Staff CRUD policy unresolved. |
| PUT | /api/v1/Products/{id:guid} | C / AMT | ID equals ProductUpdate.id. | 200 `R<bool>`. | 400 mismatch/input;404 missing;409 SKU/tracking dependencies. | Updates master data; no live embedding regeneration here. | Refresh products; semantic text vector can remain stale after description change. |
| DELETE | /api/v1/Products/{id:guid} | C / AMT, standalone unreferenced records only | Required product ID. | 200 `R<bool>`. | 400 binding;404 missing; referenced delete can fail500 via DB FK, no friendly409 mapping in this handler. | **Physical delete** through repository Remove; no inventory/history reversal. | Refresh lookup/list/semantic display. Do not build deletion of stocked/historical products as a supported cleanup workflow. |
| GET | /api/v1/Products/{sku}/qrcode | C / AMT | Required URL-encoded **SKU**, not product GUID. | 200 `R<string>` **data:image/png;base64,...**. | 400 invalid delimiter;404 no active SKU. | Read-only local QR generation. | Render data URI directly; not binary HTTP/image MIME. Encodes SKU:... followed by BARCODE:.... |
| POST | /api/v1/Products/parse-barcode | C / AMT | Body required `rawBarcodeData` (nonempty<=163). | 200 `R<ParsedBarcode>`. | 400 malformed/date/ambiguous code;404 unknown active product. | Read-only label resolution. | Use explicit prefix when SKU and barcode lookup would be ambiguous; does not receive/pick automatically. |
| GET | /api/v1/Products/semantic-search | E / AMT | Required query **`text`**, nonempty<=200, not searchText. | 200 `R<SemanticHit[]>`, empty array valid. | 400 validation;502/503/504 embedding. | Provider query embedding + memory registry; read-only SQL. | Show provider failure separately from no matches; no mutation to auto-retry. |

Accepted scanner forms are `SKU:<sku>`, `BARCODE:<barcode>`, QR `SKU:<sku>|BARCODE:<barcode>`, plain unambiguous SKU/barcode, and legacy `<sku>|<lot>[|yyyy-MM-dd]`. QR's barcode, if included, must match the same product. Blank legacy lot normalizes to LOT-DEFAULT; plain/prefixed lookups can return blank lot. Expiry parsed from labels is not proof that stock exists. Semantic search filters cosine>=0.65, returns percentage scores, rehydrates current names/SKUs, removes deleted identities and deduplicates IDs. Registry cache is process-local/single-database with a one-day lifetime, not tenant/database-namespaced; cached description vectors can become stale. Product creation evicts the registry after either enriched or degraded save. No synthetic vector, queue, job or on-read enrichment was added. Existing explicitly enabled seed/backfill may populate missing vectors when the provider works; H2 does not promise automatic eventual enrichment. Update still does not regenerate vectors; delete remains protected by semantic rehydration of current identities. None/Lot is the supported stock workflow scope even though master data exposes enum Serial2.

## 11. AI/external contracts and fallback

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/Chat/ask | E / AUTH | Body required `message`, nonempty<=2000. | 200 `R<string>` assistant answer. | 400 validation;502/503/504 dependency. | Read-only advisory; no inventory command execution. | Shared assistant; quota exposure remains documented. Never execute prose as an API command. |
| GET | /api/v1/Forecasts/demand-prediction | E / AM | Required query `sku`. | 200 `R<{sku,historicalMovements:[{date,quantity}],forecastedDemand:[{date,quantity}]}>`. | 400 insufficient90-day history/invalid input;404 product;502/503/504 provider/schema. | SQL-derived90-day outbound demand + validated future1..30-day forecast; no reorder/movement. | Staff403 before provider. Render forecast separately from historical data. |

The remaining external endpoints are catalogued once in their feature tables above; this matrix supplies their provider/fallback semantics:

| Capability | Roles | Live dependency | Failure/fallback |
|---|---|---|---|
| Chat | AUTH | Gemini text | 502/503/504; no synthetic successful answer. |
| Forecast | AM | Gemini text + valid SQL outbound history | 400 if no history; dependency/schema errors otherwise; no fabricated forecast. |
| Executive AI insight (inside executive route) | AM | Gemini text for summary only | Core can stay200, aiAvailable=false, aiErrorCode=AI_UNAVAILABLE, empty summary. Core SQL failure is not hidden as AI fallback. |
| Slotting | AM | Gemini text + scoped30-day outbound history/active stock | 400 no data;502 invalid model output;503/504 config/circuit/timeout. Recommendations do not execute transfers. |
| Semantic search | AMT | Gemini768-dimensional embedding | No silent keyword fallback. Empty result is valid; invalid vector/payload502. |
| Product creation enrichment | AMT | Best-effort embedding using existing bounded provider call | Core Product creation succeeds without an available vector; degraded message and null storage are truthful. Reconcile uncertain responses; no request-idempotency key. |
| Invoice OCR | AMT | Gemini image/text | 400 upload error;502 invalid business schema;503/504 dependency. No receipt creation. |
| Damage vision | AMT | Gemini image/text | Same dependency mapping; no stock status change. |
| Agent metrics | AUTH | Hangfire storage, not a Gemini inference | Missing recurring job =>200 false/null; inaccessible storage can fail500. |

Server config/key/model/quota/network are external setup. Production model defaults are empty; missing explicit configuration returns503. Development's explicit preview model does not certify production availability. Server HttpClient is capped at30 seconds for services; existing retry/backoff and circuit policy can make the overall request longer. Do not equate one click to one billable provider attempt or hammer retry on429-derived502.

Uploads: multipart key **file**; nonempty, <=5MiB; `.jpg/.jpeg` + image/jpeg, `.png` + image/png, `.webp` + image/webp; matching signature required. Filename must contain no slash/backslash. Signature validation is not a full image decoder. Let browser/FormData set multipart boundary.

OCR validates logical fields `SupplierName,InvoiceNumber,InvoiceDate` (`yyyy-MM-dd`) and nonempty `Items[{SKU,ProductName,Quantity>0,UnitPrice>=0}]`. Damage validates `DamageType,Severity` (Low/Medium/High), `DamageDescription,ActionRecommended`. Outer wrapper is camelCase; inner OCR/analysis is a raw validated JsonElement, so **provider property casing is preserved**, not guaranteed camelCase. Parse those logical names case-insensitively or normalize in FE's adapter. Do not assume a separate normalized OCR DTO or vendor/product GUIDs are returned.

F1 remains **PARTIAL** because final live evidence was89/93 with four provider429 quota/rate-limit failures. Deterministic1247/1247 does not turn those into live success. S1 and this documentation made no live Gemini calls.

## 12. Master/configuration, users, audit and export

These APIs support current WebApp configuration/lookups. Readiness is scoped to current validated contracts; access does not constitute a new Staff master-data policy decision. PUT is not PATCH: send the complete supported edit payload/current values, path `id` equal body `id`; omitted scalar strings/bools can overwrite with their DTO defaults. Successful writes use normal audit persistence, not physical inventory movement unless explicitly stated.

### 12.1 Warehouse / zone / bin contracts

| Contract | Required fields | Optional / response fields and limits |
|---|---|---|
| WCreate | `code,name` | `address`; no defaultStagingBinId on create. |
| WUpdate | `id,code,name` | `address,defaultStagingBinId`; omit defaultStagingBinId to preserve, explicit null clears. Non-null must be a valid active same-warehouse Staging bin. `defaultStagingBinIdSpecified` is JsonIgnore/internal, do not send. |
| Warehouse | Response | `id,code,name,address,defaultStagingBinId`. |
| ZCreate | `code,name,warehouseId` | Parent warehouse must exist/active. |
| ZUpdate | `id,code,name` | No warehouse reassignment field. |
| Zone | Response | `id,code,name,warehouseId`. |
| BCreate | `code,zoneId,maxCapacity>0` | `purpose` default Storage0; width/height/depth exist in DTO but are not persisted by handler. Occupancy starts0, not an input. |
| BUpdate | `id,code,maxCapacity>0` | Nullable purpose preserves when omitted; no zone reassignment field. Capacity cannot be below occupancy; purpose change is guarded against stock/workflow/staging dependencies. |
| Bin | Response | `id,code,zoneId,maxCapacity,currentOccupancy,purpose`. |
| BinContents | Response | `purpose,binId,binCode,maxCapacity,currentOccupancy,utilizationPercentage,items[{productId,sku,productName,lotNumber,quantity,expirationDate,status}]`. No inventory PK, reservation or ATP field. |

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| GET | /api/v1/Warehouses | C / AM | Paged warehouses; `pageNumber=1,pageSize=10,searchKeyword?`. | 200 `Page<Warehouse>`. | 400 invalid query. | Read-only. | Refresh after warehouse edits. |
| GET | /api/v1/Warehouses/list | C / AM | Lookup; `searchKeyword?`. | 200 `R<Warehouse[]>`. | 400 query validation if invalid. | Read-only. | Config/parent selection; Staff403. |
| GET | /api/v1/Warehouses/{id:guid} | C / AM | Required warehouse ID. | 200 `R<Warehouse>`. | 404 missing. | Read-only. | Refetch after editing default staging selection. |
| POST | /api/v1/Warehouses | C / AM | WCreate body. | 200 `R<Guid>`. | 400 invalid/duplicate code. | Creates warehouse. | Refresh warehouse lists/detail. |
| PUT | /api/v1/Warehouses/{id:guid} | C / AM | Path ID = WUpdate.id. | 200 `R<bool>`. | 400 missing header/duplicate/mismatch/input;404 missing staging bin;409 invalid staging scope/purpose. | Updates config; no relocation of existing workflows/stock. | Refetch warehouse; staging config is not physical B3 staging support. |
| DELETE | /api/v1/Warehouses/{id:guid} | C / AM | Required warehouse ID. | 200 `R<bool>`. | 400 missing/active-zone dependency. | Soft-delete only after active-zone guard. | Refresh warehouse/zone pickers; do not cascade physical stock cleanup. |
| GET | /api/v1/Zones | C / AM | Paged zones; `pageNumber=1,pageSize=10,searchKeyword?`. | 200 `Page<Zone>`. | 400 invalid query. | Read-only. | Refresh after zone edits. |
| GET | /api/v1/Zones/list | C / AM | Lookup; `searchKeyword?`. | 200 `R<Zone[]>`. | 400 invalid query. | Read-only. | Not filtered by warehouse query; use next route. |
| GET | /api/v1/Zones/warehouse/{warehouseId:guid} | C / AM | Required warehouse path GUID. | 200 `R<Zone[]>`. | 400 invalid ID; an empty set can be a valid lookup result. | Read-only. | Parent→child picker. There is no routed Zones/{id} detail action. |
| POST | /api/v1/Zones | C / AM | ZCreate body. | 200 `R<Guid>`. | 400 parent/duplicate/input. | Creates zone under warehouse. | Refresh warehouse-zone list. |
| PUT | /api/v1/Zones/{id:guid} | C / AM | Path ID = ZUpdate.id. | 200 `R<bool>`. | 400 mismatch/duplicate/input;404 missing zone. | Updates zone code/name. | Refresh zone/bin labels. |
| DELETE | /api/v1/Zones/{id:guid} | C / AM | Required zone ID. | 200 `R<bool>`. | 404 missing;409 bin or count-history references, including soft-deleted references/races. | Physical delete if unreferenced; history preserved by restriction. | Refresh zone and parent pickers; no destructive dependency cleanup. |
| GET | /api/v1/Bins | C / AM | Paged bins; `zoneId?,pageNumber=1,pageSize=10,searchTerm?`. | 200 `Page<Bin>`. | 400 invalid zone/paging; pageSize1..100. | Read-only. | Correct query is searchTerm, not searchKeyword here. |
| GET | /api/v1/Bins/list | C / AM | Lookup; `zoneId?,searchKeyword?`. | 200 `R<Bin[]>`. | 400 invalid query. | Read-only. | Correct query is searchKeyword for this route. |
| GET | /api/v1/Bins/{id:guid} | C / AM | Required bin ID. | 200 `R<Bin>`. | 404 missing. | Read-only. | Refresh after capacity/occupancy changes. |
| GET | /api/v1/Bins/{id:guid}/contents | C / AM | Required bin ID; method's AMT intersects controller's AM. | 200 `R<BinContents>`. | **400 BIN_NOT_FOUND** in current content handler, not mapped BIN_001404. | Read-only physical rows/display metadata. | Staff403. Do not widen access in FE or infer ATP from quantity. |
| POST | /api/v1/Bins | C / AM | BCreate body. | 200 `R<Guid>`. | 400 invalid hierarchy/duplicate/capacity/purpose. | Creates empty bin with occupancy0. | Refresh bins/occupancy, not inventory quantity. |
| PUT | /api/v1/Bins/{id:guid} | C / AM | Path ID = BUpdate.id. | 200 `R<bool>`. | 400 duplicate/mismatch/capacity;404 missing;409 purpose dependencies. | Changes config only; does not move stock. | Refresh detail/list/occupancy and staging config if shown. |
| DELETE | /api/v1/Bins/{id:guid} | C / AM | Required bin ID. | 200 `R<bool>`. | 400 existing stock;404 missing. | Soft-delete after stock guard. | Refresh bin pickers/layout. Not an inventory disposal action. |

Warehouse default staging and BinPurpose configuration exist, but the supported B3 direct-pick lifecycle intentionally has no staging-bin relocation. FE should not infer a usable staging/shipping subsystem from these configuration fields.

### 12.2 Customer / supplier contracts

- **CustomerCreate**: required `code,name`; optional `email,phone,deliveryAddress`. **CustomerUpdate** adds required `id`, same fields. A supplied nonempty email must be valid. Response **Customer** is `id,code,name,email,phone,address` (not deliveryAddress). Map explicitly on edit.
- **SupplierCreate**: required `code` (<=50), `name` (<=200); optional nullable `email` (valid if supplied, <=100), `phone` (<=20), `address`. **SupplierUpdate** requires `id,code,name`, supports `email,phone,address`. **Supplier** response is `id,code,name,email,phone,address`.

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| GET | /api/v1/Customers | C / AMT | Paged customers; `pageNumber=1,pageSize=10,searchTerm?`. | 200 `Page<Customer>`. | 400 invalid query. | Read-only. | Outbound customer picker/list. |
| GET | /api/v1/Customers/list | C / AMT | Lookup; no query inputs. | 200 `R<Customer[]>`. | No special business rejection. | Read-only. | No supported searchKeyword filter on this action. |
| GET | /api/v1/Customers/{id:guid} | C / AMT | Required customer ID. | 200 `R<Customer>`. | 404 missing. | Read-only. | Map response address→request deliveryAddress on edit. |
| POST | /api/v1/Customers | C / AMT | CustomerCreate body. | 200 `R<Guid>`. | 400 duplicate/validation. | Creates customer. | Refresh customer lookup/list. Actual Staff CRUD admission is unresolved product policy. |
| PUT | /api/v1/Customers/{id:guid} | C / AMT | Path ID = CustomerUpdate.id. | 200 `R<bool>`. | 400 mismatch/missing/duplicate/validation. | Updates customer; no outbound movement. | Refresh customer detail/list and displayed labels. |
| DELETE | /api/v1/Customers/{id:guid} | C / AMT | Required customer ID. | 200 `R<bool>`. | 400 missing or outbound-history dependency. | Soft-delete if not referenced by outbound history. | Refresh lookup/list; never delete dependent history to force success. |
| GET | /api/v1/Suppliers | C / AM | Paged suppliers; `pageNumber=1,pageSize=10,searchTerm?`. | 200 `Page<Supplier>`. | 400 invalid query. | Read-only. | Inbound supplier management. |
| GET | /api/v1/Suppliers/list | C / AM | Lookup; no query inputs. | 200 `R<Supplier[]>`. | No special business rejection. | Read-only. | Staff cannot obtain supplier directory through this controller. |
| GET | /api/v1/Suppliers/{id:guid} | C / AM | Required supplier ID. | 200 `R<Supplier>`. | 404 missing. | Read-only. | Populate edit/current selection. |
| POST | /api/v1/Suppliers | C / AM | SupplierCreate body. | 200 `R<Guid>`. | 400 validation;409 duplicate code. | Creates supplier. | Refresh supplier lookup/list. |
| PUT | /api/v1/Suppliers/{id:guid} | C / AM | Path ID = SupplierUpdate.id. | 200 `R<bool>`. | 400 mismatch/missing/duplicate/input. | Updates supplier. | Refresh detail/list. |
| DELETE | /api/v1/Suppliers/{id:guid} | C / AM | Required supplier ID. | 200 `R<bool>`. | 400 missing/inbound-history dependency. | Soft-delete if no receipt history. | Refresh lookup/list; not receipt deletion/reversal. |

Staff receiving works with an existing receipt, despite no Staff warehouse/bin/supplier configuration directory access. Future handheld should execute known task/receipt identities rather than require global management pickers. No mobile routing, execution-task directory or warehouse ACL is delivered by this API handoff. The H2 cycle assignee lookup is limited to active Staff and Admin/WM admission.

### 12.3 Users / audit / report

- **UserCreate** is a direct command body, no requestData: required `username` (3..50), unique `email`, `password` (>=6), `firstName,lastName` (<=50), `role` (`Admin`, `WarehouseManager`, `Staff`). Username/email uniqueness is validated; new user IsActive=true. Do not log the payload.
- **UserUpdate** direct command: required `id,firstName,lastName,role`; send intended `isActive` explicitly (missing bool defaultsfalse); optional `newPassword` (if nonblank >=6). No username/email update field. Legacy validator also permits `Worker`; **do not introduce Worker as a fourth supported FE role**, since S1's role policies use the three canonical roles. This mismatch is documented, not fixed here.
- **User** response: `id,username,firstName,lastName,fullName,role,isActive,email` (never PasswordHash).
- `/Users/list` maps fullName but leaves firstName/lastName at DTO defaults; use by-ID detail for an edit form. Paged users and by-ID detail map the separate names. Do not overwrite names using dropdown-projection defaults.
- **Audit**: `id,userId,type,tableName,dateTime,oldValues,newValues,affectedColumns,ipAddress`; type C/U/D; old/new values are nullable JSON-encoded **strings**, not pre-parsed objects. Dates/IDs/column strings are display/filter context, not permission grants.

| Method | Route | Readiness / roles | Purpose / input | Response / happy status | Business rejection | State / DB effect | FE refresh / limitations |
|---|---|---|---|---|---|---|---|
| GET | /api/v1/Users | C / A | Paged accounts; `pageNumber=1,pageSize=10,searchKeyword?`. | 200 `R<{totalRecords,totalPages,items:User[]}>`. | 400 invalid query. | Read-only. | Special paging shape; WM/Staff403. |
| GET | /api/v1/Users/list | C / A | Directory; no input. | 200 `R<User[]>`. | No special business rejection. | Read-only. | General directory remains Admin-only; WM uses CycleCounting/assignees for assignment. |
| GET | /api/v1/Users/{id:guid} | C / A | Required user ID. | 200 `R<User>`. | **400** missing user in legacy handler. | Read-only. | No public current-user/profile endpoint is implied. |
| POST | /api/v1/Users | C / A | Direct UserCreate command. | 200 `R<Guid>`. | 400 validation/username/email uniqueness. | Creates active account with hashed password and audit. | Refresh user list/directory; never echo password. |
| PUT | /api/v1/Users/{id:guid} | C / A | ID equals UserUpdate.id. | 200 `R<bool>`. | 400 mismatch/missing/input. | Changes role/active/name/password as supplied; no JWT revocation mechanism. | Refresh user list/detail. Existing token claims can remain until expiry; no automatic permission refresh promise. |
| DELETE | /api/v1/Users/{id:guid} | C / A | Required user ID. | 200 `R<bool>`. | 400 missing/protected admin username;409 any count/pick assignment history/reference race. | Physical delete only if unreferenced; audit retained. | Refresh users; use isActive=false for referenced accounts, not history deletion. |
| GET | /api/v1/AuditLogs | C / A | Query `pageNumber=1,pageSize=20`. | 200 `Page<Audit>`. | 400 invalid query. | Read-only sensitive audit data. | Refresh after mutations when displayed; no table/user/date filters are routed. |
| GET | /api/v1/Reports/export/excel | C / AM | No input; download current bin capacity/occupancy report. | 200 **binary XLSX**, spreadsheet MIME, generated BaoCaoTonKho_*.xlsx filename. | 400 with plain error message if no bins;500 unexpected export/storage. | Read-only, no inventory mutation. | Use blob/download handling; this is a bin occupancy report, not SKU/lot ledger export and not R<byte[]> JSON. |

## 13. Unsupported/deferred workflows and infrastructure boundaries

| Capability | Classification | Exact current capability / FE boundary |
|---|---|---|
| LPN | **UNSUPPORTED — DO NOT INTEGRATE** | BinInventory.LpnCode string and internal prototype MoveLpn exist, not an LPN header/lifecycle. No routed public LPN create/receive/attach/whole-LPN transfer/reserve/pick/ship contract. Stock uniqueness/grouping cannot certify LPN atomicity. Do not build an LPN screen around generic stock actions. B4 remains a preserved audit, not an implementation. |
| End-to-end Serial | **UNSUPPORTED — DO NOT INTEGRATE** | Product master enum2 and legacy serial mutation code exist; B1 receive and B3 direct-pick do not support Serial. Legacy pick-verify/ship are not a certified serial subsystem. |
| Wave / legacy pick tasks | **UNSUPPORTED — DO NOT INTEGRATE** | create-wave-pick rejects direct-pick B3 with409; legacy wave/task fields and internal entities do not supply a stable FE execution contract. Use per-order allocation. |
| Cross-dock | **PARTIAL / DEFERRED** | process-crossdock can match/split legacy pending lines and write positive TRANSFER ledgers; direct-pick pending lines reject409 before mutation. No-match200 returns remainder only. It does not safely replace B1 receive + B3 reserve/pick/ship, and does not automatically put away the remainder. |
| Physical staging / reversal | **PARTIAL / DEFERRED** | Staging-purpose/default-bin configuration exists; B3 uses no physical staging move. Picked/Packed cancellation/reversal is not implemented in the stable lifecycle. |
| Global cycle listing/reassignment | **PARTIAL / DEFERRED** | Internal DTOs/handlers are not routed. Only create, own pending tasks, by-ID detail and confirm are public. No manager-wide sheet listing or reassignment endpoint to guess. |
| Advanced master edits | **PARTIAL / DEFERRED** | No BOM persistence, product-weight/dimension edit, LPN grouping or Stock/Serial disposal workflow is provided. Barcode/weight read projections are consistent after H2. Basic documented lookup/edit scope remains usable. |

Infrastructure is **SYSTEM/INFRA**, not a WebApp warehouse workflow:

- `/hubs/inventory` / SignalR negotiate: authenticated; existing realtime events can help invalidate UI (`ReceiveInventoryUpdate`, `RefreshDashboardMetrics`, `ReceiveSystemAlert`, connection status). Do not assume per-assignee or warehouse-private event isolation. Always refetch authoritative REST state after mutations; delivery is not a transaction receipt. A mobile app is not implied.
- `/healthz`: anonymous health endpoint; GeminiHealthCheck hardcodes an external Google models request. **Do not poll it from FE as a harmless local heartbeat** or use it to probe quota repeatedly. `/health` is not an alias. Production behavior/deployment needs a separate decision.
- `/hangfire` and dashboard subroutes: local-only Hangfire filter, **not JWT roles**. Same-machine reverse proxy can appear local; proxy/network protection is required at deployment. Do not embed/expose publicly to make an Admin screen work.
- `/openapi/v1.json` and `/swagger`: Development only. Useful for local contract inspection, not an always-available production FE API.

H2 does not change health, proxy, Hangfire or existing endpoint role/ownership policies. The new count-assignee lookup is Admin/WM only.

## 14. Mutation refresh and retry map

Refetch only endpoints the current actor can call; in particular Staff cannot use Bins contents despite preserving execution APIs. If a future handheld needs extra scoped lookup data, that is a product/backend contract decision, not a reason to call management routes with another user's token.

| Successful action | Refetch / invalidate | Retry and state rule |
|---|---|---|
| Warehouse/zone/bin/customer/supplier/user create/edit/delete | Corresponding list/detail/lookups; hierarchy/labels and audit if visible. | Respect dependent-history errors; do not turn DELETE into a cascade cleanup. |
| Product create/update/delete | Product list/detail, dropdowns, semantic result view; beware description-vector staleness on update. | Create tolerates known embedding failure; reconcile uncertain core-create outcomes before attempting another creation. |
| Inbound create/update/delete | Receipt list/detail, retained created IDs; receiving task view where available. | Do not auto-recreate on timeout just because no response ID was observed. |
| Receive | Receipt detail/counters, stock-summary, low-stock-alerts, affected bins, stock-history, warehouse occupancy/chart. | Reload expectedReceivedQuantity; old delta409 must not be blindly resent. |
| Transfer / put-away | Source and destination bins/content/occupancy, inventory/alerts, stock-history and transfer history. | **No request-ID idempotency**: repeated success moves again. Reconcile unknown outcomes. |
| Adjust stock | Inventory, selected bin contents/occupancy, history, dashboard. | Signed delta can apply again; no blind retry. |
| Change status | Bin contents/status, inventory/alerts/history, held-stock displays. | Read current status after conflict; unchanged-state success is not a separate mutation. |
| AutoReplenishment | Stock-summary, low-stock-alerts, relevant bins/content/occupancy, transaction/history/transfer list. | State re-evaluated under locks;0 is legitimate. Read before retry after uncertain outcome; no immutable request key. |
| Count create | Created sheet detail and assigned pending-tasks; retain returned sheet ID. | No global cycle-list endpoint. Repeated create can create another snapshot sheet. |
| Count confirm | Sheet, own pending-tasks, inventory, affected bins, history/occupancy. | 403 stops execution;409 requires authoritative reload/new count decision; completed replay is conflict. |
| Kit assemble | Component and kit inventory, participating bins/occupancy, history, dashboard. | **No request-ID idempotency**: successful repeat assembles another batch. |
| Outbound create/update | Order list/detail; pick payload not prepared until allocation detail is loaded. | Preserve returned IDs; don't edit after preparation. |
| Outbound allocate | Order detail, per-line/reservation progress, inventory/reserved view and history. | No physical deduction; repeated allocation conflicts. |
| Outbound pick | Order detail, inventory/reservation progress, bins, history, dashboard/chart and task state derived from order. | Whole-order payload; duplicate pick409, no silent partial retry. |
| Outbound pack/ship | Order detail/list/progress and summaries/history if shown. | No second physical deduction. Same-target repeat can succeed if consistent; not arbitrary cross-state replay. |
| Outbound cancel | Order list, reservations/progress, inventory/history. | Only Pending/Allocated; releases reserved balance without reversing physical pick. |
| AI OCR/damage/chat/forecast/slotting/semantic | Advisory result view only; no automatic stock refetch needed unless user separately executes a real mutation. | Failures are dependency/business states; use deliberate read retry and quota-aware UX. |
| Logout | Clear private FE state/session caches. | Server does not revoke the JWT. |

These commands have no general request-idempotency middleware. Disable duplicate submissions for mutations, but browser click prevention is not an exactly-once guarantee. Distinguish definite400/403/409 rejection from lost response/timeout after a possible commit. Inspect detail/inventory/history before the user decides to resend.

## 15. Suggested WebApp screens/actions (integration guidance only)

| Surface / action | Audience | Backing capability | FE boundary |
|---|---|---|---|
| Login/logout | Shared | Auth | Bearer session; clear token locally on logout. |
| Inventory → “Tự động châm hàng” | **Admin/WM** | run-auto-replenish | Global confirmation, movement-count/zero/error UX, refresh map above. |
| Inventory → adjustment/status management | **Admin/WM** | adjust-stock/change-status | Require reason, actual lot identity and conflict handling; no Staff global correction. |
| Inventory visibility/history | Shared API; primary WebApp AM | summary/alerts/history | Physical totals, not a fabricated ATP view. |
| Cycle Count → create/assign | **Admin/WM** | assignees/create-sheet/by-ID detail | AM active-Staff picker; no general sheet list/reassign endpoint. |
| Cycle Count → execute assigned count | **Staff/future handheld**, AM override | own pending/detail/confirm | Ownership and409 snapshot UX, not a two-stage approval UI. |
| Kitting → assemble kit | **Admin/WM** | K1 request-defined assembly | Input recipe; no stored BOM/assembly-order management. |
| Outbound → allocation / monitor | **Admin/WM recommended**, actual AMT API | create/detail/allocate | Show B3 direct-pick progress/reservations; no Wave button. |
| Receive / move / pick / pack / scan / damage | **Staff/future handheld**, AM execution possible | B1/transfer/B3/scanner/vision | Preserve execution rights; no claim handheld client exists. |
| Dispatch/ship confirmation | Actual AMT; WebApp operator AM | B3 ship | Current Staff permission preserved; dispatch-release product policy remains unresolved. |
| Operational dashboard | Shared AUTH API; WebApp AM | chart/occupancy | Data scope is currently global, not warehouse ACL. |
| Dashboard → executive / slotting AI | **Admin/WM** | executive/slotting | Fallback and provider state; slotting advice does not move stock. |
| Product → semantic search | Shared AMT | semantic-search | Embedding availability and empty-result UX. |
| Product master creation | AM recommended; actual AMT | Products POST | Core creation tolerates unavailable enrichment; disclose semantic omission and respect unsupported weight/dimension editing. |
| Warehouse/zone/bin/supplier configuration; report export | **Admin/WM** | Management controllers/report | Bin contents Staff403; no physical staging/LPN execution promise. |
| Customer configuration | AM recommended; actual AMT | Customers | Staff master policy remains documented, not broadened by FE guidance. |
| User/role management and audit | **Admin only** | Users/AuditLogs | Canonical three roles; no Worker UI, no JWT revocation promise. |

## 16. Final readiness summaries

### FE READY NOW

| Feature | Integrable scope |
|---|---|
| Authentication | Login, bearer use and local logout handling. |
| Inventory | Physical summary, low-stock alerts, paged history; managerial adjust/status; Staff-supported quantity transfer. |
| AutoReplenishment | Stable global AM action, movement count/no-op/conflict handling. |
| Inbound B1 | Header/detail CRUD in documented states, delta receiving, suggestion + explicit transfer/put-away. |
| Cycle Counting | AM active-Staff assignee lookup, snapshot create, own pending tasks, by-ID detail and assigned Staff confirm with AM override. |
| Kitting K1 | Atomic request-defined None/Lot recipe assembly, ATP/capacity/lot checks. |
| Outbound B3 | One-source-bin whole-order None/Lot allocation → pick → pack → ship, reservation detail and advisory weight validation. |
| Products/scanner | Product core creation, persisted barcode/weight reads, QR data URI and barcode parsing; master editing within actual DTO limits. |
| Management/reporting | Warehouse/zone/bin/customer/supplier/user contracts, Admin audit, bin-occupancy XLSX export. Referenced Product delete remains outside safe cleanup scope. |
| Operational dashboard | UTC daily chart and warehouse occupancy. |

### ROLE-CONSTRAINED

| Constraint | FE action |
|---|---|
| Six S1 control endpoints | AM only: inventory adjust/status/replenish, cycle create, executive, slotting. |
| Count ownership | Staff own assigned sheet only; other/null403; AM override. |
| Kitting/Forecast/management controllers | Respect actual AM class roles. |
| Users/Audit | General user management/audit Admin only; count assignees has its own AM lookup. |
| Bin contents | Effective AM due to class/method intersection; method's Staff text alone is insufficient. |
| Broad Staff master/planning/ship/read admission | Current permissions retained; unresolved product policy remains documented. Do not infer warehouse ACL. |

### AI/EXTERNAL

| Feature | Integration requirement |
|---|---|
| Chat / Forecast / Slotting / Semantic / OCR / Damage | Contract-ready with server model/key/quota/network dependency; handle502/503/504 and schema rejection. |
| Product embedding enrichment | Best-effort; unavailable vector does not reject otherwise-valid core Product creation. |
| Executive | Core may remain200 while aiAvailable=false; show fallback explicitly. |
| Agent metrics | Hangfire storage-backed metadata, not proof that Gemini executed successfully. |

### DO NOT INTEGRATE YET

LPN lifecycle; end-to-end Serial; legacy Wave/serial execution; cross-dock fulfillment beyond documented P behavior; physical staging/reversal; global count listing/reassignment; inferred stored BOM/weight-editor/ATP-detail endpoints. Infrastructure health/Hangfire exposure is a separate deployment decision.

## 17. Verification basis and source index

Historical checkpoint evidence below remains unchanged. H2 adds new focused/regression evidence from isolated fixtures and controlled providers; no live Gemini calls. H2 source and evidence are uncommitted, with scope and commands recorded in [H2 report](PHASE_H2.md):

| Checkpoint | Verification / meaning |
|---|---|
| K1 `d4add410edcc80b2fc87a7f678a18df0e66ccb3c` | Focused127 + HTTP15; assembly ATP/lot/capacity/concurrency/rollback. [K1 report](PHASE_K1.md), verification/KittingK1. |
| R1 `54695729aadbe7753671e0eee00cf4e80734af21` | Focused136 + HTTP26; refill metadata/ATP/capacity/concurrency. [R1 report](PHASE_R1.md), verification/ReplenishmentR1. Historical Staff200 assertion is superseded by S1 Staff403; original R1 artifacts remain unchanged. |
| F1 `ead3c3a0b3cfd53a8248fe49062023686d671fc0` | Deterministic1247/1247, regression884/884, 96 controller routes. Newman119 requests/275 assertions includes explicit expected400/409 cases; not119 successful business mutations. Final live89/93 retains four Gemini429 failures. [F1 final report](PHASE_F1_FINAL_VERIFICATION.md), verification/AcceptanceF1/FinalVerificationEvidence.json. |
| S1 `539dc542314a46207cd98313e89d04165ebed9a5` | Focused588/588, F1 relevant51/51, regression884/884, precommit ownership24/24, 79 recorded role/ownership cases and285 invalid-JWT route checks. No live Gemini. [S1 role matrix](PHASE_S1_ROLE_MATRIX.md), verification/AuthorizationS1/VerificationEvidence.json. |

S1 evidence uses explicit fixture doubles and owned SQL databases. Its ignored-mirror adapter supplies the new actor constructor to historical Phase4B without modifying that repository artifact, and explicitly replaces R1's obsolete Staff200 expectation with403/no-mutation. These adapters do not claim all policies or external availability are resolved.

Source-of-truth navigation for maintainers (S1 baseline plus the H2 worktree changes described above):

- Routed bindings/roles: [controllers](../SmartWMS.Api/Controllers), especially [Inventory](../SmartWMS.Api/Controllers/InventoryController.cs), [CycleCounting](../SmartWMS.Api/Controllers/CycleCountingController.cs), [InboundReceipts](../SmartWMS.Api/Controllers/InboundReceiptsController.cs), [OutboundOrders](../SmartWMS.Api/Controllers/OutboundOrdersController.cs), [Products](../SmartWMS.Api/Controllers/ProductsController.cs), [Dashboard](../SmartWMS.Api/Controllers/DashboardController.cs).
- Wire results/errors: [Result](../SmartWMS.Application/Common/Models/Result.cs), [PaginatedResult](../SmartWMS.Application/Common/Models/PaginatedResult.cs), [ResultExtensions](../SmartWMS.Api/Extensions/ResultExtensions.cs), [GlobalExceptionHandler](../SmartWMS.Api/Middleware/GlobalExceptionHandler.cs).
- Receiving: [DTOs](../SmartWMS.Application/Features/InboundReceipts/DTOs) and [ReceiveInboundReceipt handler](../SmartWMS.Application/Features/InboundReceipts/Commands/ReceiveInboundReceipt/ReceiveInboundReceiptCommandHandler.cs).
- Replenishment: [actual Result<int> handler](../SmartWMS.Application/Features/InventoryManagement/Commands/AutoReplenish/AutoReplenishCommandHandler.cs); transfer [DTOs](../SmartWMS.Application/Features/InventoryTransfers/DTOs).
- Count: [DTOs](../SmartWMS.Application/Features/CycleCounting/DTOs), [CycleCountAccess](../SmartWMS.Application/Features/CycleCounting/CycleCountAccess.cs), [locked coordinator](../SmartWMS.Infrastructure/Services/CycleCountCoordinator.cs).
- Kit: [DTO](../SmartWMS.Application/Features/Kitting/DTOs/Commands/AssembleKitRequest.cs), [handler](../SmartWMS.Application/Features/Kitting/Commands/AssembleKit/AssembleKitCommandHandler.cs).
- B3: [DTOs](../SmartWMS.Application/Features/OutboundOrders/DTOs), [OutboundLifecycle](../SmartWMS.Application/Features/OutboundOrders/OutboundLifecycle.cs), [Ship adapter](../SmartWMS.Application/Features/OutboundOrders/Commands/ShipOutboundOrder/ShipOutboundOrderCommandHandler.cs), [weight advice](../SmartWMS.Application/Features/OutboundOrders/Commands/ValidatePackingWeight/ValidatePackingWeightCommandHandler.cs).
- Product/scanner: [DTOs](../SmartWMS.Application/Features/Products/DTOs), [QR](../SmartWMS.Application/Features/Products/Queries/GetProductQrCode/GetProductQrCodeQueryHandler.cs), [parse](../SmartWMS.Application/Features/Products/Queries/ParseBarcode/ParseBarcodeQueryHandler.cs), [semantic](../SmartWMS.Application/Features/Products/Queries/GetSemanticProducts/GetSemanticProductsQueryHandler.cs).
- Auth: [JWT service](../SmartWMS.Infrastructure/Services/JwtTokenService.cs), [Auth DTOs](../SmartWMS.Application/Features/Auth/DTOs); deployment findings: [Program](../SmartWMS.Api/Program.cs), [GeminiHealthCheck](../SmartWMS.Infrastructure/HealthChecks/GeminiHealthCheck.cs).

The endpoint catalogue covers **all97 routed controller actions** once, including2 unsupported legacy outbound routes and1 partial cross-dock route. Additional infrastructure/internal-model limitations are explicitly separate. A source/document change after this checkpoint requires rechecking contracts; do not silently treat route existence or stale older policy evidence as integration readiness.
