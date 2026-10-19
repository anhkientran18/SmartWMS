using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;

public class ValidatePackingWeightCommandHandler : IRequestHandler<ValidatePackingWeightCommand, Result<WeightValidationResultDto>>
{
    private readonly IApplicationDbContext _context;

    public ValidatePackingWeightCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<WeightValidationResultDto>> Handle(ValidatePackingWeightCommand command, CancellationToken cancellationToken)
    {
        var request = command.RequestData;

        if (request == null || string.IsNullOrWhiteSpace(request.SKU))
        {
            return Result<WeightValidationResultDto>.Failure("Mã SKU không được để trống.");
        }

        if (request.Quantity <= 0)
        {
            return Result<WeightValidationResultDto>.Failure("Số lượng hàng kiểm tra phải lớn hơn 0.");
        }

        if (!double.IsFinite(request.ActualWeightGrams) || request.ActualWeightGrams <= 0)
            return Result<WeightValidationResultDto>.Failure("Trọng lượng thực tế theo grams phải hữu hạn và lớn hơn 0.");

        // 1. Lấy thông tin sản phẩm thực tế từ Database
        var product = await _context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SKU == request.SKU && !p.IsDeleted, cancellationToken);

        if (product == null)
        {
            return Result<WeightValidationResultDto>.Failure($"Mã sản phẩm SKU {request.SKU} không tồn tại.");
        }

        // 2. Sử dụng trọng lượng sản phẩm lưu trữ trong Database (mặc định 250g nếu chưa thiết lập)
        double unitWeightGrams = product.Weight > 0 ? (double)product.Weight : 250.0;

        // Trọng lượng dự kiến = (Trọng lượng đơn vị * Số lượng) + 150g vỏ thùng/đóng gói
        double expectedTotalWeight = (unitWeightGrams * request.Quantity) + 150.0;

        double weightDifference = Math.Abs(request.ActualWeightGrams - expectedTotalWeight);
        double deviationPercentage = (weightDifference / expectedTotalWeight) * 100;

        var resultDto = new WeightValidationResultDto
        {
            ExpectedTotalWeightGrams = Math.Round(expectedTotalWeight, 2),
            ActualWeightGrams = Math.Round(request.ActualWeightGrams, 2),
            DeviationPercentage = Math.Round(deviationPercentage, 2)
        };

        if (deviationPercentage <= 5.0)
        {
            resultDto.IsValid = true;
            resultDto.StatusMessage = "✅ KIỆN HÀNG HỢP LỆ! Trọng lượng nằm trong sai số cho phép.";
        }
        else
        {
            resultDto.IsValid = false;
            resultDto.StatusMessage = request.ActualWeightGrams > expectedTotalWeight
                ? "❌ CẢNH BÁO: Kiện hàng thừa trọng lượng vượt ngưỡng cho phép!"
                : "⚠️ CẢNH BÁO: Kiện hàng thiếu trọng lượng nghiêm trọng!";
        }

        return Result<WeightValidationResultDto>.Success(resultDto);
    }
}