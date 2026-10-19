namespace SmartWMS.Application.Common.Models.Configurations;

public class GeminiSettings
{
    public const string SectionName = "GeminiSettings";

    public string ApiKey { get; set; } = string.Empty;
    public string DefaultModel { get; set; } = "gemini-1.5-flash";
    public string ProModel { get; set; } = "gemini-1.5-pro";
    public string EmbeddingModel { get; set; } = "gemini-embedding-001";
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";
}