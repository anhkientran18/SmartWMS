using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;

public class GetPendingCountTasksQueryValidator : AbstractValidator<GetPendingCountTasksQuery>
{
    public GetPendingCountTasksQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // Optional legacy field; assignment filtering uses authenticated UserId, never this name.
        RuleFor(v => v.OperatorName)
            .MaximumLength(100)
            .WithMessage(_ => localizer["OperatorName_TooLong"]);
    }
}
