using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Reports.Queries.ExportInventoryExcel;

public record ExportInventoryExcelQuery : IRequest<Result<byte[]>>;