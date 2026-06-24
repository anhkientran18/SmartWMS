using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Bins.Commands;
using SmartWMS.Application.Features.Bins.Commands.CreateBin;
using SmartWMS.Application.Features.Bins.Commands.UpdateBin;
using SmartWMS.Application.Features.Bins.Queries.GetBinContent;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")] // Mặc định bảo mật: Chỉ Admin và Manager mới được can thiệp cấu trúc kho
[ApiController]
[Route("api/v1/[controller]")]
public class BinsController : ControllerBase
{
    private readonly IMediator _mediator;

    public BinsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// API Thêm mới một ô kệ (Bin) lồng ghép AI gợi ý sức chứa lý tưởng
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBinCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    /// <summary>
    /// API Cập nhật thông tin cấu hình ô kệ (Mã code, Sức chứa tối đa)
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBinCommand command)
    {
        if (id != command.Id)
        {
            return BadRequest(new { isSuccess = false, message = "Mã định danh ID ô kệ không khớp." });
        }

        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    /// <summary>
    /// API Tháo dỡ (Xóa) ô kệ khỏi sơ đồ kho bãi
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _mediator.Send(new DeleteBinCommand(id));

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    /// <summary>
    /// API Endpoint tra cứu xem trong một Ô Kệ cụ thể đang chứa các sản phẩm gì, số lượng bao nhiêu
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")] // ĐÃ SỬA: Mở rộng phân quyền cho Staff hiện trường quét kiểm tra qua PDA
    [HttpGet("{id}/contents")] // ĐÃ SỬA: Loại bỏ dòng khai báo trùng lặp gây lỗi xung đột định tuyến
    public async Task<IActionResult> GetBinContents([FromRoute] Guid id)
    {
        var query = new GetBinContentQuery { BinId = id };
        var result = await _mediator.Send(query);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
}