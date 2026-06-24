using FluentValidation;

namespace SmartWMS.Application.Features.Users.Queries.GetPaginatedUsers;

public class GetPaginatedUsersQueryValidator : AbstractValidator<GetPaginatedUsersQuery>
{
    public GetPaginatedUsersQueryValidator()
    {
        RuleFor(x => x.PageNumber)
            .GreaterThanOrEqualTo(1).WithMessage("Số thứ tự trang phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1).WithMessage("Kích thước trang phải lớn hơn hoặc bằng 1.")
            .LessThanOrEqualTo(50).WithMessage("Kích thước trang tối đa cho phép là 50 tài khoản.");
    }
}