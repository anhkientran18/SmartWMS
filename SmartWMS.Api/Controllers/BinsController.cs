using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Bins.Commands.CreateBin;
using SmartWMS.Application.Features.Bins.Commands.DeleteBin;
using SmartWMS.Application.Features.Bins.Commands.UpdateBin;
using SmartWMS.Application.Features.Bins.DTOs.Commands;
using SmartWMS.Application.Features.Bins.DTOs.Queries;
using SmartWMS.Application.Features.Bins.Queries.GetBinById;
using SmartWMS.Application.Features.Bins.Queries.GetBinContent;
using SmartWMS.Application.Features.Bins.Queries.GetList;
using SmartWMS.Application.Features.Bins.Queries.GetPaginatedBinsByZoneId;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class BinsController : ControllerBase
{
    private readonly IMediator _mediator;
    public BinsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] Guid? zoneId = null, [FromQuery] string? searchKeyword = null)
    => (await _mediator.Send(new GetBinListQuery(new BinListQueryRequest { ZoneId = zoneId, SearchKeyword = searchKeyword }))).ToActionResult();

    // 1. GET /api/v1/bins
    // Chuẩn RESTful: Lấy danh sách ô kệ, lọc linh hoạt qua Query Params (zoneId, searchTerm, pageNumber, pageSize)
    [HttpGet]
    public async Task<IActionResult> GetPaginatedBins(
        [FromQuery] Guid? zoneId = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null)
        => (await _mediator.Send(new GetPaginatedBinsByZoneIdQuery(new BinPaginatedByZoneIdRequest
        {
            ZoneId = zoneId,
            PageNumber = pageNumber,
            PageSize = pageSize,
            SearchTerm = searchTerm
        }))).ToActionResult();

    // 2. GET /api/v1/bins/{id}
    // Lấy thông tin chi tiết 1 ô kệ theo ID
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetBinByIdQuery(new BinByIdQueryRequest { Id = id }))).ToActionResult();

    // 3. GET /api/v1/bins/{id}/contents
    // Lấy danh sách hàng tồn bên trong 1 ô kệ
    [Authorize(Roles = "Admin,WarehouseManager,Staff")]
    [HttpGet("{id:guid}/contents")]
    public async Task<IActionResult> GetBinContents([FromRoute] Guid id)
        => (await _mediator.Send(new GetBinContentQuery(new BinContentQueryRequest { BinId = id }))).ToActionResult();

    // 4. POST /api/v1/bins - Tạo ô kệ mới
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBinRequest request)
        => (await _mediator.Send(new CreateBinCommand(request))).ToActionResult();

    // 5. PUT /api/v1/bins/{id} - Cập nhật thông tin ô kệ
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBinRequest request)
    {
        if (id != request.Id) return BadRequest(new { isSuccess = false, message = "Mã định danh ID ô kệ không khớp." });
        return (await _mediator.Send(new UpdateBinCommand(request))).ToActionResult();
    }

    // 6. DELETE /api/v1/bins/{id} - Xóa ô kệ
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteBinCommand(new DeleteBinRequest { Id = id }))).ToActionResult();
}