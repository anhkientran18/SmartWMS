namespace SmartWMS.Application.Common.Models;

public enum ErrorType
{
    Failure = 0,     // Lỗi nghiệp vụ chung (400 Bad Request)
    Validation = 1,  // Lỗi xác thực dữ liệu đầu vào (400 Bad Request)
    NotFound = 2,    // Không tìm thấy tài nguyên (404 Not Found)
    Unauthorized = 3,// Chưa xác thực người dùng (401 Unauthorized)
    Forbidden = 4,   // Không có quyền truy cập (403 Forbidden)
    Conflict = 5     // Trùng lặp dữ liệu / Xung đột trạng thái (409 Conflict)
}