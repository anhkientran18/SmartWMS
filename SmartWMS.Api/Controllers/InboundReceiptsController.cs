using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.InboundReceipts.Commands.CreateInboundReceipt;
using SmartWMS.Application.Features.InboundReceipts.Commands.DeleteInboundReceipt;
using SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking;
using SmartWMS.Application.Features.InboundReceipts.Commands.ReceiveInboundReceipt;
using SmartWMS.Application.Features.InboundReceipts.Commands.UpdateInboundReceipt;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;
using SmartWMS.Application.Features.InboundReceipts.Queries.GetInboundReceiptById;
using SmartWMS.Application.Features.InboundReceipts.Queries.GetList;
using SmartWMS.Application.Features.InboundReceipts.Queries.GetPaginatedInboundReceipts;
using SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion;
using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager,Staff")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class InboundReceiptsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IAiInsightService _aiInsightService;

    public InboundReceiptsController(IMediator mediator, IAiInsightService aiInsightService)
    {
        _mediator = mediator;
        _aiInsightService = aiInsightService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateInboundReceipt([FromBody] CreateInboundReceiptRequest request)
        => (await _mediator.Send(new CreateInboundReceiptCommand(request))).ToActionResult();

    [HttpPost("confirm-receipt")]
    public async Task<IActionResult> ConfirmInboundReceipt([FromBody] ReceiveInboundReceiptRequest request)
        => (await _mediator.Send(new ReceiveInboundReceiptCommand(request))).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInboundReceiptRequest request)
    {
        if (id != request.Id)
            return BadRequest(new { isSuccess = false, message = "ID đường dẫn không khớp với dữ liệu." });

        return (await _mediator.Send(new UpdateInboundReceiptCommand(request))).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteInboundReceipt(Guid id)
        => (await _mediator.Send(new DeleteInboundReceiptCommand(new DeleteInboundReceiptRequest { Id = id }))).ToActionResult();

    [HttpGet]
    public async Task<IActionResult> GetPaginatedInboundReceipts([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchTerm = null)
        => (await _mediator.Send(new GetPaginatedInboundReceiptsQuery(new InboundReceiptPaginatedQueryRequest { PageIndex = pageNumber, PageSize = pageSize, SearchKeyword = searchTerm }))).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetInboundReceiptById(Guid id)
        => (await _mediator.Send(new GetInboundReceiptByIdQuery(new InboundReceiptByIdQueryRequest { Id = id }))).ToActionResult();

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] Guid? supplierId = null, [FromQuery] string? status = null, [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetInboundReceiptListQuery(new InboundReceiptListQueryRequest
        {
            SupplierId = supplierId,
            Status = status,
            SearchKeyword = searchKeyword
        }))).ToActionResult();

    [HttpGet("putaway-suggestion")]
    public async Task<IActionResult> GetPutawaySuggestion([FromQuery] string sku, [FromQuery] int quantity)
        => (await _mediator.Send(new GetPutawaySuggestionQuery(new PutawaySuggestionRequest { SKU = sku, Quantity = quantity }))).ToActionResult();

    [HttpPost("process-crossdock")]
    public async Task<IActionResult> ProcessCrossDocking([FromBody] ProcessCrossDockRequest request)
        => (await _mediator.Send(new ProcessCrossDockingCommand(request))).ToActionResult();

    [HttpPost("scan-invoice")]
    public async Task<IActionResult> ScanInboundInvoice(IFormFile file, CancellationToken ct)
    {
        var image = await ReadImage(file, ct);
        var raw = await _aiInsightService.AnalyzeReceiptImageAsync(image.Bytes, image.Mime, ct);
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            var items = Field(root, "Items");
            if (!Text(root, "SupplierName") || !Text(root, "InvoiceNumber") ||
                !DateTime.TryParseExact(Field(root, "InvoiceDate").GetString(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out _) || items.ValueKind != JsonValueKind.Array || items.GetArrayLength() == 0 ||
                items.EnumerateArray().Any(x => !Text(x, "SKU") || !Text(x, "ProductName") || !Number(x, "Quantity", true) || !Number(x, "UnitPrice", false)))
                return InvalidVision();
            return Ok(new { IsSuccess = true, Data = root.Clone() });
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException) { return InvalidVision(); }
    }

    [HttpPost("report-damage")]
    public async Task<IActionResult> ReportProductDamage(IFormFile file, CancellationToken ct)
    {
        var image = await ReadImage(file, ct);
        var raw = await _aiInsightService.AnalyzeDamageImageAsync(image.Bytes, image.Mime, ct);
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (!Text(root, "DamageType") || !Text(root, "DamageDescription") || !Text(root, "ActionRecommended") ||
                Field(root, "Severity").GetString() is not ("Low" or "Medium" or "High")) return InvalidVision();
            return Ok(new { IsSuccess = true, Analysis = root.Clone(), GeneratedAt = DateTime.UtcNow });
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException) { return InvalidVision(); }
    }

    private IActionResult InvalidVision() => StatusCode(StatusCodes.Status502BadGateway,
        new { IsSuccess = false, ErrorCode = "AI_RESPONSE_INVALID", Message = "AI vision response không khớp contract hợp lệ." });
    private static JsonElement Field(JsonElement root, string name) => root.ValueKind == JsonValueKind.Object
        ? root.EnumerateObject().FirstOrDefault(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase)).Value : default;
    private static bool Text(JsonElement root, string name) => Field(root, name).ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(Field(root, name).GetString());
    private static bool Number(JsonElement root, string name, bool positive) => Field(root, name).TryGetDecimal(out var value) && (positive ? value > 0 : value >= 0);
    private static async Task<(byte[] Bytes, string Mime)> ReadImage(IFormFile? file, CancellationToken ct)
    {
        void Invalid(string message) => throw new FluentValidation.ValidationException(new[] { new FluentValidation.Results.ValidationFailure("file", message) });
        if (file == null || file.Length == 0 || file.Length > 5 * 1024 * 1024) Invalid("File ảnh phải có nội dung và không vượt quá 5 MiB.");
        if (file!.FileName.IndexOfAny(new[] { '/', '\\' }) >= 0) Invalid("Filename chỉ được là tên file, không chứa đường dẫn.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var mime = extension switch { ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", _ => "" };
        if (mime.Length == 0 || !string.Equals(file.ContentType, mime, StringComparison.OrdinalIgnoreCase)) Invalid("Extension/content type của ảnh không hợp lệ.");
        using var stream = new MemoryStream(); await file.CopyToAsync(stream, ct); var bytes = stream.ToArray();
        var valid = mime switch
        {
            "image/png" => bytes.Length > 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "image/jpeg" => bytes.Length > 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255,
            "image/webp" => bytes.Length > 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
            _ => false
        };
        if (!valid) Invalid("Nội dung không có signature ảnh phù hợp.");
        return (bytes, mime);
    }
}
