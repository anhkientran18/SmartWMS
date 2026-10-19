using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs.Commands;

namespace SmartWMS.Application.Features.Products.Commands.Delete;

public record DeleteProductCommand(DeleteProductRequest RequestData) : IRequest<Result<bool>>;