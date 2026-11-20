using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetInventorySummary;

// Query này không cần Request DTO vì nó không nhận tham số đầu vào
public record GetInventorySummaryQuery : IRequest<Result<InventorySummaryDto>>;