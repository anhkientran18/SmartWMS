using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs.Commands;

namespace SmartWMS.Application.Features.Customers.Commands.UpdateCustomer;

public record UpdateCustomerCommand(UpdateCustomerRequest RequestData) : IRequest<Result<bool>>;