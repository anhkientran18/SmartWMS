using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Commands.CreateBin;

public class CreateBinCommandHandler : IRequestHandler<CreateBinCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;

    public CreateBinCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<Guid>> Handle(CreateBinCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra mã Code ô kệ đã tồn tại trong hệ thống chưa (Chống trùng lặp mã vị trí)
        var isCodeSubstituted = await _context.Bins
            .AnyAsync(b => b.Code == request.Code, cancellationToken);

        if (isCodeSubstituted)
        {
            return Result<Guid>.Failure($"Mã vị trí kệ '{request.Code}' đã tồn tại trên sơ đồ kho.");
        }

        // 2. Khởi tạo thực thể mới với kiểu dữ liệu double đồng bộ tuyệt đối
        var bin = new Bin
        {
            Id = Guid.NewGuid(),
            Code = request.Code,
            ZoneId = request.ZoneId,
            MaxCapacity = request.MaxCapacity, // Gán trực tiếp double sang double an toàn
            CurrentOccupancy = 0.0             // Ô kệ mới tạo mặc định sức chứa đã dùng bằng 0
        };

        _context.Bins.Add(bin);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(bin.Id, $"Khởi tạo thành công ô kệ vị trí {bin.Code} trên sơ đồ.");
    }
}