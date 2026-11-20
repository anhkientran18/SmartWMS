using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Common.Models;

public class ErrorResult
{
    public string Code { get; }
    public string Message { get; }

    public ErrorResult(string code, string message)
    {
        Code = code;
        Message = message;
    }
}

public class Result
{
    public bool IsSuccess { get; protected set; }
    public string? Message { get; protected set; }
    public ErrorResult? Error { get; protected set; }
    public List<string> Errors { get; init; } = new();

    protected Result() { }

    public static Result Success(string? message = null)
    {
        return new Result { IsSuccess = true, Message = message };
    }

    public static Result Failure(string code, string message)
    {
        return new Result { IsSuccess = false, Error = new ErrorResult(code, message) };
    }

    // Overload 1 tham số hỗ trợ code cũ
    public static Result Failure(string message)
    {
        return new Result { IsSuccess = false, Message = message, Error = new ErrorResult("ERR_GENERAL", message) };
    }

    public static Result Failure(string message, List<string>? errors = null)
    {
        return new Result { IsSuccess = false, Message = message, Error = new ErrorResult("OLD_ERR", message), Errors = errors ?? new() };
    }
}

public sealed class Result<T> : Result
{
    public T? Data { get; private set; }

    private Result() { }

    public static Result<T> Success(T data, string? message = null)
    {
        return new Result<T> { IsSuccess = true, Data = data, Message = message };
    }

    public new static Result<T> Failure(string code, string message)
    {
        return new Result<T> { IsSuccess = false, Error = new ErrorResult(code, message) };
    }

    // Overload 1 tham số hỗ trợ code cũ
    public new static Result<T> Failure(string message)
    {
        return new Result<T> { IsSuccess = false, Message = message, Error = new ErrorResult("ERR_GENERAL", message) };
    }

    public new static Result<T> Failure(string message, List<string>? errors = null)
    {
        return new Result<T> { IsSuccess = false, Message = message, Error = new ErrorResult("OLD_ERR", message), Errors = errors ?? new() };
    }
}