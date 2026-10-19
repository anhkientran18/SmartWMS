using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs;
using SmartWMS.Application.Features.Warehouses.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;

public sealed class GetPaginatedWarehousesQueryHandler : IRequestHandler<GetPaginatedWarehousesQuery, Result<PaginatedResult<WarehouseDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetPaginatedWarehousesQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<PaginatedResult<WarehouseDto>>> Handle(GetPaginatedWarehousesQuery request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var repo = _unitOfWork.Repository<Warehouse>();

        var listSpec = new WarehousePaginatedListSpec(req.SearchKeyword, req.PageIndex, req.PageSize);
        var countSpec = new WarehouseCountSpec(req.SearchKeyword);

        var items = await repo.ListAsync(listSpec, cancellationToken);
        var total = await repo.CountAsync(countSpec, cancellationToken);

        var dtoItems = items.Select(w => new WarehouseDto { Id = w.Id, Code = w.Code, Name = w.Name, Address = w.Address }).ToList();
        var result = PaginatedResult<WarehouseDto>.Create(dtoItems, total, req.PageIndex, req.PageSize);

        return Result<PaginatedResult<WarehouseDto>>.Success(result);
    }
}