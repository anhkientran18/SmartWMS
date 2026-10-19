using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs;

namespace SmartWMS.Application.Features.Customers.Queries.GetPaginatedCustomers;

// Cập nhật PaginatedListDto thành PaginatedResult
public record GetPaginatedCustomersQuery(int PageNumber = 1, int PageSize = 10, string? SearchTerm = null)
    : IRequest<Result<PaginatedResult<CustomerDto>>>;