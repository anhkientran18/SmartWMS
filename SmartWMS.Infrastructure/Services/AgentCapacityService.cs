using SmartWMS.Application.Common.Interfaces;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Services;

public class AgentCapacityService : IAgentCapacityService
{
    private readonly IAiInsightService _insightService;

    public AgentCapacityService(IAiInsightService insightService)
    {
        _insightService = insightService;
    }

    public async Task<int> SuggestOptimizeCapacityAsync(double width, double height, double depth)
    {
        string prompt = $"Kệ kho có kích thước: Dài {width}cm, Cao {height}cm, Sâu {depth}cm. Giả định chứa các thùng hàng tiêu chuẩn 30x30x30cm và hệ số xếp chồng 80%. Hãy tính toán số lượng thùng tối đa kệ chứa được. CHỈ TRẢ VỀ MỘT SỐ NGUYÊN DUY NHẤT.";
        string result = await _insightService.GenerateInsightAsync(prompt);

        var match = Regex.Match(result, @"\d+");
        if (match.Success && int.TryParse(match.Value, out int capacity))
        {
            return capacity;
        }

        return (int)((width * height * depth) / (30 * 30 * 30) * 0.8);
    }
}