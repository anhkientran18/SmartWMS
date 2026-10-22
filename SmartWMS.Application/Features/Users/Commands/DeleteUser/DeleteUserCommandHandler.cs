using MediatR;
using SmartWMS.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Models;
using System.Data.Common;

namespace SmartWMS.Application.Features.Users.Commands;

public class DeleteUserCommandHandler : IRequestHandler<DeleteUserCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly IInventoryMutationCoordinator _mutations;

    public DeleteUserCommandHandler(IApplicationDbContext context, IInventoryMutationCoordinator mutations)
    {
        _context = context;
        _mutations = mutations;
    }

    public async Task<Result<bool>> Handle(DeleteUserCommand request, CancellationToken cancellationToken)
    {
        await using var tx = await _mutations.BeginAsync(cancellationToken);
        var user = await _context.Users.SingleOrDefaultAsync(x => x.Id == request.Id, cancellationToken);

        if (user == null)
            return Result<bool>.Failure("Tài khoản không tồn tại.");

        // Ràng buộc bảo mật: Không bao giờ được phép xóa tài khoản Admin gốc của hệ thống
        if (user.Username.ToLower() == "admin")
            return Result<bool>.Failure("Không thể xóa tài khoản Quản trị tối cao.");

        // Historical assignments must survive physical user deletion, including completed/deleted sheets.
        if (await _context.CycleCountSheets.AnyAsync(x => x.AssignedUserId == user.Id, cancellationToken) ||
            await _context.PickTasks.AnyAsync(x => x.AssignedUserId == user.Id, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                "Tài khoản đang được lịch sử kiểm kê/công việc tham chiếu; hãy vô hiệu hóa tài khoản thay vì xóa.");

        _context.Users.Remove(user);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsDeleteReferenceConflict(ex, user))
        {
            await tx.RollbackAsync();
            return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                "Tài khoản vừa phát sinh tham chiếu đồng thời; không thể xóa. Hãy tải lại.");
        }
        await tx.CommitAsync(cancellationToken);

        return Result<bool>.Success(true, "Xóa tài khoản thành công.");
    }

    private static bool IsDeleteReferenceConflict(DbUpdateException exception, SmartWMS.Domain.Entities.User user)
    {
        if (!exception.Entries.Any(x => ReferenceEquals(x.Entity, user) && x.State == EntityState.Deleted))
            return false;
        for (Exception? inner = exception.InnerException; inner != null; inner = inner.InnerException)
        {
            // Keep the SQL provider dependency in Infrastructure; inspect its specific error number only.
            if (inner is DbException sql && sql.GetType().FullName == "Microsoft.Data.SqlClient.SqlException" &&
                sql.GetType().GetProperty("Number")?.GetValue(sql) is 547)
                return true;
        }
        return false;
    }
}
