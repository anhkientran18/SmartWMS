using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Reports.Queries.ExportInventoryExcel;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")] // Chỉ cấp quản lý mới được tải báo cáo
[ApiController]
[Route("api/v1/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ReportsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportInventoryExcel()
    {
        var result = await _mediator.Send(new ExportInventoryExcelQuery());

        if (result.IsSuccess && result.Data != null)
        {
            // Trả về file trực tiếp cho người dùng tải xuống
            return File(
                fileContents: result.Data,
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileDownloadName: $"BaoCaoTonKho_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx"
            );
        }

        return BadRequest(result.Message);
    }
}