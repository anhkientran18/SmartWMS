using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Claims;
using System.Security.Cryptography;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Api.Controllers;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.InboundReceipts.Commands.CreateInboundReceipt;
using SmartWMS.Application.Features.InboundReceipts.Commands.ReceiveInboundReceipt;

// Empty host: no production Program.cs, appsettings, environment configuration,
// user secrets, Infrastructure DI, SQL, Hangfire or provider registrations.
var builder = WebApplication.CreateEmptyBuilder(new WebApplicationOptions
{
    EnvironmentName = "Production",
    ApplicationName = typeof(InboundReceiptsController).Assembly.GetName().Name
});
builder.WebHost.UseKestrel(options => options.Listen(IPAddress.Loopback, 0));
builder.Services.AddControllers().ConfigureApplicationPartManager(parts =>
{
    parts.ApplicationParts.Clear();
    parts.ApplicationParts.Add(new AssemblyPart(typeof(InboundReceiptsController).Assembly));
    parts.FeatureProviders.Clear();
    parts.FeatureProviders.Add(new InboundControllerFeatureProvider());
});
builder.Services.AddApiVersioningConfig();
var signingKey = new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(32));
const string issuer = "inbound-rbac-fixture";
const string audience = "inbound-rbac-fixture-clients";
// Same validation switches and default claim mapping as production Program.cs;
// only issuer/audience/key are ephemeral fixture values.
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuer = true,
    ValidateAudience = true,
    ValidateLifetime = true,
    ValidateIssuerSigningKey = true,
    ValidIssuer = issuer,
    ValidAudience = audience,
    IssuerSigningKey = signingKey,
    ClockSkew = TimeSpan.Zero
});
builder.Services.AddAuthorization();
var mediator = DispatchProxy.Create<IMediator, MediatorProbe>();
var probe = (MediatorProbe)mediator;
builder.Services.AddSingleton(mediator);
builder.Services.AddSingleton(DispatchProxy.Create<IAiInsightService, UnexpectedDependencyProbe>());

await using var app = builder.Build();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
await app.StartAsync();
using var http = new HttpClient(new SocketsHttpHandler { UseProxy = false, AllowAutoRedirect = false })
{
    BaseAddress = new Uri(app.Services.GetRequiredService<IServer>()
        .Features.Get<IServerAddressesFeature>()!.Addresses.Single()),
    Timeout = TimeSpan.FromSeconds(10)
};
var checks = 0;
void Check(bool condition, string label)
{
    if (!condition) throw new InvalidOperationException("FAIL: " + label);
    checks++;
    Console.WriteLine("PASS: " + label);
}

string Token(string[] roles, DateTime? expires = null, SecurityKey? key = null,
    string tokenIssuer = issuer, string tokenAudience = audience)
{
    var expiry = expires ?? DateTime.UtcNow.AddMinutes(5);
    return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
        tokenIssuer, tokenAudience,
        new[] { new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()) }
            .Concat(roles.Select(role => new Claim(ClaimTypes.Role, role))),
        notBefore: expiry.AddMinutes(-10), expires: expiry,
        signingCredentials: new SigningCredentials(key ?? signingKey, SecurityAlgorithms.HmacSha256)));
}

const string path = "/api/v1/InboundReceipts";
var createBody = new
{
    receiptNumber = "RBAC-FIXTURE-NOT-PERSISTED",
    supplierId = Guid.NewGuid(), binId = Guid.NewGuid(),
    expectedDeliveryDate = DateTime.UtcNow.AddDays(1),
    items = new[] { new { productId = Guid.NewGuid(), expectedQuantity = 1, lotNumber = "RBAC" } }
};
var cases = new (string Actor, string? Token, int Status)[]
{
    ("Anonymous", null, 401),
    ("Staff", Token(["Staff"]), 403),
    ("Admin", Token(["Admin"]), 400),
    ("WarehouseManager", Token(["WarehouseManager"]), 400),
    ("Unknown role", Token(["Other"]), 403),
    ("No role", Token([]), 403),
    ("Malformed", "malformed", 401),
    ("Expired", Token(["Admin"], expires: DateTime.UtcNow.AddMinutes(-1)), 401),
    ("Invalid signature", Token(["Admin"], key: new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(32))), 401),
    ("Wrong issuer", Token(["Admin"], tokenIssuer: "other-issuer"), 401),
    ("Wrong audience", Token(["Admin"], tokenAudience: "other-audience"), 401),
    ("Staff + Admin", Token(["Staff", "Admin"]), 400),
    ("Staff + unknown role", Token(["Staff", "Other"]), 403),
    ("Wrong role casing", Token(["admin"]), 403)
};

