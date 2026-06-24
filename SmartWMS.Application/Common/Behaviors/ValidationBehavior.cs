using FluentValidation;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ValidationException = SmartWMS.Application.Common.Exceptions.ValidationException;

namespace SmartWMS.Application.Common.Behaviors;

/// Bộ lọc đường ống trung gian (MediatR Pipeline Behavior) tự động chặn và thực thi các luật FluentValidation 
/// trước khi dữ liệu đi vào tầng xử lý nghiệp vụ chính (Handlers).
public class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
     where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra xem Request này có cấu hình các điều luật Validator tương ứng hay không
        if (_validators.Any())
        {
            var context = new ValidationContext<TRequest>(request);

            // 2. Kích hoạt quét bất đồng bộ song song toàn bộ các điều luật đã thiết lập
            var validationResults = await Task.WhenAll(
                _validators.Select(v => v.ValidateAsync(context, cancellationToken)));

            // 3. Trích xuất gom tụ tất cả các lỗi phát hiện được trong chuỗi Request
            var failures = validationResults
                .Where(r => r.Errors.Any())
                .SelectMany(r => r.Errors)
                .ToList();

            // 4. Nếu phát hiện sai phạm cấu trúc, lập tức ném lỗi Custom Exception để ngắt dòng chảy dữ liệu
            if (failures.Any())
            {
                // Toàn bộ mảng lỗi chi tiết (trường nào bị lỗi, lý do gì) sẽ được đẩy ra ngoài cho Exception Middleware thu giữ
                throw new ValidationException(failures);
            }
        }

        // 5. Dữ liệu sạch sẽ, cho phép đi tiếp vào Handler xử lý nghiệp vụ lõi
        return await next();
    }
}