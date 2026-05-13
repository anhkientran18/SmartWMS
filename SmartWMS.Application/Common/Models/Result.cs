namespace SmartWMS.Application.Common.Models;

public class Result<T>
{
    public bool IsSuccess { get; init; }
    public T? Data { get; init; }
    public string Message { get; init; } = string.Empty;
    public List<string> Errors { get; init; } = new();

    public static Result<T> Success(T data, string message = "") =>
        new() { IsSuccess = true, Data = data, Message = message };

    public static Result<T> Failure(string message, List<string>? errors = null) =>
        new() { IsSuccess = false, Message = message, Errors = errors ?? new() };
}