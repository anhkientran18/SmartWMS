using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetLowStockAlerts;

public record GetLowStockAlertsQuery : IRequest<Result<List<LowStockAlertDto>>>;
