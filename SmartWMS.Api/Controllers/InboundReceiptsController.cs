using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.InboundReceipts.Commands.Create;
using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")]
[ApiController]
[Route("api/v1/[controller]")]
public class InboundReceiptsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IAiInsightService _aiInsightService;

    public InboundReceiptsController(IMediator mediator, IAiInsightService aiInsightService)
    {
        _mediator = mediator;
        _aiInsightService = aiInsightService;
    }

    /// <summary>
    /// API Khởi tạo phiếu nhập kho thô ban đầu (Inbound Receipt)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateInboundReceipt([FromBody] CreateInboundReceiptCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }

    /// <summary>
    /// API quét ảnh chụp hóa đơn từ thiết bị di động, tự động nhận diện OCR trích xuất dữ liệu qua AI
    /// </summary>
    [HttpPost("scan-invoice")]
    public async Task<IActionResult> ScanInboundInvoice(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { IsSuccess = false, Message = "Vui lòng cung cấp hình ảnh hóa đơn hợp lệ từ Camera." });
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLower();
        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest(new { IsSuccess = false, Message = "Hệ thống chỉ hỗ trợ các định dạng ảnh mẫu (.jpg, .jpeg, .png, .webp)." });
        }

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        byte[] imageBytes = memoryStream.ToArray();

        string mimeType = file.ContentType;
        string jsonOcrResult = await _aiInsightService.AnalyzeReceiptImageAsync(imageBytes, mimeType);

        try
        {
            using var validJson = JsonDocument.Parse(jsonOcrResult);
            // 🌟 ĐÃ SỬA: Sử dụng .Clone() để tách biệt dữ liệu khỏi JsonDocument trước khi bị Dispose
            return Ok(new { IsSuccess = true, Data = validJson.RootElement.Clone() });
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { IsSuccess = false, Message = "Định dạng nhận diện từ AI không khớp cấu trúc JSON.", RawOutput = jsonOcrResult });
        }
    }

    /// <summary>
    /// API tiếp nhận ảnh chụp sản phẩm lỗi từ thiết bị PDA/Mobile của Staff hiện trường để thẩm định mức độ hư hại
    /// </summary>
    [HttpPost("report-damage")]
    public async Task<IActionResult> ReportProductDamage(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { IsSuccess = false, Message = "Vui lòng tải lên hình ảnh bằng chứng hàng hóa bị lỗi." });
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLower();
        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest(new { IsSuccess = false, Message = "Vui lòng chụp ảnh đúng định dạng (.jpg, .jpeg, .png, .webp)." });
        }

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        byte[] imageBytes = memoryStream.ToArray();
        string mimeType = file.ContentType;

        // Gọi dịch vụ AI Vision bóc tách mức độ hư hỏng
        string jsonVisionResult = await _aiInsightService.AnalyzeDamageImageAsync(imageBytes, mimeType);

        try
        {
            using var validJson = JsonDocument.Parse(jsonVisionResult);
            // 🌟 ĐÃ SỬA: Sử dụng .Clone() để tránh lỗi Disposed Object tương tự khi truyền sang Postman
            return Ok(new { IsSuccess = true, Analysis = validJson.RootElement.Clone(), GeneratedAt = DateTime.UtcNow });
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                IsSuccess = false,
                Message = "AI trả về kết quả thẩm định hình ảnh không đúng cấu trúc.",
                RawOutput = jsonVisionResult
            });
        }
    }

    /// <summary>
    /// API gợi ý vị trí cất hàng tối ưu (Smart Put-away) dựa trên thuật toán sắp xếp trước khi lưu kho thực tế
    /// </summary>
    [HttpGet("putaway-suggestion")]
    public async Task<IActionResult> GetPutawaySuggestion([FromQuery] string sku, [FromQuery] int quantity)
    {
        var query = new SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion.GetPutawaySuggestionQuery
        {
            SKU = sku,
            Quantity = quantity
        };

        var result = await _mediator.Send(query);
        if (result.IsSuccess)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }

    /// <summary>
    /// API phân bổ cắt luồng nhập - xuất trực tiếp phục vụ giải phóng xe vận tải nhanh (Cross-Docking Engine)
    /// </summary>
    [HttpPost("process-crossdock")]
    public async Task<IActionResult> ProcessCrossDocking([FromBody] SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking.ProcessCrossDockingCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }

    /// <summary>
    /// API Xác nhận cất hàng vào vị trí ô kệ thực tế sau khi kiểm đếm hiện trường hoàn tất
    /// </summary>
    [HttpPost("confirm-receipt")]
    public async Task<IActionResult> ConfirmInboundReceipt([FromBody] SmartWMS.Application.Features.InboundReceipts.Commands.ConfirmInboundReceipt.ConfirmInboundReceiptCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }

    /// <summary>
    /// API thực thi dịch chuyển nguyên khối cấu kiện Pallet/Thùng tổng (LPN Tracking) qua súng quét hiện trường
    /// </summary>
    [HttpPost("move-pallet")]
    public async Task<IActionResult> MoveBulkLpn([FromBody] SmartWMS.Application.Features.InventoryManagement.Commands.MoveLpn.MoveLpnCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }
}