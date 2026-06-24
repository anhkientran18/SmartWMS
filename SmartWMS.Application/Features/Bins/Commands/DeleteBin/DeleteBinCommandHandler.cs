using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Commands;

public class DeleteBinCommandHandler : IRequestHandler<DeleteBinCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public DeleteBinCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> Handle(DeleteBinCommand request, CancellationToken cancellationToken)
    {
        // 1. Tìm kiếm ô kệ cần xóa
        var bin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

        if (bin == null)
        {
            return Result<bool>.Failure("Không tìm thấy ô kệ yêu cầu tháo dỡ.");
        }

        // 2. RÀNG BUỘC DOANH NGHIỆP: Ô kệ đang chứa hàng thì không được phép xóa mềm
        var hasStock = await _context.BinInventories
            .AnyAsync(x => x.BinId == request.Id && x.Quantity > 0, cancellationToken);

        if (hasStock)
        {
            return Result<bool>.Failure($"Không thể tháo dỡ ô kệ {bin.Code}! Ô kệ này hiện vẫn đang chứa hàng hóa thực tế bên trong.");
        }

        // 3. THỰC THI XÓA MỀM (SOFT DELETE)
        // Thay vì dùng lệnh DELETE cứng làm mất dữ liệu giao dịch, ta đổi trạng thái ẩn
        bin.IsDeleted = true;
        bin.UpdatedAt = DateTime.UtcNow;
        bin.UpdatedBy = "SystemAdmin";

        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã ẩn và tháo dỡ ô kệ {bin.Code} khỏi sơ đồ vận hành kho thành công.");
    }
}