using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetPaginatedSuppliers;

public record GetPaginatedSuppliersQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchTerm = null) : IRequest<Result<PaginatedResult<SupplierDto>>>;