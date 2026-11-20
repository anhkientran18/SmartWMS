using ClosedXML.Excel;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Reports.Queries.ExportInventoryExcel;

public class ExportInventoryExcelQueryHandler : IRequestHandler<ExportInventoryExcelQuery, Result<byte[]>>
{
    private readonly IApplicationDbContext _context;

    public ExportInventoryExcelQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<byte[]>> Handle(ExportInventoryExcelQuery request, CancellationToken cancellationToken)
    {
        // 1. Lấy dữ liệu tồn kho thực tế từ DB
        var bins = await _context.Bins
            .Include(b => b.Zone)
            .Where(b => !b.IsDeleted)
            .AsNoTracking()
            .OrderBy(b => b.Zone!.Name) // Đã tắt cảnh báo Null chuẩn xác
            .ThenBy(b => b.Code)
            .ToListAsync(cancellationToken);

        if (!bins.Any())
            return Result<byte[]>.Failure("Không có dữ liệu tồn kho thực tế để xuất báo cáo.");

        // 2. Khởi tạo File Excel bằng ClosedXML
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("BaoCaoTonKho");

        // 3. Thiết lập Tiêu đề cột (Header)
        var headers = new[] { "STT", "Mã Ô Kệ (Bin)", "Khu Vực (Zone)", "Sức Chứa Tối Đa", "Đang Chứa", "Tỷ Lệ Lấp Đầy (%)" };
        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(1, i + 1).Value = headers[i];
        }

        // 4. Đổ dữ liệu chi tiết
        int row = 2;
        int stt = 1;

        foreach (var bin in bins)
        {
            worksheet.Cell(row, 1).Value = stt++;
            worksheet.Cell(row, 2).Value = bin.Code ?? "N/A";
            worksheet.Cell(row, 3).Value = bin.Zone != null ? bin.Zone.Name : "Chưa phân khu";
            worksheet.Cell(row, 4).Value = bin.MaxCapacity;
            worksheet.Cell(row, 5).Value = bin.CurrentOccupancy;

            double utilization = bin.MaxCapacity > 0
                ? Math.Round((bin.CurrentOccupancy / bin.MaxCapacity) * 100, 2)
                : 0.0;

            worksheet.Cell(row, 6).Value = utilization;
            row++;
        }

        // 5. Khởi tạo bảng và Format Theme
        var table = worksheet.Range(1, 1, row - 1, 6).CreateTable();
        table.Theme = XLTableTheme.TableStyleMedium2;
        worksheet.Columns().AdjustToContents();

        // 6. Xuất ra mảng Byte
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var content = stream.ToArray();

        return Result<byte[]>.Success(content, "Xuất báo cáo Excel tồn kho thành công.");
    }
}