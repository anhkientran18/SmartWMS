using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Commands.Update;

public class UpdateProductCommandHandler : IRequestHandler<UpdateProductCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateProductCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Product>();
        var reqData = request.RequestData;

        // 1. Kiểm tra SKU trùng lặp (trừ chính nó)
        var skuSpec = new ProductBySkuForUpdateSpec(reqData.Id, reqData.SKU);
        if (await repo.AnyAsync(skuSpec, cancellationToken))
        {
            return Result<bool>.Failure(ErrorCodeConstants.SkuAlreadyExists, "Mã SKU này đã được sử dụng bởi một sản phẩm khác.");
        }

        // 2. Lấy sản phẩm cần update
        var updateSpec = new ProductByIdForUpdateSpec(reqData.Id);
        var product = await repo.GetEntityWithSpecAsync(updateSpec, cancellationToken);

        if (product == null)
            return Result<bool>.Failure(ErrorCodeConstants.ProductNotFound, "Không tìm thấy sản phẩm.");

        // 3. Cập nhật thông tin
        product.SKU = reqData.SKU;
        product.Barcode = reqData.Barcode;
        product.Name = reqData.Name;
        product.Description = reqData.Description;
        product.Unit = reqData.Unit;

        repo.Update(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật sản phẩm thành công.");
    }
}