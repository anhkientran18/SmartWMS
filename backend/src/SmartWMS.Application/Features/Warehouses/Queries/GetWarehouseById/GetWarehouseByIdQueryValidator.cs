using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetWarehouseById;

public sealed class GetWarehouseByIdQueryValidator : AbstractValidator<GetWarehouseByIdQuery>
{
    public GetWarehouseByIdQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu truy vấn không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("ID kho không được để trống.")
                .NotEqual(Guid.Empty).WithMessage("ID kho không hợp lệ.");
        });
    }
}