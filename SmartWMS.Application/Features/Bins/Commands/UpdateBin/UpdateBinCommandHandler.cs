using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Commands.UpdateBin; // ĐÃ ĐỒNG BỘ THƯ MỤC

public class UpdateBinCommandHandler : IRequestHandler<UpdateBinCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public UpdateBinCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> Handle(UpdateBinCommand request, CancellationToken cancellationToken)
    {
        var bin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

        if (bin == null)
        {
            return Result<bool>.Failure("Không tìm thấy ô kệ yêu cầu chỉnh sửa.");
        }
            
        if (request.MaxCapacity < bin.CurrentOccupancy)
        {
            return Result<bool>.Failure($"Thao tác thất bại! Sức chứa mới ({request.MaxCapacity}) không được nhỏ hơn lượng hàng thực tế đang nằm trên kệ ({bin.CurrentOccupancy}).");
        }

        bin.Code = request.Code;
        bin.MaxCapacity = request.MaxCapacity;

        await _context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, $"Cập nhật thành công cấu hình ô kệ {bin.Code}.");
    }
}