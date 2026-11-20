using SmartWMS.Application.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace SmartWMS.Infrastructure.Services;

public class PickingRouteOptimizer : IPickingRouteOptimizer
{
    public List<T> OptimizeBySShape<T>(List<T> locations, Func<T, string> binCodeSelector)
    {
        if (locations == null || !locations.Any()) return new List<T>();

        // Đóng gói danh sách kèm theo siêu dữ liệu tọa độ hình học được phân tách
        var parsedRoutes = locations.Select(item =>
        {
            var binCode = binCodeSelector(item) ?? string.Empty;
            var meta = ParseBinCode(binCode);
            return new { OriginalItem = item, Meta = meta };
        }).ToList();

        // THỰC THI GIẢI THUẬT S-SHAPE:
        // 1. Phân loại theo Vùng/Khu kho (Zone/Warehouse Area)
        // 2. Sắp xếp theo thứ tự Dãy hàng (Row/Aisle) tăng dần
        // 3. Tại mỗi dãy hàng: Nếu Dãy hàng LẺ -> Công nhân đi tiến (Tầng/Vị trí tăng dần)
        //                     Nếu Dãy hàng CHẴN -> Công nhân đi lùi (Tầng/Vị trí giảm dần)
        var optimizedResult = parsedRoutes
            .OrderBy(x => x.Meta.ZonePrefix)
            .ThenBy(x => x.Meta.RowNumber)
            .ThenBy(x => x.Meta.RowNumber % 2 != 0 ? x.Meta.LevelNumber : -x.Meta.LevelNumber)
            .Select(x => x.OriginalItem)
            .ToList();

        return optimizedResult;
    }

    /// <summary>
    /// Trích xuất chuỗi mã vị trí dạng "C-Z1-R3-L2" thành tọa độ số học để tính toán định tuyến
    /// </summary>
    private BinRouteMeta ParseBinCode(string binCode)
    {
        var meta = new BinRouteMeta();
        if (string.IsNullOrEmpty(binCode)) return meta;

        try
        {
            // Regex bóc tách chuỗi mã mồi chuẩn của bạn: C-Z1-R3-L1
            // Nhóm 1: Tiền tố Khu bãi (C-Z1)
            // Nhóm 2: Số dãy hàng sau chữ R (3)
            // Nhóm 3: Số tầng kệ sau chữ L (1)
            var match = Regex.Match(binCode, @"^(.*)-R(\d+)-L(\d+)$", RegexOptions.IgnoreCase);

            if (match.Success)
            {
                meta.ZonePrefix = match.Groups[1].Value;
                meta.RowNumber = int.Parse(match.Groups[2].Value);
                meta.LevelNumber = int.Parse(match.Groups[3].Value);
            }
            else
            {
                // Dự phòng nếu mã không đúng chuẩn định dạng hình học
                meta.ZonePrefix = binCode;
            }
        }
        catch
        {
            meta.ZonePrefix = binCode;
        }

        return meta;
    }

    private class BinRouteMeta
    {
        public string ZonePrefix { get; set; } = string.Empty;
        public int RowNumber { get; set; } = 0;
        public int LevelNumber { get; set; } = 0;
    }
}