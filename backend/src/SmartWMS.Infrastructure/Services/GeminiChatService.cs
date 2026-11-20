using SmartWMS.Application.Common.Interfaces;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Services;

public class GeminiChatService : IAiChatService
{
    private readonly IAiInsightService _insightService;

    public GeminiChatService(IAiInsightService insightService)
    {
        _insightService = insightService;
    }

    public async Task<string> AskGeminiWithContextAsync(string userMessage, string contextData)
    {
        string fullPrompt = $"Ngữ cảnh dữ liệu kho hiện tại:\n{contextData}\n\nCâu hỏi của người dùng: {userMessage}";
        return await _insightService.GenerateInsightAsync(fullPrompt);
    }
}