async Task Send(string label, HttpMethod method, string route, object? body,
    string? token, int expectedStatus, Type? expectedCommand = null)
{
    var before = probe.Calls.Count;
    using var request = new HttpRequestMessage(method, route);
    if (body is not null) request.Content = JsonContent.Create(body);
    if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    using var response = await http.SendAsync(request);
    Check((int)response.StatusCode == expectedStatus,
        $"{label}: HTTP {(int)response.StatusCode}, expected {expectedStatus}");
    if (expectedStatus is 401 or 403)
    {
        Check(probe.Calls.Count == before, label + ": zero MediatR dispatches");
        if (expectedStatus == 401)
            Check(response.Headers.WwwAuthenticate.Any(value => value.Scheme == "Bearer"),
                label + ": Bearer challenge");
    }
    else
    {
        var payload = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Check(payload.GetProperty("errorCode").GetString() == MediatorProbe.StopCode,
            label + ": authorization reached the safe MediatR boundary");
        Check(probe.Calls.Count == before + 1 && probe.Calls[^1] == expectedCommand,
            label + ": exactly the expected command/query dispatched");
    }
}

foreach (var row in cases)
    await Send(row.Actor + " create", HttpMethod.Post, path, createBody, row.Token,
        row.Status, typeof(CreateInboundReceiptCommand));

// Even invalid JSON must be rejected before MVC model binding and command dispatch.
foreach (var row in cases.Where(row => row.Actor is "Anonymous" or "Staff"))
{
    var before = probe.Calls.Count;
    using var request = new HttpRequestMessage(HttpMethod.Post, path)
    {
        Content = new StringContent("{", System.Text.Encoding.UTF8, "application/json")
    };
    if (row.Token is not null) request.Headers.Authorization = new("Bearer", row.Token);
    using var response = await http.SendAsync(request);
    Check((int)response.StatusCode == row.Status && probe.Calls.Count == before,
        row.Actor + ": malformed body cannot bypass authorization");
}

var receiveBody = new
{
    inboundReceiptId = Guid.NewGuid(),
    receivedItems = new[] { new { itemId = Guid.NewGuid(), quantityReceived = 1, expectedReceivedQuantity = 0 } }
};
foreach (var role in new[] { "Admin", "WarehouseManager", "Staff" })
    await Send(role + " confirm-receipt", HttpMethod.Post, path + "/confirm-receipt",
        receiveBody, Token([role]), 400, typeof(ReceiveInboundReceiptCommand));
await Send("Anonymous confirm-receipt", HttpMethod.Post, path + "/confirm-receipt", receiveBody, null, 401);
await Send("Unknown role confirm-receipt", HttpMethod.Post, path + "/confirm-receipt", receiveBody, Token(["Other"]), 403);

// Check the real mapped endpoints: no AllowAnonymous, named policy or scheme override,
// exact class policy on every action, with only create adding the manager restriction.
var endpoints = app.Services.GetRequiredService<EndpointDataSource>().Endpoints
    .Where(endpoint => endpoint.Metadata.GetMetadata<ControllerActionDescriptor>()?.ControllerTypeInfo
        == typeof(InboundReceiptsController).GetTypeInfo()).ToArray();
var expectedActions = new[] { "CreateInboundReceipt", "ConfirmInboundReceipt", "Update",
    "DeleteInboundReceipt", "GetPaginatedInboundReceipts", "GetInboundReceiptById", "GetList",
    "GetPutawaySuggestion", "ProcessCrossDocking", "ScanInboundInvoice", "ReportProductDamage" };
Check(endpoints.Select(endpoint => endpoint.Metadata.GetMetadata<ControllerActionDescriptor>()!.ActionName)
    .Order().SequenceEqual(expectedActions.Order()), "all 11 production inbound actions mapped");
