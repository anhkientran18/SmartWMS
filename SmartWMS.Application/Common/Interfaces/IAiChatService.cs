namespace SmartWMS.Application.Common.Interfaces;

public interface IAiChatService
{
    // Hàm gửi câu hỏi kèm theo ngữ cảnh dữ liệu thực tế của kho sang cho Gemini
    Task<string> AskGeminiWithContextAsync(string userMessage, string warehouseContext);
}