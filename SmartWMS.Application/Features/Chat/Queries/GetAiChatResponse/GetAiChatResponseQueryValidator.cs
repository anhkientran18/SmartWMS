using FluentValidation;

namespace SmartWMS.Application.Features.Chat.Queries.GetAiChatResponse;

public class GetAiChatResponseQueryValidator : AbstractValidator<GetAiChatResponseQuery>
{
    public GetAiChatResponseQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Message)
                .NotEmpty().WithMessage("Nội dung tin nhắn không được để trống.")
                .MaximumLength(2000).WithMessage("Tin nhắn không được vượt quá 2000 ký tự.");
        });
    }
}