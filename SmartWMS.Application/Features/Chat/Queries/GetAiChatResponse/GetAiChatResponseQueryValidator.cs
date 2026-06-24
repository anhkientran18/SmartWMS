using FluentValidation;

namespace SmartWMS.Application.Features.Chat.Queries.GetAiChatResponse;

public class GetAiChatResponseQueryValidator : AbstractValidator<GetAiChatResponseQuery>
{
    public GetAiChatResponseQueryValidator()
    {
        RuleFor(x => x.Message)
            .NotEmpty().WithMessage("Nội dung tin nhắn gửi tới AI không được để trống.")
            .MaximumLength(1000).WithMessage("Câu hỏi gửi tới AI không được vượt quá 1000 ký tự để tối ưu hóa xử lý.");
    }
}