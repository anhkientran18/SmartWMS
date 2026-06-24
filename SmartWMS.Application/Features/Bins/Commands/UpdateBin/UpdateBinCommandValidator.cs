using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Application.Features.Bins.Commands.UpdateBin;

public class UpdateBinCommandValidator : AbstractValidator<UpdateBinCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdateBinCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        // 1. Kiểm tra mã định danh ô kệ
        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Mã định danh (Id) ô kệ không được trống.");

        // 2. Kiểm tra mã ô kệ
        RuleFor(v => v.Code)
            .NotEmpty().WithMessage("Mã ô kệ không được để trống.")
            .MaximumLength(50).WithMessage("Mã ô kệ không được quá 50 ký tự.")
            .MustAsync(BeUniqueCode).WithMessage("Mã ô kệ này đã tồn tại trong khu vực này.");

        // 3. Kiểm tra sức chứa tối đa
        RuleFor(v => v.MaxCapacity)
            .GreaterThan(0).WithMessage("Sức chứa tối đa của ô kệ phải lớn hơn 0.");
    }

    private async Task<bool> BeUniqueCode(UpdateBinCommand command, string code, CancellationToken cancellationToken)
    {
        // Tìm ô kệ hiện tại đang chỉnh sửa để xác định ZoneId của nó
        var currentBin = await _context.Bins
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == command.Id, cancellationToken);

        // Nếu không tìm thấy ô kệ, trả về true để lỗi không tìm thấy được xử lý ở Handler
        if (currentBin == null)
            return true;

        // Kiểm tra xem trong cùng một khu vực (ZoneId), có ô kệ KHÁC nào bị trùng mã hay không (không phân biệt chữ hoa/thường)
        return await _context.Bins
            .AllAsync(b => b.Id == command.Id || b.ZoneId != currentBin.ZoneId || b.Code.ToLower() != code.ToLower(), cancellationToken);
    }
}