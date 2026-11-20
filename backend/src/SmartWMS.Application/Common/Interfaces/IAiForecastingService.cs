using System.Threading.Tasks;

namespace SmartWMS.Application.Common.Interfaces;

public interface IAiForecastingService
{
    Task<string> PredictDemandAsync(string jsonPayload);
}