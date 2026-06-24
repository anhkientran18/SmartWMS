using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Zones.Commands;

public class UpdateZoneCommandHandler : IRequestHandler<UpdateZoneCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    public UpdateZoneCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<bool>> Handle(UpdateZoneCommand request, CancellationToken cancellationToken)
    {
        var zone = await _context.Zones.FindAsync(new object[] { request.Id }, cancellationToken);
        if (zone == null) return Result<bool>.Failure("Khu vực không tồn tại.");

        zone.Name = request.Name;
        zone.WarehouseId = request.WarehouseId;

        await _context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Cập nhật khu vực thành công.");
    }
}