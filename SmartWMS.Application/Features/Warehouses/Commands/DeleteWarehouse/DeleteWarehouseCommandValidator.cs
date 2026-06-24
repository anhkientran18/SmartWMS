using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Commands.DeleteWarehouse;

public class DeleteWarehouseCommandValidator : AbstractValidator<DeleteWarehouseCommand>
{
    public DeleteWarehouseCommandValidator()
    {
        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Vui lòng cung cấp chính xác mã định danh (Id) nhà kho cần thực hiện xóa.");
    }
}