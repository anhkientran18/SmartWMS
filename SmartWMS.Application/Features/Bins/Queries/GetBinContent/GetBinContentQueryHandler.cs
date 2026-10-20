using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs;
using SmartWMS.Application.Features.Bins.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent;

public class GetBinContentQueryHandler : IRequestHandler<GetBinContentQuery, Result<BinContentHeaderDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetBinContentQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BinContentHeaderDto>> Handle(GetBinContentQuery request, CancellationToken cancellationToken)
    {
        var binRepo = _unitOfWork.Repository<Bin>();
        var invRepo = _unitOfWork.Repository<BinInventory>();

        var binSpec = new BinByIdSpec(request.RequestData.BinId);
        var bin = await binRepo.GetEntityWithSpecAsync(binSpec, cancellationToken);

        if (bin == null)
            return Result<BinContentHeaderDto>.Failure("BIN_NOT_FOUND", "Không tìm thấy ô kệ yêu cầu trên sơ đồ kho bãi.");

        var invSpec = new BinInventoriesByBinIdSpec(request.RequestData.BinId);
        var inventories = await invRepo.ListAsync(invSpec, cancellationToken);

        var headerDto = new BinContentHeaderDto
        {
            Purpose = bin.Purpose,
            BinId = bin.Id,
            BinCode = bin.Code ?? string.Empty,
            MaxCapacity = bin.MaxCapacity,
            CurrentOccupancy = bin.CurrentOccupancy,
            UtilizationPercentage = bin.MaxCapacity > 0 ? Math.Round((bin.CurrentOccupancy / bin.MaxCapacity) * 100, 2) : 0.0
        };

        foreach (var inv in inventories)
        {
            headerDto.Items.Add(new BinInventoryItemDto
            {
                ProductId = inv.ProductId,
                SKU = inv.Product != null ? (inv.Product.SKU ?? string.Empty) : "UNKNOWN",
                ProductName = inv.Product != null ? (inv.Product.Name ?? string.Empty) : "Sản phẩm đã bị xóa",
                LotNumber = inv.LotNumber ?? string.Empty,
                Quantity = inv.Quantity,
                ExpirationDate = inv.ExpirationDate.HasValue ? inv.ExpirationDate.Value.ToString("yyyy-MM-dd") : "Không có hạn dùng",
                Status = inv.Status.ToString()
            });
        }

        return Result<BinContentHeaderDto>.Success(headerDto);
    }
}