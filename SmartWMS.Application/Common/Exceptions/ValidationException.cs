using System.Collections.Generic;
using System.Linq;

namespace SmartWMS.Application.Common.Exceptions;

public class ValidationError
{
    public string PropertyName { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public object? AttemptedValue { get; set; }
    public string? ErrorCode { get; set; }
}

public class ValidationException : ApplicationException
{
    public List<ValidationError> Errors { get; }

    public ValidationException(List<ValidationError> errors) : base("Validation failed")
    {
        Errors = errors;
    }
}