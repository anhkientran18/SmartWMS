# SUP01 supplier pagination regression

Console verification follows the existing `verification/` convention and references
Application only. It invokes the real pagination/list/detail handlers over six
LINQ objects using EF async interfaces. Unexpected context calls fail immediately.
It adds no packages and never starts the API, opens a database, writes test data,
loads application configuration, or runs migrations/jobs.

This checks handler composition, not SQL translation/collation or HTTP authorization.
The pagination cases must fail on baseline `ad8b620038b5beab5f6225fb5a01460bf2414b97`.

Run from the clone root with .NET 10 or newer. Keep generated artifacts away from
tracked legacy `obj` files; use the same artifacts path for restore and build:

```powershell
dotnet restore verification/SupplierPagination/SupplierPagination.Verification.csproj --artifacts-path verification/SupplierPagination/obj/artifacts --source C:/Users/Tak18/.nuget/packages -p:NuGetAudit=false
dotnet build verification/SupplierPagination/SupplierPagination.Verification.csproj --no-restore --artifacts-path verification/SupplierPagination/obj/artifacts --disable-build-servers
dotnet verification/SupplierPagination/obj/artifacts/bin/SupplierPagination.Verification/debug/SupplierPagination.Verification.dll
```

The local package source above reuses this machine's existing cache. Adjust it for
another machine. Run restore/build/test sequentially and check artifact resources
before running them.

## Prepared Postman checks (not executed)

Run only after approval of an isolated test database and any required data setup.
Do not create or delete suppliers in the current development database. Use known
active/deleted supplier IDs and distinct names, codes, phones and emails supplied
by the approved environment; interleave their names in sort order.

| GET request / actor | Expected checks |
| --- | --- |
| `/api/v1/Suppliers?pageNumber=1&pageSize=100` / Admin and WarehouseManager | HTTP 200, existing Result envelope; items and totalCount exclude deleted suppliers; Name order unchanged. |
| Same endpoint, pageSize=1 across pages and beyond last page | Active rows appear once in Name order, correct totalCount/totalPages; beyond last page has empty items with unchanged totalCount. |
| `searchTerm` matching both active/deleted rows, then only deleted rows | Only active matches counted/paged; deleted-only search has empty items and totalCount=0. Repeat for Code, Name, Phone, Email and mixed casing where applicable. |
| Empty/whitespace/nonmatching search | Existing search semantics; no deleted rows; no matches yields zero totalCount. |
| pageNumber=0, pageSize=0, pageSize=101, searchTerm over 100 characters | HTTP 400 with existing validation error contract; no contract changes. |
| Pagination / anonymous, invalid token, Staff | HTTP 401 for anonymous/invalid token; HTTP 403 for Staff. |
| `/api/v1/Suppliers/list` and `/api/v1/Suppliers/{id}` | Existing list excludes deleted rows; active detail succeeds; deleted detail remains not found. |

No mutation requests are part of this plan. SQL/HTTP/Postman results require a
separate authorized run and are not implied by the console regression passing.
