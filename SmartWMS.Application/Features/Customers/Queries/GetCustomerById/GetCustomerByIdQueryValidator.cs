using System;
using FluentValidation;

namespace SmartWMS.Application.Features.Customers.Queries.GetCustomerById;

public class GetCustomerByIdQueryValidator : AbstractValidator<GetCustomerByIdQuery>
{
    public GetCustomerByIdQueryValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("ID khách hàng không được để trống.")
            .NotEqual(Guid.Empty).WithMessage("ID khách hàng không hợp lệ.");
    }
}