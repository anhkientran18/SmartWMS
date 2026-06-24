using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SmartWMS.Application.Common.Interfaces;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Persistence.Interceptors;

public class AuditableEntityInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentUserService _currentUserService;

    public AuditableEntityInterceptor(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    // Đánh chặn luồng ghi dữ liệu đồng bộ
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        UpdateAuditProperties(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    // Đánh chặn luồng ghi dữ liệu bất đồng bộ (Luồng chính hệ thống đang dùng)
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        UpdateAuditProperties(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    // ĐÃ SỬA: Thay thế DbContext bằng tên định danh tường minh Microsoft.EntityFrameworkCore.DbContext để tránh trùng tên Namespace
    private void UpdateAuditProperties(Microsoft.EntityFrameworkCore.DbContext? context)
    {
        if (context == null) return;

        var entries = context.ChangeTracker.Entries();

        // Thu thập thông tin định danh của Token JWT hiện tại
        var userId = _currentUserService.UserId ?? "SystemAdmin";
        var utcNow = DateTime.UtcNow;

        foreach (var entry in entries)
        {
            // THAO TÁC THÊM MỚI (INSERT)
            if (entry.State == EntityState.Added)
            {
                SetPropertyValue(entry.Entity, "CreatedAt", utcNow);
                SetPropertyValue(entry.Entity, "CreatedBy", userId);
            }

            // THAO TÁC CẬP NHẬT (UPDATE)
            if (entry.State == EntityState.Added ||
                entry.State == EntityState.Modified ||
                entry.References.Any(r => r.TargetEntry != null && r.TargetEntry.State == EntityState.Modified))
            {
                SetPropertyValue(entry.Entity, "UpdatedAt", utcNow);
                SetPropertyValue(entry.Entity, "UpdatedBy", userId);
            }
        }
    }

    private void SetPropertyValue(object entity, string propertyName, object value)
    {
        var property = entity.GetType().GetProperty(propertyName);
        if (property != null && property.CanWrite)
        {
            property.SetValue(entity, value, null);
        }
    }
}