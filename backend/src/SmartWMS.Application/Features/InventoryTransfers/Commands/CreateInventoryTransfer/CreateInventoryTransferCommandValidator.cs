using FluentValidation;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Commands.CreateInventoryTransfer;

public class CreateInventoryTransferCommandValidator : AbstractValidator<CreateInventoryTransferCommand>
{
    public CreateInventoryTransferCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.ProductId).NotEmpty().NotEqual(Guid.Empty);
            RuleFor(x => x.RequestData.SourceBinId).NotEmpty().NotEqual(Guid.Empty);
            RuleFor(x => x.RequestData.DestinationBinId).NotEmpty().NotEqual(Guid.Empty)
                .NotEqual(x => x.RequestData.SourceBinId).WithMessage("Kệ đích không được trùng với kệ nguồn.");
            RuleFor(x => x.RequestData.TransferQuantity).GreaterThan(0).WithMessage("Số lượng luân chuyển phải lớn hơn 0.");
        });
    }
}