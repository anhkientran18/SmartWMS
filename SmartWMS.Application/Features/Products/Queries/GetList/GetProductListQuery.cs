using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using SmartWMS.Application.Features.Products.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Products.Queries.GetList;

public record GetProductListQuery(ProductListQueryRequest RequestData) : IRequest<Result<List<ProductDto>>>;