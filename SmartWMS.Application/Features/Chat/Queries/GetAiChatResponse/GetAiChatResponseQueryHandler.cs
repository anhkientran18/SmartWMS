using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Chat.Queries.GetAiChatResponse;

public class GetAiChatResponseQueryHandler : IRequestHandler<GetAiChatResponseQuery, Result<string>>
{
    private readonly IAiInsightService _aiInsightService;

    public GetAiChatResponseQueryHandler(IAiInsightService aiInsightService)
    {
        _aiInsightService = aiInsightService;
    }

    public async Task<Result<string>> Handle(GetAiChatResponseQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RequestData.Message))
            return Result<string>.Failure("Tin nhắn không được để trống.");

        // Gọi hàm GenerateInsightAsync của IAiInsightService để xử lý prompt trao đổi với AI
        string aiResponse = await _aiInsightService.GenerateInsightAsync(request.RequestData.Message);

        return Result<string>.Success(aiResponse, "Phản hồi từ AI Chatbot thành công.");
    }
}