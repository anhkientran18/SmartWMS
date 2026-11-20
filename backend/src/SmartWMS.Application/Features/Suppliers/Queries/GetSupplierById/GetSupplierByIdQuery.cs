using System;
using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetSupplierById;

public record GetSupplierByIdQuery(Guid Id) : IRequest<Result<SupplierDto>>;