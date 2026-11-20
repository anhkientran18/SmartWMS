using System;
using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs;

namespace SmartWMS.Application.Features.Customers.Queries.GetCustomerById;

public record GetCustomerByIdQuery(Guid Id) : IRequest<Result<CustomerDto>>;