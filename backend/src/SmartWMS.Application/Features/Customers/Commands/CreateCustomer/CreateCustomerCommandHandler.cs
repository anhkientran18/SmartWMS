using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Customers.Commands.CreateCustomer;

public sealed class CreateCustomerCommandHandler : IRequestHandler<CreateCustomerCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateCustomerCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateCustomerCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Customer>();
        var req = request.RequestData;

        var codeSpec = new CustomerByCodeForCreateSpec(req.Code);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, $"Mã khách hàng '{req.Code}' đã tồn tại trong hệ thống.");

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Code = req.Code,
            Name = req.Name,
            Email = req.Email ?? string.Empty,
            Phone = req.Phone ?? string.Empty,
            Address = req.DeliveryAddress ?? string.Empty,
            IsDeleted = false
        };

        await repo.AddAsync(customer, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(customer.Id, "Tạo mới thông tin khách hàng thành công.");
    }
}