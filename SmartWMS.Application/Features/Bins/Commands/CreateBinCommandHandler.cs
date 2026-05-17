using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.Bins.Commands;

public class CreateBinCommandHandler : IRequestHandler<CreateBinCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;
    private readonly IAgentCapacityService _aiService; // Gọi AI Agent

    public CreateBinCommandHandler(IApplicationDbContext context, IAgentCapacityService aiService)
    {
        _context = context;
        _aiService = aiService;
    }

    public async Task<Result<Guid>> Handle(CreateBinCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra vị trí Zone có tồn tại không
        var zoneExists = await _context.Zones.AnyAsync(z => z.Id == request.ZoneId, cancellationToken);
        if (!zoneExists) return Result<Guid>.Failure("Khu vực kho (Zone) không hợp lệ.");

        // 2. GỌI AI AGENT: Phân tích không gian sinh sức chứa tối ưu tự động
        int optimizedCapacity = await _aiService.SuggestOptimizeCapacityAsync(request.Width, request.Height, request.Depth);

        // 3. Khởi tạo thực thể Bin
        var bin = new Bin
        {
            Id = Guid.NewGuid(),
            Code = request.Code,
            ZoneId = request.ZoneId,
            MaxCapacity = optimizedCapacity, // Gán giá trị thông minh do AI tính toán!
            CurrentOccupancy = 0
        };

        _context.Bins.Add(bin);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(bin.Id, $"Tạo vị trí kệ thành công. AI gợi ý sức chứa tối ưu: {optimizedCapacity} kiện hàng.");
    }
}