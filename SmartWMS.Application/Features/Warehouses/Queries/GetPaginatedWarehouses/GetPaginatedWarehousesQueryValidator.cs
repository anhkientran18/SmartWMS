using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;

public sealed class GetPaginatedWarehousesQueryValidator : AbstractValidator<GetPaginatedWarehousesQuery>
{
    public GetPaginatedWarehousesQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.PageIndex)
                .GreaterThan(0).WithMessage("Số trang (PageIndex) phải lớn hơn 0.");

            RuleFor(x => x.RequestData.PageSize)
                .GreaterThan(0).WithMessage("Số lượng mục trên mỗi trang (PageSize) phải lớn hơn 0.")
                .LessThanOrEqualTo(100).WithMessage("Số lượng mục trên mỗi trang không được vượt quá 100 để đảm bảo hiệu suất.");

            RuleFor(x => x.RequestData.SearchKeyword)
                .MaximumLength(200).WithMessage("Từ khóa tìm kiếm quá dài.");
        });
    }
}