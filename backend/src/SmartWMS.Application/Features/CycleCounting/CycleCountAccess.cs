using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.CycleCounting;

internal static class CycleCountAccess
{
    public static bool CanAccess(ICurrentUserService user, CycleCountSheet sheet) =>
        user.Role is "Admin" or "WarehouseManager" ||
        user.Role == "Staff" && Guid.TryParse(user.UserId, out var id) &&
        id != Guid.Empty && sheet.AssignedUserId == id;
}
