using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Products.Commands;

public class DeleteProductCommandHandler : IRequestHandler<DeleteProductCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public DeleteProductCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> Handle(DeleteProductCommand request, CancellationToken cancellationToken)
    {
        var product = await _context.Products.FindAsync(new object[] { request.Id }, cancellationToken);

        if (product == null)
            return Result<bool>.Failure("Sản phẩm không tồn tại hoặc đã bị xóa.");

        _context.Products.Remove(product);

        // Sẽ tự động lưu 1 dòng Type = "Delete" vào AuditLog
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Xóa sản phẩm khỏi danh mục thành công.");
    }
}