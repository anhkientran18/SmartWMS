using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs.Commands;

namespace SmartWMS.Application.Features.Customers.Commands.DeleteCustomer;

public record DeleteCustomerCommand(DeleteCustomerRequest RequestData) : IRequest<Result<bool>>;