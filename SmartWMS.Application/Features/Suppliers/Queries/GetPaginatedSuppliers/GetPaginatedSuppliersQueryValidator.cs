using FluentValidation;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetPaginatedSuppliers;

public class GetPaginatedSuppliersQueryValidator : AbstractValidator<GetPaginatedSuppliersQuery>
{
    public GetPaginatedSuppliersQueryValidator()
    {
        RuleFor(x => x.PageNumber)
            .GreaterThanOrEqualTo(1).WithMessage("PageNumber ít nhất phải bằng 1.");

        RuleFor(x => x.PageSize)
            .GreaterThan(0).WithMessage("PageSize phải lớn hơn 0.")
            .LessThanOrEqualTo(100).WithMessage("Không được lấy quá 100 bản ghi mỗi trang để đảm bảo hiệu suất.");

        // SearchTerm có thể null, nhưng nếu có thì không được quá dài tránh tấn công tràn bộ nhớ
        RuleFor(x => x.SearchTerm)
            .MaximumLength(100).WithMessage("Từ khóa tìm kiếm không được vượt quá 100 ký tự.");
    }
}