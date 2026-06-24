using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Reports.Queries.ExportInventoryExcel;

// Vì Handler của bạn xuất toàn bộ ô kệ hiện tại mà không nhận tham số lọc, 
// chúng ta sẽ định nghĩa một Record rỗng tinh gọn để MediatR kích hoạt
public record ExportInventoryExcelQuery : IRequest<Result<byte[]>>;