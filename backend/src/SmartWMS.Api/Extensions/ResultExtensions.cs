using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Common.Constants;

namespace SmartWMS.Api.Extensions;

public static class ResultExtensions
{
    public static IActionResult ToActionResult<T>(this Result<T> result)
    {
        if (result.IsSuccess)
        {
            return new OkObjectResult(result);
        }

        // Trường hợp không thành công
        return new ObjectResult(new
        {
            isSuccess = false,
            message = result.Message ?? result.Error?.Message ?? "Đã xảy ra lỗi khi xử lý yêu cầu.",
            errorCode = result.Error?.Code ?? "ERR_GENERAL",
            errors = result.Errors
        }) { StatusCode = GetStatusCode(result.Error?.Code) };
    }

    public static IActionResult ToActionResult(this Result result)
    {
        if (result.IsSuccess)
        {
            return new OkObjectResult(result);
        }

        return new ObjectResult(new
        {
            isSuccess = false,
            message = result.Message ?? result.Error?.Message ?? "Đã xảy ra lỗi khi xử lý yêu cầu.",
            errorCode = result.Error?.Code ?? "ERR_GENERAL",
            errors = result.Errors
        }) { StatusCode = GetStatusCode(result.Error?.Code) };
    }

    private static int GetStatusCode(string? code) => code switch
    {
        "AI_RESPONSE_INVALID" => StatusCodes.Status502BadGateway,
        ErrorCodeConstants.Unauthorized => StatusCodes.Status401Unauthorized,
        ErrorCodeConstants.Forbidden => StatusCodes.Status403Forbidden,
        ErrorCodeConstants.NotFound or ErrorCodeConstants.ProductNotFound or
            ErrorCodeConstants.BinNotFound or ErrorCodeConstants.ZoneNotFound => StatusCodes.Status404NotFound,
        ErrorCodeConstants.Conflict or ErrorCodeConstants.SkuAlreadyExists or
            ErrorCodeConstants.BarcodeAlreadyExists => StatusCodes.Status409Conflict,
        ErrorCodeConstants.DatabaseError => StatusCodes.Status500InternalServerError,
        _ => StatusCodes.Status400BadRequest
    };
}
