using System.Threading.Tasks;

namespace SmartWMS.Application.Common.Interfaces;

public interface IAiInsightService
{
    // Sử dụng cho AI Agent chạy ngầm soạn văn bản/email
    Task<string> GenerateInsightAsync(string prompt);

    // Sử dụng cho biểu đồ phân tích trên Web Dashboard của WarehouseManager
    Task<string> GenerateExecutiveInsightAsync(string statisticalData);

    // Sử dụng cho OCR quét bóc tách hóa đơn nhập kho
    Task<string> AnalyzeReceiptImageAsync(byte[] imageBytes, string mimeType);

    // Sử dụng cho NLP bóc tách khẩu lệnh rảnh tay của nhân viên kho
    Task<string> ParseVoiceCommandAsync(string voiceText);

    // BỔ SUNG MỚI: Sử dụng cho Computer Vision phân loại hàng lỗi hiện trường
    Task<string> AnalyzeDamageImageAsync(byte[] imageBytes, string mimeType);
    Task<string> AnalyzeSlottingOptimizationAsync(string movementDataJson);

    // 🌟 BỔ SUNG MỚI: Sử dụng cho AI Dự báo tồn kho (Forecasts)
    Task<string> PredictDemandAsync(string jsonPayload);

    // Existing implementations remain compatible; production transports override these to cancel I/O.
    Task<string> GenerateInsightAsync(string prompt, CancellationToken ct) => GenerateInsightAsync(prompt).WaitAsync(ct);
    Task<string> GenerateExecutiveInsightAsync(string data, CancellationToken ct) => GenerateExecutiveInsightAsync(data).WaitAsync(ct);
    Task<string> AnalyzeReceiptImageAsync(byte[] bytes, string mime, CancellationToken ct) => AnalyzeReceiptImageAsync(bytes, mime).WaitAsync(ct);
    Task<string> ParseVoiceCommandAsync(string text, CancellationToken ct) => ParseVoiceCommandAsync(text).WaitAsync(ct);
    Task<string> AnalyzeDamageImageAsync(byte[] bytes, string mime, CancellationToken ct) => AnalyzeDamageImageAsync(bytes, mime).WaitAsync(ct);
    Task<string> AnalyzeSlottingOptimizationAsync(string data, CancellationToken ct) => AnalyzeSlottingOptimizationAsync(data).WaitAsync(ct);
    Task<string> PredictDemandAsync(string data, CancellationToken ct) => PredictDemandAsync(data).WaitAsync(ct);
}
