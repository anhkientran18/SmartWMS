using System.Threading.Tasks;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Common.Interfaces;

public interface IAiForecastingService
{
    // Hàm gửi lịch sử xuất kho sang Microservice Python để nhận dự báo nhu cầu và ngưỡng an toàn (Safety Stock)
    Task<string> Get30DaysDemandForecastAsync(string historicalDataJson);
}