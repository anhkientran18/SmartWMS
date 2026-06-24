using QRCoder;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.Services;

public class BarcodeService : IBarcodeService
{
    public async Task<string> GenerateQrCodeBase64Async(string text)
    {
        return await Task.Run(() =>
        {
            // Khởi tạo bộ tạo mã QR
            using var qrGenerator = new QRCodeGenerator();
            // Mức độ sửa lỗi Q (Chấp nhận mã QR bị mờ/rách 25% vẫn quét được)
            using var qrCodeData = qrGenerator.CreateQrCode(text, QRCodeGenerator.ECCLevel.Q);

            // Xuất ra mảng Byte dạng PNG
            using var qrCode = new PngByteQRCode(qrCodeData);
            byte[] qrCodeImage = qrCode.GetGraphic(20); // Số 20 là kích thước pixel của mỗi ô vuông nhỏ

            // Chuyển đổi thành chuỗi Base64
            return Convert.ToBase64String(qrCodeImage);
        });
    }
}