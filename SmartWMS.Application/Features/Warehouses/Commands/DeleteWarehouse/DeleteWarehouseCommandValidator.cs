using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Commands.DeleteWarehouse;

public class DeleteWarehouseCommandValidator : AbstractValidator<DeleteWarehouseCommand>
{
    public DeleteWarehouseCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id).NotEmpty().WithMessage("Vui lòng cung cấp Id kho cần xóa.");
        });
    }
}