var policyProvider = app.Services.GetRequiredService<IAuthorizationPolicyProvider>();
var authorization = app.Services.GetRequiredService<IAuthorizationService>();
foreach (var endpoint in endpoints)
{
    var action = endpoint.Metadata.GetMetadata<ControllerActionDescriptor>()!;
    var isCreate = action.ActionName == "CreateInboundReceipt";
    var data = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
    Check(endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null
        && data.Count == (isCreate ? 2 : 1)
        && data.Count(item => item.Roles == "Admin,WarehouseManager,Staff") == 1
        && (!isCreate || data.Count(item => item.Roles == "Admin,WarehouseManager") == 1)
        && data.All(item => string.IsNullOrEmpty(item.Policy) && string.IsNullOrEmpty(item.AuthenticationSchemes)),
        action.ActionName + ": exact authorization metadata, no bypass/override");
    var policy = await AuthorizationPolicy.CombineAsync(policyProvider, data)
        ?? throw new InvalidOperationException("Missing endpoint policy");
    foreach (var role in new[] { "Admin", "WarehouseManager", "Staff", "Other", "" })
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            role.Length == 0 ? [] : new[] { new Claim(ClaimTypes.Role, role) }, "fixture"));
        var result = await authorization.AuthorizeAsync(principal, endpoint, policy);
        var expected = role is "Admin" or "WarehouseManager" || (!isCreate && role == "Staff");
        Check(result.Succeeded == expected, action.ActionName + ": combined policy for " + (role == "" ? "no role" : role));
    }
}

// HTTP regression checks for Staff reads use actual MVC actions and safe query dispatch.
foreach (var (suffix, command) in new (string, Type)[]
{
    ("", typeof(SmartWMS.Application.Features.InboundReceipts.Queries.GetPaginatedInboundReceipts.GetPaginatedInboundReceiptsQuery)),
    ("/list", typeof(SmartWMS.Application.Features.InboundReceipts.Queries.GetList.GetInboundReceiptListQuery)),
    ("/" + Guid.NewGuid(), typeof(SmartWMS.Application.Features.InboundReceipts.Queries.GetInboundReceiptById.GetInboundReceiptByIdQuery)),
    ("/putaway-suggestion?sku=RBAC&quantity=1", typeof(SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion.GetPutawaySuggestionQuery))
})
    await Send("Staff GET " + suffix, HttpMethod.Get, path + suffix, null, Token(["Staff"]), 400, command);

await app.StopAsync();
Console.WriteLine($"Inbound create RBAC: {checks}/{checks} checks passed; no business handlers or external services registered.");
return 0;

sealed class InboundControllerFeatureProvider : IApplicationFeatureProvider<ControllerFeature>
{
    public void PopulateFeature(IEnumerable<ApplicationPart> parts, ControllerFeature feature)
        => feature.Controllers.Add(typeof(InboundReceiptsController).GetTypeInfo());
}

public class UnexpectedDependencyProbe : DispatchProxy
{
    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        => throw new InvalidOperationException("Unexpected AI dependency invocation");
}

public class MediatorProbe : DispatchProxy
{
    public const string StopCode = "RBAC_FIXTURE_STOP";
    public List<Type> Calls { get; } = [];

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        if (targetMethod?.Name != "Send" || args?.FirstOrDefault() is not { } request)
            throw new InvalidOperationException("Unexpected MediatR invocation");
        Calls.Add(request.GetType());
        var responseType = targetMethod.ReturnType.GenericTypeArguments.Single();
        // All exercised controller requests return Result<T>. Return a distinctive
        // business failure AFTER authorization, never fake an authorization decision.
        var response = responseType.GetMethod("Failure", BindingFlags.Public | BindingFlags.Static
            | BindingFlags.DeclaredOnly, [typeof(string), typeof(string)])!
            .Invoke(null, [StopCode, "Authorization probe only; no business handler executed."]);
        return typeof(Task).GetMethod(nameof(Task.FromResult))!.MakeGenericMethod(responseType)
            .Invoke(null, [response]);
    }
}
