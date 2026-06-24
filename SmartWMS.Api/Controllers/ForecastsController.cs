using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast; // Khớp chính xác thư mục Use Case
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")]
[ApiController]
[Route("api/v1/[controller]")]
public class ForecastsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ForecastsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // API Endpoint trích xuất biểu đồ dự báo nhu cầu tiêu thụ mặt hàng trong 30 ngày tới
    [HttpGet("demand-prediction")]
    public async Task<IActionResult> GetDemandPrediction([FromQuery] string sku)
    {
        var query = new GetStockForecastQuery { SKU = sku };

        // Thực thi gửi qua trục MediatR Pipeline để nhận về Result<StockForecastResultDto>
        var result = await _mediator.Send(query);

        if (result.IsSuccess)
        {
            // ĐÃ SỬA: Trả về Ok(result) trực tiếp. Tầng Application đã đóng gói sẵn 
            // thuộc tính Forecast Data dưới dạng JsonElement nên dữ liệu xuất ra sẽ tự động sạch sẽ.
            return Ok(result);
        }

        return BadRequest(result);
    }
}