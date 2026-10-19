using FluentValidation;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion;

public class GetPutawaySuggestionQueryValidator : AbstractValidator<GetPutawaySuggestionQuery>
{
    public GetPutawaySuggestionQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () => {
            RuleFor(v => v.RequestData.SKU).NotEmpty().MaximumLength(50);
            RuleFor(v => v.RequestData.Quantity).GreaterThan(0);
        });
    }
}