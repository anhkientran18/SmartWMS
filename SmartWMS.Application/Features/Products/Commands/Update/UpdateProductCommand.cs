using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs.Commands;

namespace SmartWMS.Application.Features.Products.Commands.Update;

public record UpdateProductCommand(UpdateProductRequest RequestData) : IRequest<Result<bool>>;