using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Products.Commands;

public record DeleteProductCommand(Guid Id) : IRequest<Result<bool>>;