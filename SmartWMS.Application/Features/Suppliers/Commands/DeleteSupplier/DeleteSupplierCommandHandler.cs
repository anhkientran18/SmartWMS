using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Suppliers.Commands.DeleteSupplier;

public sealed class DeleteSupplierCommandHandler : IRequestHandler<DeleteSupplierCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteSupplierCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteSupplierCommand request, CancellationToken cancellationToken)
    {
        var supplierRepo = _unitOfWork.Repository<Supplier>();
        var inboundRepo = _unitOfWork.Repository<InboundReceipt>();
        var req = request.RequestData;

        // 1. Kiểm tra tồn tại
        var spec = new SupplierByIdForUpdateSpec(req.Id);
        var supplier = await supplierRepo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (supplier == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Nhà cung cấp không tồn tại hoặc đã bị xóa.");

        // 2. Kiểm tra ràng buộc dữ liệu: Đã phát sinh phiếu nhập kho chưa
        var inboundSpec = new SupplierInboundCheckForDeleteSpec(req.Id);
        if (await inboundRepo.AnyAsync(inboundSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể xóa nhà cung cấp '{supplier.Name}' vì đã phát sinh lịch sử giao dịch phiếu nhập kho.");

        // 3. Thực hiện Soft Delete
        supplier.IsDeleted = true;

        supplierRepo.Update(supplier);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã xóa nhà cung cấp '{supplier.Name}' thành công.");
    }
}