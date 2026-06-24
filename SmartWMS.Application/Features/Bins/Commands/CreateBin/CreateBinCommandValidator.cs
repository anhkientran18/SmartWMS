using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Application.Features.Bins.Commands.CreateBin;

public class CreateBinCommandValidator : AbstractValidator<CreateBinCommand>
{
    private readonly IApplicationDbContext _context;

    public CreateBinCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        // 1. Kiểm tra mã ô kệ
        RuleFor(v => v.Code)
            .NotEmpty().WithMessage("Mã ô kệ không được để trống.")
            .MaximumLength(50).WithMessage("Mã ô kệ không được quá 50 ký tự.")
            .MustAsync(BeUniqueCode).WithMessage("Mã ô kệ này đã tồn tại trong khu vực này.");

        // 2. Kiểm tra Khu vực kho
        RuleFor(v => v.ZoneId)
            .NotEmpty().WithMessage("Vui lòng chọn khu vực (Zone) cho ô kệ này.");

        // 3. Kiểm tra các kích thước vật lý đầu vào (đảm bảo dữ liệu sạch trước khi đưa vào AI Agent xử lý)
        RuleFor(v => v.Width)
            .GreaterThan(0).WithMessage("Chiều rộng kệ phải lớn hơn 0 cm.");

        RuleFor(v => v.Height)
            .GreaterThan(0).WithMessage("Chiều cao kệ phải lớn hơn 0 cm.");

        RuleFor(v => v.Depth)
            .GreaterThan(0).WithMessage("Chiều sâu kệ phải lớn hơn 0 cm.");
    }

    private async Task<bool> BeUniqueCode(CreateBinCommand command, string code, CancellationToken cancellationToken)
    {
        // Kiểm tra xem trong cùng một ZoneId, mã ô kệ đã tồn tại hay chưa (không phân biệt chữ hoa, chữ thường)
        return await _context.Bins
            .AllAsync(b => b.ZoneId != command.ZoneId || b.Code.ToLower() != code.ToLower(), cancellationToken);
    }
}