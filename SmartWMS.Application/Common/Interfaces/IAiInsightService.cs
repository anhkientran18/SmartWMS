namespace SmartWMS.Application.Common.Interfaces;

public interface IAiInsightService
{
    // Sử dụng cho AI Agent chạy ngầm soạn văn bản/email
    Task<string> GenerateInsightAsync(string prompt);

    // Sử dụng cho biểu đồ phân tích trên Web Dashboard của Manager
    Task<string> GenerateExecutiveInsightAsync(string statisticalData);

    // Sử dụng cho OCR quét bóc tách hóa đơn nhập kho
    Task<string> AnalyzeReceiptImageAsync(byte[] imageBytes, string mimeType);

    // Sử dụng cho NLP bóc tách khẩu lệnh rảnh tay của nhân viên kho
    Task<string> ParseVoiceCommandAsync(string voiceText);

    // BỔ SUNG MỚI: Sử dụng cho Computer Vision phân loại hàng lỗi hiện trường
    Task<string> AnalyzeDamageImageAsync(byte[] imageBytes, string mimeType);
    Task<string> AnalyzeSlottingOptimizationAsync(string movementDataJson);
}