using FluentValidation;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetPaginatedOutboundOrders;

public class GetPaginatedOutboundOrdersQueryValidator : AbstractValidator<GetPaginatedOutboundOrdersQuery>
{
    public GetPaginatedOutboundOrdersQueryValidator()
    {
        RuleFor(x => x.RequestData.PageIndex)
            .GreaterThanOrEqualTo(1).WithMessage("Số trang phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.RequestData.PageSize)
            .GreaterThanOrEqualTo(1).WithMessage("Kích thước trang phải lớn hơn hoặc bằng 1.")
            .LessThanOrEqualTo(100).WithMessage("Kích thước trang không được vượt quá 100.");
    }
}