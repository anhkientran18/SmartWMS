using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.Suppliers.Commands.CreateSupplier;

public record CreateSupplierCommand(CreateSupplierRequest RequestData) : IRequest<Result<Guid>>;