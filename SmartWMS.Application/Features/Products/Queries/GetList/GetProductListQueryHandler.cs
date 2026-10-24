using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using SmartWMS.Application.Features.Products.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.GetList;

public sealed class GetProductListQueryHandler : IRequestHandler<GetProductListQuery, Result<List<ProductDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetProductListQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<List<ProductDto>>> Handle(GetProductListQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Product>();

        var spec = new ProductListSpec(request.RequestData.SearchKeyword);
        var data = await repo.ListAsync(spec, cancellationToken);

        var result = data.Select(p => new ProductDto
        {
            TrackingMode = p.TrackingMode,
            Id = p.Id,
            SKU = p.SKU,
            Barcode = p.Barcode,
            Weight = p.Weight,
            Name = p.Name,
            Description = p.Description ?? string.Empty,
            Unit = p.Unit ?? string.Empty
        }).ToList();

        return Result<List<ProductDto>>.Success(result);
    }
}
