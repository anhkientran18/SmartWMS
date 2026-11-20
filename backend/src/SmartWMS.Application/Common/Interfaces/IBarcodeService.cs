namespace SmartWMS.Application.Common.Interfaces;

public interface IBarcodeService
{
    // Nhận vào một chuỗi văn bản và trả về hình ảnh QR Code dưới dạng chuỗi Base64
    Task<string> GenerateQrCodeBase64Async(string text);
}