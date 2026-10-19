using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;

public record ValidatePackingWeightCommand(ValidatePackingWeightRequest RequestData) : IRequest<Result<WeightValidationResultDto>>;