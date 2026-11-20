using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetSupplierList;

public record GetSupplierListQuery() : IRequest<Result<List<SupplierDto>>>;