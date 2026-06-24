using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using System.Text;

namespace SmartWMS.Application.Features.Chat.Queries.GetAiChatResponse;

public class GetAiChatResponseQueryHandler : IRequestHandler<GetAiChatResponseQuery, Result<string>>
{
    private readonly IApplicationDbContext _context;
    private readonly IAiChatService _aiChatService;

    public GetAiChatResponseQueryHandler(IApplicationDbContext context, IAiChatService aiChatService)
    {
        _context = context;
        _aiChatService = aiChatService;
    }

    public async Task<Result<string>> Handle(GetAiChatResponseQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return Result<string>.Failure("Câu hỏi không được để trống.");

        // 1. TRÍCH XUẤT DỮ LIỆU THỰC TẾ (Retrieval)
        // Thu thập thông tin từ bảng Bins và thông tin sản phẩm (nếu có liên kết)
        var binsData = await _context.Bins
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // 2. XÂY DỰNG NGỮ CẢNH (Context Generation)
        var contextBuilder = new StringBuilder();
        contextBuilder.AppendLine("Dưới đây là trạng thái dữ liệu tồn kho thời gian thực của hệ thống SmartWMS:");

        foreach (var bin in binsData)
        {
            contextBuilder.AppendLine($"- Vị trí kệ (Bin Code): {bin.Code} | Sức chứa tối đa: {bin.MaxCapacity} | Số lượng hàng hiện tại: {bin.CurrentOccupancy} kiện.");
        }

        contextBuilder.AppendLine("\nHãy sử dụng dữ liệu chính xác trên để trả lời câu hỏi của người dùng. Nếu câu hỏi không liên quan đến dữ liệu kho, hãy trả lời lịch sự dựa trên vai trò Trợ lý ảo SmartWMS.");

        // 3. GỬI SANG AI AGENT XỬ LÝ (Generation)
        string aiResponse = await _aiChatService.AskGeminiWithContextAsync(request.Message, contextBuilder.ToString());

        return Result<string>.Success(aiResponse);
    }
}