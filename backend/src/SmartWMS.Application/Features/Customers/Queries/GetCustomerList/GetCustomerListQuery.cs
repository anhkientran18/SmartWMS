using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Customers.Queries.GetCustomerList; // <-- Sửa thành GetCustomerList

public record GetCustomerListQuery() : IRequest<Result<List<CustomerDto>>>;