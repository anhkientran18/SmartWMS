using FluentValidation;
using SmartWMS.Application.Features.Customers.Queries.GetPaginatedCustomers;

public class GetPaginatedCustomersQueryValidator : AbstractValidator<GetPaginatedCustomersQuery>
{
    public GetPaginatedCustomersQueryValidator()
    {
        RuleFor(x => x.PageNumber).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}