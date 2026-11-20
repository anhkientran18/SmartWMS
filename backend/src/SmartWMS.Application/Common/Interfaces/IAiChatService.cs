namespace SmartWMS.Application.Common.Interfaces;

public interface IAiChatService
{
    // Cập nhật tên phương thức chính xác để sửa lỗi định nghĩa
    Task<string> AskGeminiWithContextAsync(string userMessage, string contextData);
}