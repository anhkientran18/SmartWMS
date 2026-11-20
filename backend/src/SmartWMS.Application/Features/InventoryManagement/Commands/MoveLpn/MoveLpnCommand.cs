using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveLpn;

public record MoveLpnCommand(MoveLpnRequest RequestData) : IRequest<Result<bool>>;