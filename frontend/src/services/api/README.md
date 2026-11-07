# Inherited adapters — not F1 integration

F1 audits `httpClient.ts`, authentication (`features/auth/authApi.ts`) and exactly one protected read (`Inventory/stock-summary`). Configure `VITE_API_BASE_URL` with the ASP.NET origin; paths include `/api/v1`. Session tokens come only from `features/auth/session.ts`. Cancellation is preserved; Result failures and ProblemDetails/bodyless errors normalize without synthetic success. Protected 401 clears the matching session and Query caches; 403 retains the session.

Other API DTOs/providers remain inherited, unverified prototypes. Real-mode routing does not mount them. Direct `/api/wms`, `/api/gemini` and `/api/v1/audit-logs` calls remain in explicit demo screens only. Do not proxy these routes to ASP.NET or enable broad CRUD in F1. See `docs/PHASE_F1_REPORT.md` for scope/runtime limits.
