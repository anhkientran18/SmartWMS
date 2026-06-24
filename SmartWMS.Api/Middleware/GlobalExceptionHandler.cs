using FluentValidation; // 🌟 BỔ SUNG: Để nhận diện lỗi Validation từ FluentValidation
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Api.Middlewares;

// ============================================================================
// Lớp xử lý lỗi tập trung toàn hệ thống - Triển khai Interface chuẩn của .NET 8
// ============================================================================
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // 1. Ghi nhật ký lỗi chi tiết (Dành cho Dev kiểm tra log hệ thống)
        _logger.LogError(exception, "Một ngoại lệ hệ thống chưa được xử lý đã xảy ra tại tuyến đường: {Path}. Lý do: {Message}",
            httpContext.Request.Path, exception.Message);

        // 2. Phân loại mã trạng thái HTTP (Status Code) thông minh dựa trên kiểu lỗi ngoại lệ
        var (statusCode, title) = exception switch
        {
            // 🌟 ĐÃ BỔ SUNG: Bắt lỗi Validation đầu vào chặng nghiệp vụ WMS
            ValidationException => (StatusCodes.Status400BadRequest, "Dữ Liệu Đầu Vào Không Hợp Lệ"),

            // Lỗi từ phía kết nối mạng đến các Hub AI hoặc Python Microservice
            System.Net.Http.HttpRequestException => (StatusCodes.Status502BadGateway, "AI Gateway Service Error"),

            // Lỗi hết thời gian chờ phản hồi (Timeout) từ phía mô hình LLM lớn
            TimeoutException => (StatusCodes.Status504GatewayTimeout, "AI Service Response Timeout"),

            // Lỗi phân quyền truy cập hệ thống bốc dỡ hàng
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Access Denied"),

            // Tất cả các lỗi không xác định khác phát sinh tại Runtime
            _ => (StatusCodes.Status500InternalServerError, "Hệ Thống Gặp Sự Cố Nội Bộ")
        };

        // 3. Đóng gói lỗi theo tiêu chuẩn quốc tế RFC 7807 Problem Details
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception switch
            {
                // Nếu là lỗi Validation, ghi câu tóm tắt tổng quan
                ValidationException => "Một hoặc nhiều trường dữ liệu gửi lên không vượt qua được lưới lọc bảo vệ.",
                _ => exception.Message ?? "Không có mô tả chi tiết từ hệ thống."
            },
            Instance = httpContext.Request.Path
        };

        // 🌟 ĐÃ BỔ SUNG: Nếu là lỗi FluentValidation, bóc tách chi tiết từng trường bị lỗi dán vào Extensions
        if (exception is ValidationException validationException)
        {
            var errorsDictionary = validationException.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    failureGroup => failureGroup.Key,
                    failureGroup => failureGroup.Select(f => f.ErrorMessage).ToArray()
                );

            // Gán ma trận lỗi vào Key "errors" chuẩn để Frontend (React/Angular) tự động map thành thông báo đỏ dưới chân ô Input
            problemDetails.Extensions["errors"] = errorsDictionary;
        }

        // Trả dữ liệu lỗi sạch về cho Client
        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/json";

        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        // Trả về true để báo hiệu cho Kestrel Server biết lỗi này đã được xử lý xong
        return true;
    }
}