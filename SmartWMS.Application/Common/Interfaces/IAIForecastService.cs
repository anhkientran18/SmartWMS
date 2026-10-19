using System.Threading;
using System.Threading.Tasks;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Common.Interfaces;

public interface IAIForecastService
{
    Task<StockForecastResultDto> PredictDemandAsync(string sku, CancellationToken cancellationToken = default);
}