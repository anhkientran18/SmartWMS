using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight.Dtos;
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

    public async Task<Result<WeightValidationResultDto>> Handle(ValidatePackingWeightCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.SKU))
        {
            return Result<WeightValidationResultDto>.Failure("Mã SKU không được để trống.");
        }

        if (request.Quantity <= 0)
        {
            return Result<WeightValidationResultDto>.Failure("Số lượng hàng kiểm tra phải lớn hơn 0.");
        }

        var product = await _context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SKU == request.SKU, cancellationToken);

        if (product == null)
        {
            return Result<WeightValidationResultDto>.Failure($"Mã sản phẩm SKU {request.SKU} không tồn tại.");
        }

        double unitWeightGrams = 250;
        string skuUpper = (product.SKU ?? string.Empty).ToUpper();

        if (skuUpper.Contains("COCA")) unitWeightGrams = 340;
        else if (skuUpper.Contains("MILK")) unitWeightGrams = 1030;
        else if (skuUpper.Contains("LOGI")) unitWeightGrams = 141;
        else if (skuUpper.Contains("ASUS")) unitWeightGrams = 2200;

        double expectedTotalWeight = unitWeightGrams * request.Quantity;
        expectedTotalWeight += 150; // Trọng lượng bao bì thùng rỗng

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
            resultDto.StatusMessage = "✅ KIỆN HÀNG HỢP LỆ! Trọng lượng nằm trong sai số cho phép. Hệ thống kích hoạt in nhãn vận chuyển tự động.";
        }
        else
        {
            resultDto.IsValid = false;
            resultDto.StatusMessage = request.ActualWeightGrams > expectedTotalWeight
                ? "❌ CẢNH BÁO: Kiện hàng thừa trọng lượng vượt ngưỡng! Kiểm tra lại số lượng hoặc phụ kiện."
                : "⚠️ CẢNH BÁO: Kiện hàng thiếu trọng lượng nghiêm trọng! Kiểm tra lại vật tư bốc xếp.";
        }

        return Result<WeightValidationResultDto>.Success(resultDto);
    }
}