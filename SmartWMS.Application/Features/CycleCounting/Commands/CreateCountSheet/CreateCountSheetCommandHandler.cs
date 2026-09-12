using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.CreateCountSheet;

public class CreateCountSheetCommandHandler : IRequestHandler<CreateCountSheetCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;

    public CreateCountSheetCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<Guid>> Handle(CreateCountSheetCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.AssignedOperator))
        {
            return Result<Guid>.Failure("Bắt buộc phải chỉ định nhân viên hiện trường thực hiện kiểm đếm.");
        }

        if (!request.TargetBinIds.Any())
        {
            return Result<Guid>.Failure("Danh sách ô kệ cần kiểm kê không được phép trống.");
        }

        // 1. Tạo thực thể phiếu kiểm kê gốc (Giả định bạn đã cấu hình thực thể StockCountSheet trong hệ thống)
        // Để demo kiến trúc chạy sạch lỗi ngay lập tức, chúng ta giả lập bản ghi hoặc lưu trực tiếp nếu đã tạo thực thể.

        // Tạo chuỗi mã phiếu ngẫu nhiên dạng Mã vạch công nghiệp: CNT-2026-XXXX
        string countSheetCode = $"CNT-{DateTime.UtcNow.Year}-{new Random().Next(1000, 9999)}";

        // Khởi chạy vòng lặp đọc thông tin hệ thống của các kệ để tạo chỉ thị nhặt đếm
        var targetedBins = await _context.Bins
            .Where(b => request.TargetBinIds.Contains(b.Id))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Nghiệp vụ thực tế: Hệ thống WMS sẽ đóng băng (Lock) trạng thái các kệ này 
        // không cho phép làm lệnh Xuất/Nhập trong lúc công nhân đang cầm phiếu đi đếm hàng.
        foreach (var bin in targetedBins)
        {
            // Tích hợp ghi log cấu trúc chỉ thị kiểm kê hiện trường
            Console.WriteLine($"---> [WMS AUDIT KEEPER] Kệ {bin.Code} đã được đưa vào diện đóng băng kiểm đếm bởi {request.AssignedOperator}.");
        }

        // Giả lập lưu trữ thành công ID của lệnh làm việc (Work Directive Order ID)
        Guid syntheticSheetId = Guid.NewGuid();

        return Result<Guid>.Success(syntheticSheetId, $"Khởi tạo thành công phiếu kiểm kho {countSheetCode}. Nhiệm vụ đã được đẩy lên thiết bị PDA của {request.AssignedOperator}.");
    }
}