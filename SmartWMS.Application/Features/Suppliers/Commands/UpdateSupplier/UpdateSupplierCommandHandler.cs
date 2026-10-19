using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Suppliers.Commands.UpdateSupplier;

public sealed class UpdateSupplierCommandHandler : IRequestHandler<UpdateSupplierCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateSupplierCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateSupplierCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Supplier>();
        var req = request.RequestData;

        // 1. Kiểm tra tồn tại
        var spec = new SupplierByIdForUpdateSpec(req.Id);
        var supplier = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (supplier == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy nhà cung cấp cần chỉnh sửa.");

        // 2. Kiểm tra trùng mã nhà cung cấp
        var codeSpec = new SupplierByCodeForUpdateSpec(req.Id, req.Code);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Mã nhà cung cấp '{req.Code}' đã tồn tại trong hệ thống.");

        // 3. Cập nhật thông tin
        supplier.Code = req.Code ?? string.Empty;
        supplier.Name = req.Name ?? string.Empty;
        supplier.Email = req.Email ?? string.Empty;
        supplier.Phone = req.Phone ?? string.Empty;
        supplier.Address = req.Address ?? string.Empty;

        repo.Update(supplier);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thông tin nhà cung cấp thành công.");
    }
}