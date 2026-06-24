namespace SmartWMS.Application.Common.Interfaces;

public interface ICurrentUserService
{
    string? UserId { get; }
    string? Role { get; }
    string? IpAddress { get; } // Thêm thuộc tính này
}