using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs.Commands;

namespace SmartWMS.Application.Features.Suppliers.Commands.UpdateSupplier;

public record UpdateSupplierCommand(UpdateSupplierRequest RequestData) : IRequest<Result<bool>>;