using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.DeleteInboundReceipt;

public sealed class DeleteInboundReceiptCommandHandler : IRequestHandler<DeleteInboundReceiptCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteInboundReceiptCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<bool>> Handle(DeleteInboundReceiptCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InboundReceipt>();

        // Tận dụng lại Spec lấy Phiếu nhập + Items ở bước Receive trước đó
        var spec = new InboundReceiptWithItemsByIdSpec(request.RequestData.Id);
        var receipt = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (receipt == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy phiếu nhập kho yêu cầu.");

        // Ràng buộc nghiệp vụ WMS cực kỳ quan trọng:
        if (receipt.Status != "New")
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Chỉ có thể hủy phiếu nhập ở trạng thái Mới tạo (Chưa kiểm đếm hàng).");

        repo.Delete(receipt); // Xóa Header, EF Core sẽ tự động Cascade Delete các Items con (Nếu cấu hình DB chuẩn)
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã hủy thành công phiếu nhập {receipt.ReceiptNumber}.");
    }
}