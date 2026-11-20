using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs.Queries;
using System.Collections.Generic;
using SmartWMS.Application.Features.Products.DTOs;

namespace SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;

public record GetSemanticProductsQuery(SemanticSearchProductRequest RequestData) : IRequest<Result<List<ProductResultDto>>>;