using SmartWMS.Application.Features.Users.DTOs;

public class UserPaginationDto
{
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
    public List<UserDto> Items { get; set; } = new();
}