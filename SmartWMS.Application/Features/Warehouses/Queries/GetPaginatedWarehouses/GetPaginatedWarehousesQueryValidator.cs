using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;

public class GetPaginatedWarehousesQueryValidator : AbstractValidator<GetPaginatedWarehousesQuery>
{
    public GetPaginatedWarehousesQueryValidator()
    {
        RuleFor(x => x.PageNumber)
            .GreaterThanOrEqualTo(1).WithMessage("Số thứ tự trang tìm kiếm phải bắt đầu từ trang 1.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1).WithMessage("Số lượng bản ghi trên một trang tối thiểu là 1 dòng.")
            .LessThanOrEqualTo(50).WithMessage("Hệ thống giới hạn hiển thị tối đa 50 nhà kho trên một trang để bảo vệ RAM.");
    }
}