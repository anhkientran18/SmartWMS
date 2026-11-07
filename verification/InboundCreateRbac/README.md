# Inbound create authorization regression

Requires .NET SDK 10 and the existing production dependencies. This test project
directly references Newtonsoft.Json 13.0.3 to harden its transitive dependency graph.
Run from the repository root:

```powershell
dotnet run --project verification/InboundCreateRbac/InboundCreateRbac.Verification.csproj --configuration Release
```

This console harness exits nonzero on any failed assertion. It starts its own empty
Kestrel host on an ephemeral loopback port, maps the production inbound controller
and API versioning, and uses real JWT Bearer authentication and ASP.NET Core
authorization middleware. It never starts production `Program.cs` or loads its
configuration, user secrets, database, jobs, handlers or live AI services. Build/run
writes only build artifacts; the requests cannot persist receipts or stock.

Create matrix: anonymous/malformed/expired/invalid signature/wrong issuer/wrong
audience => 401; Staff/unknown role/no role/wrong role casing/Staff + unknown => 403;
Admin/WarehouseManager/Staff + Admin => authorized through to MediatR. Denied
requests must dispatch zero commands, including requests with malformed JSON.

The MediatR probe returns `RBAC_FIXTURE_STOP` (HTTP 400 through the production
result mapper) for admitted requests. This is evidence that authorization passed
and the actual controller dispatched the expected command, not a business success
or a real receipt creation. No authorization result/status is mocked.

Regression checks cover Staff confirm-receipt and GET page/list/detail/putaway
over HTTP. All 11 mapped inbound actions must preserve the class role restriction,
with only create adding the manager restriction, and no AllowAnonymous, named
policy or scheme override. Their combined policies are evaluated for all three
roles, an unknown role and a roleless authenticated identity.

The JWT validation settings mirror the current production switches and default
claim mapping using an ephemeral random signing key and fixture issuer/audience.
This isolates endpoint authorization; it does not certify production startup,
login/token lifecycle, SQL business behavior, AI or full application end-to-end
behavior. Existing SQL/API verification harnesses are deliberately not invoked.

Dependency audit note: Hangfire.Core 1.8.23 requires Newtonsoft.Json >= 11.0.1.
The direct Newtonsoft.Json 13.0.3 reference keeps this test project on the version
already resolved by the production API through its private EF Design dependency.
It prevents the console graph from selecting vulnerable 11.0.1 (NU1903,
GHSA-5crp-9r3c-p9vr). Production dependencies and NuGet audit settings are unchanged.
AuthorizationS1 and InboundB1 remain outside this patch and retain their existing
dependency warnings; this reference applies only to InboundCreateRbac.
