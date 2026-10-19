using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Suppliers.Commands.CreateSupplier;

public sealed class CreateSupplierCommandHandler : IRequestHandler<CreateSupplierCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateSupplierCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateSupplierCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Supplier>();
        var req = request.RequestData;

        var codeSpec = new SupplierByCodeForCreateSpec(req.Code);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<Guid>.Failure(ErrorCodeConstants.Conflict, $"Mã nhà cung cấp '{req.Code}' đã tồn tại trong hệ thống.");

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Code = req.Code ?? string.Empty,
            Name = req.Name ?? string.Empty,
            Email = req.Email ?? string.Empty,
            Phone = req.Phone ?? string.Empty,
            Address = req.Address ?? string.Empty
        };

        await repo.AddAsync(supplier, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(supplier.Id, "Thêm mới nhà cung cấp thành công.");
    }
}
