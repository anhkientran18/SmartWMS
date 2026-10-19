using FluentValidation;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetById;

public class GetInventoryTransferByIdQueryValidator : AbstractValidator<GetInventoryTransferByIdQuery>
{
    public GetInventoryTransferByIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Mã giao dịch luân chuyển không được để trống.")
                .NotEqual(Guid.Empty).WithMessage("Mã giao dịch không hợp lệ.");
        });
    }
}