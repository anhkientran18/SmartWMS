using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Commands;
using SmartWMS.Application.Features.Products.Commands.Create;
using SmartWMS.Application.Features.Products.Commands.Delete; // 🌟 BỔ SUNG: Khớp lệnh Delete
using SmartWMS.Application.Features.Products.Commands.Update; // 🌟 BỔ SUNG: Khớp lệnh Update
using SmartWMS.Application.Features.Products.Queries;
using SmartWMS.Application.Features.Products.Queries.GetAllProducts; // 🌟 BỔ SUNG: Sửa lỗi thiếu GetAllProductsQuery
using SmartWMS.Application.Features.Products.Queries.GetPaginatedProducts; // 🌟 BỔ SUNG: Sửa lỗi thiếu GetPaginatedProductsQuery
using SmartWMS.Application.Features.Products.Queries.GetProductById; // 🌟 BỔ SUNG: Khớp truy vấn theo ID
using SmartWMS.Application.Features.Products.Queries.GetProductQrCode;
using SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;
using SmartWMS.Application.Features.Products.Queries.ParseBarcode;
using SmartWMS.Domain.Localization;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")]
[ApiController]
[Route("api/v1/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly IMediator _mediator;

    public ProductsController(IStringLocalizer<SharedResource> localizer, IMediator mediator)
    {
        _localizer = localizer;
        _mediator = mediator;
    }

    // 1. LẤY CHI TIẾT THEO ID
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetProductByIdQuery(id));
        if (result.IsSuccess) return Ok(result);
        return NotFound(result);
    }

    // 2. LẤY TOÀN BỘ DANH SÁCH (Không phân trang)
    [HttpGet("all")]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(new GetAllProductsQuery());
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    // 3. LẤY DANH SÁCH PHÂN TRANG & TÌM KIẾM
    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchKeyword = null)
    {
        var result = await _mediator.Send(new GetPaginatedProductsQuery(pageNumber, pageSize, searchKeyword));
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    // 4. TẠO MỚI SẢN PHẨM
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    // 5. CẬP NHẬT SẢN PHẨM
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductCommand command)
    {
        if (id != command.Id)
        {
            return BadRequest(Result<bool>.Failure("ID sản phẩm không khớp."));
        }

        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    // 6. XÓA MỀM SẢN PHẨM
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _mediator.Send(new DeleteProductCommand(id));
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    // 7. TÌM KIẾM NGỮ NGHĨA AI (VECTOR SEARCH)
    [HttpGet("semantic-search")]
    public async Task<IActionResult> SemanticSearch([FromQuery] string text)
    {
        var query = new GetSemanticProductsQuery { SearchText = text };
        var result = await _mediator.Send(query);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    // 8. XUẤT MÃ QR CODE SẢN PHẨM
    [HttpGet("{sku}/qrcode")]
    public async Task<IActionResult> GetQrCode(string sku)
    {
        var result = await _mediator.Send(new GetProductQrCodeQuery(sku));
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    // 9. BÓC TÁCH MÃ VẠCH THÔNG MINH TỪ THIẾT BỊ PDA
    [HttpPost("parse-barcode")]
    public async Task<IActionResult> ParseBarcode([FromBody] ParseBarcodeQuery query)
    {
        var result = await _mediator.Send(query);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
}