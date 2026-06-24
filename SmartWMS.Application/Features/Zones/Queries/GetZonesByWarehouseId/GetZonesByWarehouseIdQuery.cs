using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Dtos;

namespace SmartWMS.Application.Features.Zones.Queries;

// API này rất cần thiết khi Frontend muốn chọn Kho Tổng A -> Sẽ đổ ra danh sách các Khu Vực thuộc Kho A
public record GetZonesByWarehouseIdQuery(Guid WarehouseId) : IRequest<Result<List<ZoneDto>>>;