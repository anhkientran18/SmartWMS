using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks.Dtos;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;

public class GetPendingCountTasksQueryHandler : IRequestHandler<GetPendingCountTasksQuery, Result<List<CycleCountTaskDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetPendingCountTasksQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<CycleCountTaskDto>>> Handle(GetPendingCountTasksQuery request, CancellationToken cancellationToken)
    {
        var products = await _context.Products
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var pendingTasks = new List<CycleCountTaskDto>();
        var random = new Random();

        foreach (var product in products)
        {
            string abcClass = "C";
            int intervalDays = 90;
            string priority = "Thấp (Kiểm kê định kỳ 3 tháng)";
            string skuUpper = (product.SKU ?? string.Empty).ToUpper();

            if (skuUpper.Contains("ASUS") || skuUpper.Contains("LOGI"))
            {
                abcClass = "A";
                intervalDays = 7;
                priority = "🔥 CAO KHẨN CẤP (Chu kỳ 7 ngày - Tránh thất thoát linh kiện giá trị)";
            }
            else if (skuUpper.Contains("MILK") || skuUpper.Contains("COCA"))
            {
                abcClass = "B";
                intervalDays = 30;
                priority = "Trung Bình (Chu kỳ 30 ngày - Kiểm soát hạn dùng FEFO)";
            }

            int daysSinceLastCount = random.Next(1, 120);

            if (daysSinceLastCount >= intervalDays)
            {
                pendingTasks.Add(new CycleCountTaskDto
                {
                    ProductId = product.Id,
                    SKU = product.SKU ?? string.Empty,
                    ProductName = product.Name ?? string.Empty,
                    ABCClassification = abcClass,
                    ScheduledIntervalDays = intervalDays,
                    TargetZone = abcClass == "B" ? "Khu Mát (Cold Zone)" : "Khu Khô (Dry Zone)",
                    PriorityMessage = priority
                });
            }
        }

        var orderedTasks = pendingTasks
            .OrderBy(x => x.ABCClassification)
            .ToList();

        return Result<List<CycleCountTaskDto>>.Success(orderedTasks);
    }
}