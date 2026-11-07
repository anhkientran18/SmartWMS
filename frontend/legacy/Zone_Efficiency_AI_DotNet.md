# Flow Gợi ý phân bổ nhân sự (AI-Powered Zone Efficiency) - C# ASP.NET Core

Phân tích và triển khai chi tiết luồng sử dụng Gemini API để phân tích số liệu kho và đưa ra gợi ý phân bổ nhân sự thông minh dựa trên nguyên lý kiến trúc sạch (Clean Architecture).

## 1. Lớp Application (CQRS & Interfaces)

### 1.1 Khai báo Interface cho AI Service
Sử dụng `Dependency Inversion`, tầng Application chỉ định nghĩa Interface, còn việc gọi REST API của Gemini sẽ được implement ở tầng Infrastructure.

```csharp
// Application/Common/Interfaces/IGeminiAgentService.cs
namespace SmartWMS.Application.Common.Interfaces;

public interface IGeminiAgentService
{
    Task<string> AnalyzeZoneEfficiencyAsync(string promptContext, CancellationToken cancellationToken);
}
```

### 1.2. Định nghĩa DTO
```csharp
// Application/Zones/DTOs/ZoneEfficiencyResponse.cs
namespace SmartWMS.Application.Zones.DTOs;

public class ZoneEfficiencyResponse
{
    public bool HasSuggestion { get; set; }
    public string? RecommendedZoneId { get; set; }
    public string? SuggestionText { get; set; }
}
```

### 1.3 Command & Handler
Thu thập dữ liệu xử lý logic từ CSDL và đóng gói thành dữ liệu cấu trúc Prompt.

```csharp
// Application/Zones/Commands/CheckZoneEfficiencyCommand.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Zones.DTOs;
using SmartWMS.Application.Common.Interfaces.Data; // Chứa IApplicationDbContext

namespace SmartWMS.Application.Zones.Commands;

public record CheckZoneEfficiencyCommand(string SelectedZoneId) : IRequest<ZoneEfficiencyResponse>;

public class CheckZoneEfficiencyCommandHandler : IRequestHandler<CheckZoneEfficiencyCommand, ZoneEfficiencyResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IGeminiAgentService _aiService;

    public CheckZoneEfficiencyCommandHandler(IApplicationDbContext dbContext, IGeminiAgentService aiService)
    {
        _dbContext = dbContext;
        _aiService = aiService;
    }

    public async Task<ZoneEfficiencyResponse> Handle(CheckZoneEfficiencyCommand request, CancellationToken cancellationToken)
    {
        // 1. Phân tích Dữ liệu Zone hiện tại (Giả lập logic lấy KPI Warehouse)
        // Trong thực tế sẽ Query từ bảng Users và bảng Order/KPI
        var currentZoneStaffCount = await _dbContext.Users
            .CountAsync(u => u.AssignedWarehouseId == request.SelectedZoneId, cancellationToken);

        // Mock dữ liệu hiệu suất (Ví dụ: tính từ OrderCompleted / OrderTotal)
        var currentZoneEfficiency = 92; // 92%
        var currentZoneName = request.SelectedZoneId;

        // 2. Tìm kiếm Zone khác đang trong tình trạng "Thiếu nhân sự" hoặc làm việc "Quá tải"
        // Ở đây giả lập lấy từ Database một Zone cần cấp cứu nhân sự
        var understaffedZoneId = "Zone B - South";
        var understaffedZoneStaffCount = 4;
        var understaffedZoneEfficiency = 65; // 65% hiệu suất thấp do ít người

        if (string.IsNullOrEmpty(understaffedZoneId) || understaffedZoneId == request.SelectedZoneId)
        {
            // Không có zone nào khác thiếu người, cho phép thêm bình thường
            return new ZoneEfficiencyResponse { HasSuggestion = false };
        }

        // 3. Gom dữ liệu thô thành Context String cho Gemini
        var contextString = $@"
            Dữ liệu kho:
            - Zone được chọn: {currentZoneName} (Nhân sự: {currentZoneStaffCount}, Hiệu suất: {currentZoneEfficiency}%).
            - Zone gợi ý: {understaffedZoneId} (Nhân sự: {understaffedZoneStaffCount}, Hiệu suất: {understaffedZoneEfficiency}% - Đang quá tải/thiếu người).
        ";

        // 4. Gọi Gemini API để phân tích và sinh ngôn ngữ tự nhiên
        var suggestionText = await _aiService.AnalyzeZoneEfficiencyAsync(contextString, cancellationToken);

        if (string.IsNullOrWhiteSpace(suggestionText))
        {
            return new ZoneEfficiencyResponse { HasSuggestion = false };
        }

        // 5. Trả kết quả về cho Frontend
        return new ZoneEfficiencyResponse
        {
            HasSuggestion = true,
            RecommendedZoneId = understaffedZoneId,
            SuggestionText = suggestionText.Trim()
        };
    }
}
```

