using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.Customers.Commands.CreateCustomer;

public record CreateCustomerCommand(CreateCustomerRequest RequestData) : IRequest<Result<Guid>>;