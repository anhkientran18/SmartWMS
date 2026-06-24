using System.Security.Cryptography;
using System.Text;

namespace SmartWMS.Application.Common.Utils;

public static class SecurityUtils
{
    public static string HashPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password)) return string.Empty;

        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }
}