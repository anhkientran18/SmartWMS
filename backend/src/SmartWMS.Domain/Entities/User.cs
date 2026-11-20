using System.ComponentModel.DataAnnotations.Schema; // 🌟 Bắt buộc phải thêm dòng này
using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class User : BaseEntity
{
    [Column(Order = 1)] // Thứ tự số 1
    public string Username { get; set; } = string.Empty;

    [Column(Order = 2)] // Thứ tự số 2
    public string PasswordHash { get; set; } = string.Empty;

    [Column(Order = 3)] // Đưa LastName về số 3
    public string LastName { get; set; } = string.Empty;

    [Column(Order = 4)] // Đưa FirstName về số 4 đứng ngay cạnh LastName
    public string FirstName { get; set; } = string.Empty;

    // Thuộc tính này dạng Lambda ghép chuỗi, không sinh cột trong DB nên không cần gán Order
    public string FullName => $"{LastName} {FirstName}".Trim();

    [Column(Order = 5)]
    public string Email { get; set; } = string.Empty;

    [Column(Order = 6)]
    public string Role { get; set; } = "Staff";

    [Column(Order = 7)]
    public bool IsActive { get; set; } = true;
}