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
    public async Task<IActionResult> ScanInboundInvoice(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { IsSuccess = false, Message = "Vui lòng cung cấp hình ảnh hóa đơn hợp lệ từ Camera." });

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLower();
        if (!allowedExtensions.Contains(extension)) return BadRequest(new { IsSuccess = false, Message = "Hệ thống chỉ hỗ trợ các định dạng ảnh mẫu (.jpg, .jpeg, .png, .webp)." });

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        byte[] imageBytes = memoryStream.ToArray();

        string mimeType = file.ContentType;
        string jsonOcrResult = await _aiInsightService.AnalyzeReceiptImageAsync(imageBytes, mimeType);

        try
        {
            using var validJson = JsonDocument.Parse(jsonOcrResult);
            return Ok(new { IsSuccess = true, Data = validJson.RootElement.Clone() });
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { IsSuccess = false, Message = "Định dạng nhận diện từ AI không khớp cấu trúc JSON.", RawOutput = jsonOcrResult });
        }
    }

    [HttpPost("report-damage")]
    public async Task<IActionResult> ReportProductDamage(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { IsSuccess = false, Message = "Vui lòng tải lên hình ảnh bằng chứng hàng hóa bị lỗi." });

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLower();
        if (!allowedExtensions.Contains(extension)) return BadRequest(new { IsSuccess = false, Message = "Vui lòng chụp ảnh đúng định dạng (.jpg, .jpeg, .png, .webp)." });

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        byte[] imageBytes = memoryStream.ToArray();
        string mimeType = file.ContentType;

        string jsonVisionResult = await _aiInsightService.AnalyzeDamageImageAsync(imageBytes, mimeType);

        try
        {
            using var validJson = JsonDocument.Parse(jsonVisionResult);
            return Ok(new { IsSuccess = true, Analysis = validJson.RootElement.Clone(), GeneratedAt = DateTime.UtcNow });
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { IsSuccess = false, Message = "AI trả về kết quả thẩm định hình ảnh không đúng cấu trúc.", RawOutput = jsonVisionResult });
        }
    }
}