## 2. Lớp Infrastructure (Gemini API Integration)

Triển khai IHttpClientFactory để gọi Google Gemini REST API. API Key được quản lý an toàn qua `IConfiguration`.

```csharp
// Infrastructure/AI/GeminiAgentService.cs
using System.Text.Json;
using System.Text;
using Microsoft.Extensions.Configuration;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.AI;

public class GeminiAgentService : IGeminiAgentService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public GeminiAgentService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Gemini:ApiKey"] ?? throw new ArgumentNullException("Gemini API Key is missing.");
    }

    public async Task<string> AnalyzeZoneEfficiencyAsync(string promptContext, CancellationToken cancellationToken)
    {
        var model = "gemini-2.5-flash"; // Sử dụng Flash model cho độ trễ (latency) thấp
        var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";

        var systemInstruction = "Bạn là Trợ lý nhân sự thông minh của SmartWMS. Dựa trên số liệu kho gửi qua, hãy phân tích xem việc thêm nhân sự vào Zone này có tối ưu không. Nếu có một Zone khác đang thiếu người trầm trọng, hãy viết một câu gợi ý ngắn gọn bằng Tiếng Việt (khoảng 30-40 từ) khuyên người dùng điều hướng nhân sự sang Zone thiếu kèm số liệu thuyết phục. Nếu Zone hiện tại thực sự cần người, trả về chuỗi rỗng.";

        // Cấu trúc chuẩn REST payload của Gemini API
        var payload = new
        {
            system_instruction = new
            {
                parts = new[] { new { text = systemInstruction } }
            },
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[] { new { text = promptContext } }
                }
            },
            generationConfig = new
            {
                temperature = 0.3, // Temperature thấp đảm bảo nội dung sát thực tế, tập trung con số
                maxOutputTokens = 100
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(endpoint, content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            // Trong trường hợp quá tải API, ta chấp nhận fallback về trả null thay vì làm ngắt luồng Admin
            return string.Empty;
        }

        var jsonResponse = await response.Content.ReadAsStringAsync();
        using var jsonDocument = JsonDocument.Parse(jsonResponse);

        try
        {
            // Parse cấu trúc JSON Extract text
            var textResult = jsonDocument.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            return textResult ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }
}
```

## 3. Lớp WebAPI (Controller)

Định nghĩa Endpoint cấu trúc `POST /api/v1/permissions/check-zone-efficiency`.

```csharp
// WebApi/Controllers/PermissionsController.cs
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Zones.Commands;

namespace SmartWMS.API.Controllers;

[ApiController]
[Route("api/v1/permissions")]
[Authorize(Roles = "Admin")] // Bảo mật nâng cao: Chỉ Admin mới có quyền gọi Endpoint điều phối
public class PermissionsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PermissionsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Tích hợp AI (Gemini) Đánh giá và Gợi ý điều hướng nhân sự đến Zone khác
    /// </summary>
    [HttpPost("check-zone-efficiency")]
    public async Task<IActionResult> CheckZoneEfficiency([FromBody] CheckZoneEfficiencyRequest request)
    {
        var command = new CheckZoneEfficiencyCommand(request.ZoneId);
        var result = await _mediator.Send(command);

        // Map kết quả sang trả về chuẩn Object API JSON mà Frontend mong đợi
        return Ok(new
        {
            hasSuggestion = result.HasSuggestion,
            recommendedZoneId = result.RecommendedZoneId,
            suggestionText = result.SuggestionText
        });
    }
}

// Input Model Binding
public class CheckZoneEfficiencyRequest
{
    public string ZoneId { get; set; } = string.Empty;
}
```
