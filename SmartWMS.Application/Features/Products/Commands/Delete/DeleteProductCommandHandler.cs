using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Commands.Delete;

public class DeleteProductCommandHandler : IRequestHandler<DeleteProductCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteProductCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteProductCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Product>();

        var spec = new ProductByIdForDeleteSpec(request.RequestData.Id);
        var product = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (product == null)
            return Result<bool>.Failure(ErrorCodeConstants.ProductNotFound, "Sản phẩm không tồn tại hoặc đã bị xóa.");

        repo.Delete(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Xóa sản phẩm khỏi danh mục thành công.");
    }
}