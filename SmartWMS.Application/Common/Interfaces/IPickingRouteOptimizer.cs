using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Common.Interfaces;

public interface IPickingRouteOptimizer
{
    /// Sắp xếp danh sách chỉ thị bốc hàng theo thuật toán S-Shape để tối ưu hóa quãng đường đi bộ của công nhân
    /// <typeparam name="T">Kiểu dữ liệu của DTO chứa vị trí</typeparam>
    /// <param name="locations">Danh sách các vị trí cần bốc hàng</param>
    /// <param name="binCodeSelector">Hàm lambda trỏ tới chuỗi mã Code của ô kệ (Ví dụ: x => x.BinCode)</param>
    List<T> OptimizeBySShape<T>(List<T> locations, Func<T, string> binCodeSelector);
}