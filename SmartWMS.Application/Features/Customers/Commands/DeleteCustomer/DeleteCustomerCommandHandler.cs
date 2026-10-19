using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Customers.Commands.DeleteCustomer;

public sealed class DeleteCustomerCommandHandler : IRequestHandler<DeleteCustomerCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteCustomerCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteCustomerCommand request, CancellationToken cancellationToken)
    {
        var customerRepo = _unitOfWork.Repository<Customer>();
        var outboundRepo = _unitOfWork.Repository<OutboundIssue>();
        var req = request.RequestData;

        var spec = new CustomerByIdForUpdateSpec(req.Id);
        var customer = await customerRepo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (customer == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Khách hàng không tồn tại hoặc đã bị xóa.");

        var outboundSpec = new CustomerOutboundCheckForDeleteSpec(req.Id);
        if (await outboundRepo.AnyAsync(outboundSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể xóa khách hàng '{customer.Name}' vì đã phát sinh lịch sử đơn xuất kho.");

        customer.IsDeleted = true;

        customerRepo.Update(customer);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã xóa khách hàng '{customer.Name}' thành công.");
    }
}