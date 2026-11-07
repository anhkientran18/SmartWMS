# SmartWMS frontend — F0–F8 baseline

React 19, TypeScript and Vite frontend for the existing ASP.NET Core backend, with TanStack Query, Axios, Tailwind CSS and Vietnamese/English UI resources. PR 0 adds the curated frontend snapshot on top of the inherited backend; it does not change backend code, API/DTO contracts, RBAC, migrations or database data. The 14 post-submission enhancement commits are excluded.

## Implemented frontend scope

Production routing is defined in `src/app/App.tsx`; `src/app/dataMode.ts` selects API or demo mode.

| Phase | Baseline scope |
| --- | --- |
| F0 | React structure, shared UI, VI/EN resources, explicit mock/demo and inactive legacy examples |
| F1 | Backend login/logout, JWT session, protected routes, shared HTTP/error handling |
| F2 | Physical stock visibility, low-stock and transaction-history reads |
| F3 | Global auto replenishment with Admin/WarehouseManager UI guard |
| F4 | Inbound creation, receiving and same-warehouse putaway transfer |
| F4.5 | Shared layout, visual consistency and loading/empty/error states |
| F5 | Outbound B3 create/list/detail and allocate → pick → pack → ship |
| F6 | Assigned cycle counts, manager sheet creation and count confirmation |
| F7 | Request-defined kitting recipe and assembly |
| F8 | Product catalog, product detail and QR/barcode lookup |

The final baseline also includes an operational dashboard, location/bin/supplier administration, user administration, audit logs, account and settings screens. This describes source implementation, not accepted SQL/API/browser end-to-end behavior. Later inventory adjustment/export UI, customer creation/product CRUD UI, executive/AI integrations and bilingual master-data contracts are outside PR 0.

## Install and run in production API mode

Use Node.js 22 (at least 22.12) and npm. Run these commands from `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Review `.env.local` before starting:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:5215
```

API mode is the default; only an explicit `VITE_DATA_MODE=mock` enables the demo. The API base URL is the backend **origin**, without `/api/v1`; adapters append the versioned routes. Configure the origin for your environment. An absent origin in API mode produces a configuration error rather than selecting mock data. Environment settings are applied when Vite starts or builds; restart after switching modes and remove conflicting shell overrides.

Open [the development UI](http://127.0.0.1:5173) and use an existing backend account. API mode requires a separately configured .NET 10 API, SQL schema, account and master data in an authorized environment. The frontend commands do not provision these. Do not start migrations, seed scripts, background jobs or a shared database rehearsal as part of frontend setup.

Production routes cover `/dashboard`, inventory, replenishment, orders and inbound/outbound creation, assigned cycle counting, kitting, products, locations/bins/suppliers, user administration, audit logs, profile and settings. Unsupported API-mode routes return to `/dashboard`; prototype providers are confined to demo routing.

## Mock/demo mode

```powershell
npm run dev:demo
```

Open [the synthetic demo](http://127.0.0.1:3000). The Express companion embeds Vite using `.env.demo` and mock providers. Demo authentication, AI, security indicators and mobile/Wave/Serial/LPN screens are simulations. Use synthetic accounts only; do not enter real credentials. Server data resets on restart, while some browser mock stores persist. Demo and real sessions use separate storage keys.

The demo companion does not connect to ASP.NET or SQL and is excluded from production builds. Do not proxy its `/api/wms`, `/api/gemini` or demo audit routes to the real API. See [demo details](demo/README.md) and [inactive legacy examples](legacy/README.md).

## Typecheck, tests and build

Run from `frontend/` after installation:

```powershell
npm run typecheck
# Required once: the sprint runner does not create its evidence directory.
node -e "require('node:fs').mkdirSync('verification/shared/evidence', { recursive: true })"
npm run test:sprint
npm run build
npm run preview
```

`typecheck` runs TypeScript with no emit. `test:sprint` invokes all nine runners: auth, inventory, replenishment, inbound, outbound, cycle-count, kitting, products and administration. Individual suites have `npm run test:<suite>` scripts except administration, which runs with `node tests/run-administration.mjs`.

The test runners bundle tests with esbuild and use controlled adapters/mocks, source assertions and React server rendering where applicable. They write temporary bundles under `verification/*/scripts`; the sprint runner writes logs and a results JSON under `verification/shared/evidence`. Keep these generated outputs out of PR 0. `tests/prepare-local-demo.mjs` and `tests/rehearse-local.mjs` are separate manual scripts with real HTTP mutations; they are not part of `test:sprint` and require an explicitly approved isolated fixture.

`build` emits static assets into `dist/`; configure the public API origin before building. `preview` serves the built assets locally at [the default preview URL](http://127.0.0.1:4173). The synthetic Express server is not a production backend. The baseline build has a large-chunk warning; it is not evidence of a failed build.

### Historical baseline verification

On 2026-11-06, the baseline at `3b6fcded123f51ff0baafcf5b4917619d495d773` was verified in a separate Windows worktree with Node 22.23.4/npm 10.9.9 and .NET SDK 10.0.202: backend restore/build, frontend clean install, typecheck, production build and **9 test suites / 183 tests passed**.

| Suite | Historical tests passed |
| --- | ---: |
| auth | 11 |
| inventory | 15 |
| replenishment | 13 |
| inbound | 20 |
| outbound | 26 |
| cycle-count | 29 |
| kitting | 35 |
| products | 24 |
| administration | 10 |
| **Total** | **183** |

These are historical baseline results, not a new test run of the candidate or its future commit. README-only finalization does not rerun executable checks. Verification of the exact committed SHA and CI/platform checks remains pending; no SQL integration, live API, browser E2E or live AI acceptance is claimed.

## Security decision and acceptance limits

**Mandatory security follow-up before real use:** the inherited baseline backend still permits `Staff` to call `POST /api/v1/InboundReceipts` to create a receipt. The target policy permits only `Admin` and `WarehouseManager`. The creation UI already restricts Staff, but frontend visibility is not backend authorization. PR 0 records this gap and leaves the backend unchanged; the policy fix and its authorization tests require a separate security change before operational use.

Backend authorization remains authoritative. JWTs are persisted in browser localStorage and are accessible to same-origin JavaScript. Logout clears the local session/private query caches and attempts backend logout; token revocation, refresh, MFA and warehouse-level ACL are not provided by this baseline. Never put JWT signing keys, provider keys, credentials or database configuration in public `VITE_*` variables.

Inventory semantics remain inherited: stock summary is physical quantity (ATP = quantity minus reserved quantity); receiving sends a delta with `expectedReceivedQuantity`; B3 deducts physical stock once at Pick; putaway transfers stay within one warehouse; cycle-count ownership and snapshots remain enforced by the backend; kitting uses an atomic request-defined recipe; replenishment is a global bodyless mutation where zero movements is valid. Reconcile an unclear mutation outcome before resubmitting it.

SQL schema/application state, live API/RBAC behavior and browser E2E are **not accepted** by the mock/SSR test results. Serial/LPN/Wave, stored BOM, cross-warehouse transfers, real mobile/PDA and post-pick reversal are not certified end to end. The inherited supplier pagination also lacks the later soft-delete filter. This baseline requires security follow-up and isolated runtime acceptance before real use.
