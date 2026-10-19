using FluentValidation;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetInboundReceiptById;

public sealed class GetInboundReceiptByIdQueryValidator : AbstractValidator<GetInboundReceiptByIdQuery>
{
    public GetInboundReceiptByIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () => {
            RuleFor(x => x.RequestData.Id).NotEmpty().NotEqual(Guid.Empty);
        });
    }
}