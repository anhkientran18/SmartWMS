using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetList;

public sealed class GetWarehouseListQueryValidator : AbstractValidator<GetWarehouseListQuery>
{
    public GetWarehouseListQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.SearchKeyword)
                .MaximumLength(200).WithMessage("Từ khóa tìm kiếm quá dài.");
        });
    }
}