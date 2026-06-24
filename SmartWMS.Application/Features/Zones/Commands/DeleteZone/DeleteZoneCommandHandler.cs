using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Zones.Commands;

public class DeleteZoneCommandHandler : IRequestHandler<DeleteZoneCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    public DeleteZoneCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<bool>> Handle(DeleteZoneCommand request, CancellationToken cancellationToken)
    {
        var zone = await _context.Zones.FindAsync(new object[] { request.Id }, cancellationToken);
        if (zone == null) return Result<bool>.Failure("Khu vực không tồn tại.");

        // RÀNG BUỘC LOGISTICS: Chặn xóa nếu khu vực đang chứa các ô kệ (Bins)
        var hasBins = await _context.Bins.AnyAsync(b => b.ZoneId == request.Id, cancellationToken);
        if (hasBins)
            return Result<bool>.Failure("Không thể xóa khu vực này vì hệ thống đang có các ô kệ (Bin) nằm bên trong. Vui lòng xóa các ô kệ trước.");

        _context.Zones.Remove(zone);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Xóa khu vực thành công.");
    }
}