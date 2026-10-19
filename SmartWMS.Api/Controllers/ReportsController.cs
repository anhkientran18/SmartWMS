using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Reports.Queries.ExportInventoryExcel;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ReportsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportInventoryExcel()
    {
        var result = await _mediator.Send(new ExportInventoryExcelQuery());
        if (result.IsSuccess && result.Data != null)
        {
            return File(
                fileContents: result.Data,
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileDownloadName: $"BaoCaoTonKho_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx"
            );
        }
        return BadRequest(result.Message);
    }
}