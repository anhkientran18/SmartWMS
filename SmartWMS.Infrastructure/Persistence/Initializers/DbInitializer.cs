using System;
using System.Linq;
using System.Threading.Tasks;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Utils;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Initializers
{
    public static class DbInitializer
    {
        public static async Task SeedAsync(IApplicationDbContext context)
        {
            // Kiểm tra nếu chưa có user nào thì mới tạo tài khoản Admin mẫu
            if (!context.Users.Any())
            {
                var adminUser = new User
                {
                    Username = "admin",
                    PasswordHash = SecurityUtils.HashPassword("Admin@123"), // Mật khẩu đăng nhập trên Postman
                    LastName = "Quản Trị",
                    FirstName = "Viên",
                    Role = "Admin",
                    IsActive = true,
                    Email = "admin@smartwms.com",
                    CreatedAt = DateTime.Now,
                    CreatedBy = "System"
                    // Thuộc tính FullName sẽ tự động sinh ra là "Quản Trị Viên" nhờ hàm lambda của bạn
                };

                context.Users.Add(adminUser);
                await context.SaveChangesAsync(default);
            }
        }
    }
}