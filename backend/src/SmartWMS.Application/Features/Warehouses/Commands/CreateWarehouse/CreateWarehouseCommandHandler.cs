using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Warehouses.Commands.CreateWarehouse;

public sealed class CreateWarehouseCommandHandler : IRequestHandler<CreateWarehouseCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateWarehouseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateWarehouseCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Warehouse>();
        var reqData = request.RequestData;

        var spec = new WarehouseByCodeForCreateSpec(reqData.Code);
        if (await repo.AnyAsync(spec, cancellationToken))
        {
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, $"Mã kho '{reqData.Code}' đã tồn tại trong hệ thống.");
        }

        var warehouse = new Warehouse
        {
            Id = Guid.NewGuid(),
            Code = reqData.Code,
            Name = reqData.Name,
            Address = reqData.Address,
            IsDeleted = false
        };

        await repo.AddAsync(warehouse, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(warehouse.Id, $"Khởi tạo thành công cơ sở kho {warehouse.Name}.");
    }
}