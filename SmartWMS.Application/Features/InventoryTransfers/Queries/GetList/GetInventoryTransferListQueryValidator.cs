using FluentValidation;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetList;

public class GetInventoryTransferListQueryValidator : AbstractValidator<GetInventoryTransferListQuery>
{
    public GetInventoryTransferListQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");
    }
}