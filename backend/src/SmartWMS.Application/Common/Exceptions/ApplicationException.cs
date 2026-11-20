using System;

namespace SmartWMS.Application.Common.Exceptions;

public class ApplicationException : Exception
{
    public string? ErrorCode { get; }

    public ApplicationException(string message) : base(message) { }

    public ApplicationException(string errorCode, string message) : base(message)
    {
        ErrorCode = errorCode;
    }
}