using Serilog.Context;

namespace SmartWMS.Api.Middleware;

public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    private const string HeaderName = "X-Correlation-Id";

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task Invoke(HttpContext context)
    {
        // 1. Lấy CorrelationId từ Header (nếu Client truyền lên), hoặc tự tạo mã GUID mới
        var correlationId = context.Request.Headers.TryGetValue(HeaderName, out var value)
            ? value.ToString()
            : Guid.NewGuid().ToString();

        // 2. Gắn ngược mã này vào Header trả về cho Client
        context.Response.Headers[HeaderName] = correlationId;

        // 3. Đẩy mã này vào bối cảnh ghi Log của Serilog
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}