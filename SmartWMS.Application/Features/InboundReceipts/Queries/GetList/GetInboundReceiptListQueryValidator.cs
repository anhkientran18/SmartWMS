using FluentValidation;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetList;

public class GetInboundReceiptListQueryValidator : AbstractValidator<GetInboundReceiptListQuery>
{
    public GetInboundReceiptListQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu yêu cầu không được để trống.");
    }
}