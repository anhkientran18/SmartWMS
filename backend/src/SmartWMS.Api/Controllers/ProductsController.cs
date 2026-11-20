using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Products.Commands.Create;
using SmartWMS.Application.Features.Products.Commands.Delete;
using SmartWMS.Application.Features.Products.Commands.Update;
using SmartWMS.Application.Features.Products.DTOs.Commands;
using SmartWMS.Application.Features.Products.DTOs.Queries;
using SmartWMS.Application.Features.Products.Queries.GetList;
using SmartWMS.Application.Features.Products.Queries.GetPaginatedProducts;
using SmartWMS.Application.Features.Products.Queries.GetProductById;
using SmartWMS.Application.Features.Products.Queries.GetProductQrCode;
using SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;
using SmartWMS.Application.Features.Products.Queries.ParseBarcode;
using SmartWMS.Domain.Localization;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager,Staff")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly IMediator _mediator;

    public ProductsController(IStringLocalizer<SharedResource> localizer, IMediator mediator)
    {
        _localizer = localizer;
        _mediator = mediator;
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetProductByIdQuery(new ProductByIdQueryRequest { Id = id }))).ToActionResult();

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetProductListQuery(new ProductListQueryRequest { SearchKeyword = searchKeyword }))).ToActionResult();

    [HttpGet]
    public async Task<IActionResult> GetPaged([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetPaginatedProductsQuery(new ProductPaginatedListQueryRequest { PageIndex = pageNumber, PageSize = pageSize, SearchKeyword = searchKeyword }))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest request)
        => (await _mediator.Send(new CreateProductCommand(request))).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest request)
    {
        if (id != request.Id) return BadRequest(new { isSuccess = false, message = "ID sản phẩm không khớp." });
        return (await _mediator.Send(new UpdateProductCommand(request))).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteProductCommand(new DeleteProductRequest { Id = id }))).ToActionResult();

    [HttpGet("semantic-search")]
    public async Task<IActionResult> SemanticSearch([FromQuery] string text, CancellationToken ct)
        => (await _mediator.Send(new GetSemanticProductsQuery(new SemanticSearchProductRequest { SearchText = text }), ct)).ToActionResult();

    [HttpGet("{sku}/qrcode")]
    public async Task<IActionResult> GetQrCode(string sku)
        => (await _mediator.Send(new GetProductQrCodeQuery(new ProductQrCodeQueryRequest { Sku = sku }))).ToActionResult();

    [HttpPost("parse-barcode")]
    public async Task<IActionResult> ParseBarcode([FromBody] ParseBarcodeRequest request)
        => (await _mediator.Send(new ParseBarcodeQuery(request))).ToActionResult();
}