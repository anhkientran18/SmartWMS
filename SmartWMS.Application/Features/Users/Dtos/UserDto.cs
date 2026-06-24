namespace SmartWMS.Application.Features.Users.Dtos;

public class UserDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string Email { get; internal set; } = string.Empty;
}

// BỔ SUNG THÊM CLASS NÀY ĐỂ TRẢ VỀ CHO FRONTEND
public class UserPaginationDto
{
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
    public List<UserDto> Items { get; set; } = new();
}