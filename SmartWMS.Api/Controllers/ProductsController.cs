using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IStringLocalizer<SharedResource> _localizer;

    public ProductsController(IStringLocalizer<SharedResource> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    public IActionResult Get()
    {
        // Trả về chuỗi "Success" đã được dịch dựa trên Header Accept-Language
        var message = _localizer["Success"];
        return Ok(new { Message = message.Value });
    }
}