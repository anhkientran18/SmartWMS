using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Features.Products.Commands;
using SmartWMS.Domain.Localization;
using SmartWMS.Application.Features.Products.Queries;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")]
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly IMediator _mediator; // Thêm MediatR

    public ProductsController(IStringLocalizer<SharedResource> localizer, IMediator mediator)
    {
        _localizer = localizer;
        _mediator = mediator;
    }

    [HttpGet]
    public IActionResult Get()
    {
        var message = _localizer["Success"];
        return Ok(new { Message = message.Value });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductCommand command)
    {
        // Gửi lệnh xuống tầng Application xử lý logic trùng SKU và lưu DB
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpGet("semantic-search")]
    public async Task<IActionResult> SemanticSearch([FromQuery] string query, [FromQuery] double minScore = 0.5)
    {
        var result = await _mediator.Send(new SemanticSearchProductsQuery(query, minScore));

        if (result.IsSuccess)
            return Ok(result);

        return BadRequest(result);
    }
}