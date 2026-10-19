using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using SmartWMS.Application.Common.Exceptions; // 🌟 BỔ SUNG: Namespace ValidationException của Application
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Api.Middlewares;

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
        // 1. Ghi nhật ký lỗi chi tiết
        _logger.LogError(exception, "Một ngoại lệ hệ thống chưa được xử lý đã xảy ra tại tuyến đường: {Path}. Lý do: {Message}",
            httpContext.Request.Path, exception.Message);

        // 2. Phân loại mã trạng thái HTTP (Status Code)
        var (statusCode, title) = exception switch
        {
            // Bắt Custom ValidationException từ Application
            SmartWMS.Application.Common.Exceptions.ValidationException => (StatusCodes.Status400BadRequest, "Dữ Liệu Đầu Vào Không Hợp Lệ"),

            // Bắt FluentValidation Exception (nếu có)
            FluentValidation.ValidationException => (StatusCodes.Status400BadRequest, "Dữ Liệu Đầu Vào Không Hợp Lệ"),

            // Lỗi từ phía kết nối mạng đến các Hub AI hoặc Python Microservice
            System.Net.Http.HttpRequestException => (StatusCodes.Status502BadGateway, "AI Gateway Service Error"),

            // Lỗi hết thời gian chờ phản hồi (Timeout) từ phía mô hình LLM
            TimeoutException => (StatusCodes.Status504GatewayTimeout, "AI Service Response Timeout"),

            // Lỗi phân quyền truy cập
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Access Denied"),

            // Tất cả các lỗi không xác định khác phát sinh tại Runtime
            _ => (StatusCodes.Status500InternalServerError, "Hệ Thống Gặp Sự Cố Nội Bộ")
        };

        // 3. Đóng gói lỗi theo tiêu chuẩn RFC 7807 Problem Details
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception switch
            {
                SmartWMS.Application.Common.Exceptions.ValidationException => "Một hoặc nhiều trường dữ liệu gửi lên không vượt qua được lưới lọc bảo vệ.",
                FluentValidation.ValidationException => "Một hoặc nhiều trường dữ liệu gửi lên không vượt qua được lưới lọc bảo vệ.",
                _ => "Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng liên hệ quản trị viên."
            },
            Instance = httpContext.Request.Path
        };

        // 4. Bóc tách ma trận lỗi chi tiết trả về cho Client
        if (exception is SmartWMS.Application.Common.Exceptions.ValidationException customValEx)
        {
            var errorsDictionary = customValEx.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    failureGroup => failureGroup.Key,
                    failureGroup => failureGroup.Select(f => f.ErrorMessage).ToArray()
                );

            problemDetails.Extensions["errors"] = errorsDictionary;
        }
        else if (exception is FluentValidation.ValidationException fluentValEx)
        {
            var errorsDictionary = fluentValEx.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    failureGroup => failureGroup.Key,
                    failureGroup => failureGroup.Select(f => f.ErrorMessage).ToArray()
                );

            problemDetails.Extensions["errors"] = errorsDictionary;
        }

        // Trả dữ liệu lỗi sạch về cho Client
        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/json";

        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }
}
