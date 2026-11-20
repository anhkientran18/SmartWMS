using FluentValidation;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetPaginatedInventoryTransfers;

public class GetPaginatedInventoryTransfersQueryValidator : AbstractValidator<GetPaginatedInventoryTransfersQuery>
{
    public GetPaginatedInventoryTransfersQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.PageIndex).GreaterThanOrEqualTo(1).WithMessage("Số trang phải lớn hơn hoặc bằng 1.");
            RuleFor(x => x.RequestData.PageSize).InclusiveBetween(1, 100).WithMessage("Kích thước trang phải từ 1 đến 100.");
        });
    }
}