using System.Text.Json;
using SmartWMS.Application.Common.Exceptions; // Chứa ValidationException

namespace SmartWMS.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext httpContext)
    {
        try
        {
            await _next(httpContext); // Cho phép request đi qua
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Đã xảy ra lỗi hệ thống: {Message}", ex.Message);
            await HandleExceptionAsync(httpContext, ex); // Bắt mọi lỗi xảy ra
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var response = new
        {
            StatusCode = exception switch
            {
                ValidationException => StatusCodes.Status400BadRequest,
                _ => StatusCodes.Status500InternalServerError
            },
            Message = exception switch
            {
                ValidationException => "Validation Failed",
                _ => "Internal Server Error"
            },
            Errors = exception is ValidationException validationException ? validationException.Errors : null
        };

        context.Response.StatusCode = response.StatusCode;
        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}