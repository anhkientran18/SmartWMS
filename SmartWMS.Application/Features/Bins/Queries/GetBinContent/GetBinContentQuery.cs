using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.Queries.GetBinContent.Dtos; // Import đúng thư mục DTOs mới tách
using System;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent;

public class GetBinContentQuery : IRequest<Result<BinContentHeaderDto>>
{
    // ID của ô kệ cần quét để kiểm tra danh sách hàng bên trong
    public Guid BinId { get; set; }
}