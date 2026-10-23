namespace SmartWMS.Application.Common.Models.Configurations;

public class GeminiSettings
{
    public const string SectionName = "GeminiSettings";

    public string ApiKey { get; set; } = string.Empty;
    // Production requires explicit model configuration. Development supplies its own choices.
    public string DefaultModel { get; set; } = string.Empty;
    public string ProModel { get; set; } = string.Empty;
    public string EmbeddingModel { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";
}
