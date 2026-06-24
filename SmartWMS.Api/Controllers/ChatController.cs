using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using System.Text;
using System.Text.Json;

namespace SmartWMS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IAiChatService _aiChatService;
    private readonly IAiInsightService _aiInsightService; // BỔ SUNG: Khai báo biến dịch vụ AI Insight xử lý giọng nói

    // CẬP NHẬT: Inject thêm IAiInsightService vào Constructor của Controller
    public ChatController(
        IApplicationDbContext context,
        IAiChatService aiChatService,
        IAiInsightService aiInsightService) // BỔ SUNG
    {
        _context = context;
        _aiChatService = aiChatService;
        _aiInsightService = aiInsightService; // BỔ SUNG
    }

    [HttpPost("query")]
    public async Task<IActionResult> AskAiAgent([FromBody] ChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest("Nội dung tin nhắn không được để trống.");
        }

        // 1. Thu thập dữ liệu tồn kho hiện tại làm dữ liệu nền cho mô hình RAG
        var inventories = await _context.BinInventories
            .Include(x => x.Bin)
            .Include(x => x.Product)
            .ToListAsync();

        // 2. Định dạng dữ liệu thô thành chuỗi văn bản tối giản để tiết kiệm Token gửi lên LLM
        var contextBuilder = new StringBuilder();
        contextBuilder.AppendLine("Danh sách tồn kho thực tế:");
        foreach (var inv in inventories)
        {
            if (inv.Product == null || inv.Bin == null) continue;
            contextBuilder.AppendLine($"- Sản phẩm: {inv.Product.Name}, SKU: {inv.Product.SKU}, Vị trí kệ: {inv.Bin.Code}, Số lượng tồn: {inv.Quantity}, Trạng thái: {inv.Status}");
        }

        // 3. Gửi câu hỏi kèm theo Context kho bãi sang cho Gemini xử lý
        string aiResponse = await _aiChatService.AskGeminiWithContextAsync(request.Message, contextBuilder.ToString());

        return Ok(new { Response = aiResponse, Timestamp = DateTime.UtcNow });
    }

    [HttpPost("voice-command")]
    public async Task<IActionResult> ProcessVoiceCommand([FromBody] VoiceCommandRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.VoiceText))
        {
            return BadRequest(new { Message = "Chuỗi khẩu lệnh trống." });
        }

        // 1. Gọi AI bóc tách chuỗi hội thoại thành cấu trúc Data JSON
        string jsonParsed = await _aiInsightService.ParseVoiceCommandAsync(request.VoiceText);

        try
        {
            using var document = JsonDocument.Parse(jsonParsed);
            var root = document.RootElement;

            // Nếu AI bóc tách lỗi
            if (root.TryGetProperty("Error", out var errorProp))
            {
                return BadRequest(new { Message = errorProp.GetString() });
            }

            string action = root.GetProperty("Action").GetString() ?? "";
            string sku = root.GetProperty("SKU").GetString() ?? "";
            int quantity = root.GetProperty("Quantity").GetInt32();
            string binCode = root.GetProperty("BinCode").GetString() ?? "";

            // 2. Kịch bản phản hồi Text-to-Speech (TTS) thân thiện cho nhân viên kho hiện trường
            string speechFeedback = action switch
            {
                "PICK" => $"Xác nhận yêu cầu lấy {quantity} thùng mã hàng {sku} tại vị trí {binCode}. Hệ thống đang xử lý lệnh xuất.",
                "PUT" => $"Ghi nhận lệnh cất {quantity} đơn vị sản phẩm {sku} vào kệ {binCode}. Tiến hành cập nhật tồn kho.",
                "COUNT" => $"Hệ thống ghi nhận số lượng kiểm kê mã hàng {sku} tại vị trí này là {quantity} kiện.",
                _ => "Hệ thống đã nghe rõ nhưng chưa xác định được hành động cụ thể trong kho của bạn."
            };

            // 3. Ở đây bạn có thể gọi trực tiếp sang InboundService hoặc OutboundService tương ứng để update DB tự động!

            return Ok(new
            {
                IsSuccess = true,
                Intent = new { Action = action, SKU = sku, Quantity = quantity, BinCode = binCode },
                TextToSpeechResponse = speechFeedback // Chuỗi này trả về để Mobile tự động phát âm thanh đọc lên tai nghe nhân viên
            });
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { Message = "AI trả về cấu trúc lệnh không đồng bộ.", Raw = jsonParsed });
        }
    }

    public class VoiceCommandRequest
    {
        public string VoiceText { get; set; } = string.Empty;
    }
}

// DTO tiếp nhận dữ liệu từ Client
public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
}