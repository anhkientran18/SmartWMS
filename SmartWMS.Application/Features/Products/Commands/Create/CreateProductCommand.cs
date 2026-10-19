using MediatR;
using System;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs.Commands;

namespace SmartWMS.Application.Features.Products.Commands.Create;

public record CreateProductCommand(CreateProductRequest RequestData) : IRequest<Result<Guid>>;