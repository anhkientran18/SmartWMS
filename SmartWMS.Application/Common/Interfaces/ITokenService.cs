using SmartWMS.Domain.Entities;
using System.Security.Claims;

namespace SmartWMS.Application.Common.Interfaces;

public interface ITokenService
{
    string GenerateJwtToken(User user);
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}