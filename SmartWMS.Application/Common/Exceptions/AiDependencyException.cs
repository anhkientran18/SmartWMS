namespace SmartWMS.Application.Common.Exceptions;

// A safe, stable dependency code; never include provider bodies, URLs or credentials.
public sealed class AiDependencyException(string code) : Exception("AI dependency could not complete the request.")
{
    public string Code { get; } = code;
}
