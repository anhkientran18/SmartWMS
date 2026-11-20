using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs.Commands;

namespace SmartWMS.Application.Features.Suppliers.Commands.DeleteSupplier;

public record DeleteSupplierCommand(DeleteSupplierRequest RequestData) : IRequest<Result<bool>>;