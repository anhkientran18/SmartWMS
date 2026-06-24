using FluentValidation;

namespace SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;

public class GetPaginatedZonesQueryValidator : AbstractValidator<GetPaginatedZonesQuery>
{
    public GetPaginatedZonesQueryValidator()
    {
        RuleFor(x => x.PageNumber)
            .GreaterThanOrEqualTo(1).WithMessage("Số trang hiển thị phải bắt đầu từ trang 1.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1).WithMessage("Kích thước trang hiển thị tối thiểu là 1 dòng.")
            .LessThanOrEqualTo(50).WithMessage("Hệ thống giới hạn hiển thị tối đa 50 khu vực trên một trang để bảo vệ hiệu năng.");
    }
}