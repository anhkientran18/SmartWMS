using System;
using FluentValidation;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetSupplierById;

public class GetSupplierByIdQueryValidator : AbstractValidator<GetSupplierByIdQuery>
{
    public GetSupplierByIdQueryValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("ID nhà cung cấp không được để trống.")
            .NotEqual(Guid.Empty).WithMessage("ID nhà cung cấp không hợp lệ.");
    }
}