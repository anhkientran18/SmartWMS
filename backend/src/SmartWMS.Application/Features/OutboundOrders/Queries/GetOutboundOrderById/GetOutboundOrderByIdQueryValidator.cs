using FluentValidation;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetOutboundOrderById;

public sealed class GetOutboundOrderByIdQueryValidator : AbstractValidator<GetOutboundOrderByIdQuery>
{
    public GetOutboundOrderByIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () => {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("ID phiếu xuất không được để trống.")
                .NotEqual(Guid.Empty).WithMessage("ID phiếu xuất không hợp lệ.");
        });
    }
}