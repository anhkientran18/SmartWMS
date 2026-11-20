using FluentValidation;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetList;

public class GetOutboundOrderListQueryValidator : AbstractValidator<GetOutboundOrderListQuery>
{
    public GetOutboundOrderListQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");
    }
}