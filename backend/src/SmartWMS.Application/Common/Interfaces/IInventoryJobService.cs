using System.Threading.Tasks;

namespace SmartWMS.Application.Common.Interfaces;

public interface IInventoryJobService
{
    /// Định kỳ chạy ngầm quét kho để phát hiện và đóng băng toàn bộ các lô hàng hết hạn sử dụng (FEFO Rule)
    Task RunExpiredStockLockJobAsync();
}