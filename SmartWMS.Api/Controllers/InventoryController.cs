using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;
using SmartWMS.Application.Features.InventoryManagement.Commands.AutoReplenish;
using SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;
using SmartWMS.Application.Features.InventoryManagement.Commands.CreateCountSheet;
using SmartWMS.Application.Features.InventoryManagement.Commands.MoveInventory;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")] // Quyền mặc định cấp Class áp dụng cho luồng vận hành thông thường
[ApiController]
[Route("api/v1/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly IMediator _mediator;

    public InventoryController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// API Lệnh điều chuyển vị trí hàng hóa nội bộ kho bãi (Bin-to-Bin Transfer)
    /// </summary>
    [HttpPost("move-stock")]
    public async Task<IActionResult> MoveStock([FromBody] MoveInventoryCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    /// <summary>
    /// API Lệnh điều chỉnh, cân đối sai lệch tồn kho thực tế do thất thoát/hư hỏng (Stock Adjustment)
    /// </summary>
    [Authorize(Roles = "Admin,Manager")] // Ghi đè bảo mật cao cấp: Loại bỏ quyền Staff để chống gian lận số liệu
    [HttpPost("adjust-stock")]
    public async Task<IActionResult> AdjustStock([FromBody] AdjustStockCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    /// <summary>
    /// API Endpoint tra cứu lịch sử và vết tích biến động tồn kho (Inventory Audit Trail Ledger)
    /// </summary>
    [HttpGet("stock-history")]
    public async Task<IActionResult> GetStockHistory([FromQuery] Guid? productId, [FromQuery] string? transactionType)
    {
        var query = new GetStockHistoryQuery
        {
            ProductId = productId,
            TransactionType = transactionType ?? string.Empty
        };

        var result = await _mediator.Send(query);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    /// <summary>
    /// API Kích hoạt bộ máy tự động rà soát và nạp bù hàng tiền phương (Auto-Replenishment Engine)
    /// </summary>
    [HttpPost("run-auto-replenish")]
    public async Task<IActionResult> RunAutoReplenish()
    {
        var result = await _mediator.Send(new AutoReplenishCommand());
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    /// <summary>
    /// API Khởi tạo phiếu kiểm kho và đóng băng vị trí phục vụ kiểm toán hiện trường (Physical Count Sheet)
    /// </summary>
    [Authorize(Roles = "Admin,Manager")]
    [HttpPost("create-count-sheet")]
    public async Task<IActionResult> CreateCountSheet([FromBody] CreateCountSheetCommand command) // 🌟 ĐÃ RÚT GỌN: Nhờ sử dụng using namespace ở trên
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    /// <summary>
    /// API Thay đổi trạng thái chất lượng tồn kho - Khóa hoặc mở khóa hàng xuất kho (QC Status Transition)
    /// </summary>
    [Authorize(Roles = "Admin,Manager")] // Chỉ cấp quản lý hoặc bộ phận kiểm định chất lượng mới được thực thi
    [HttpPost("change-status")]
    public async Task<IActionResult> ChangeStockStatus([FromBody] ChangeStockStatusCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
}