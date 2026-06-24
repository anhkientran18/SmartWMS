namespace SmartWMS.Application.Common.Models.Configurations;

public class GeminiSettings
{
    public const string SectionName = "GeminiSettings";

    // Khóa API bảo mật của Google Gemini Core
    public string ApiKey { get; set; } = string.Empty;
}