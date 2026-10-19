using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Customers.Commands.UpdateCustomer;

public sealed class UpdateCustomerCommandHandler : IRequestHandler<UpdateCustomerCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCustomerCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateCustomerCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Customer>();
        var req = request.RequestData;

        var spec = new CustomerByIdForUpdateSpec(req.Id);
        var customer = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (customer == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy thông tin khách hàng cần cập nhật.");

        var codeSpec = new CustomerByCodeForUpdateSpec(req.Id, req.Code);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Mã khách hàng '{req.Code}' đã được sử dụng.");

        customer.Code = req.Code;
        customer.Name = req.Name;
        customer.Email = req.Email ?? string.Empty;
        customer.Phone = req.Phone ?? string.Empty;
        customer.Address = req.DeliveryAddress ?? string.Empty;

        repo.Update(customer);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thông tin khách hàng thành công.");
    }
}