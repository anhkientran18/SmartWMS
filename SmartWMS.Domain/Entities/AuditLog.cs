using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class AuditLog : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // C - Create, U - Update, D - Delete
    public string TableName { get; set; } = string.Empty;
    public DateTime DateTime { get; set; }
    public string? OldValues { get; set; } // Dạng JSON chứa dữ liệu trước khi sửa
    public string? NewValues { get; set; } // Dạng JSON chứa dữ liệu sau khi sửa
    public string AffectedColumns { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
}