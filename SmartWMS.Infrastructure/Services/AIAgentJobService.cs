using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Enums;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Services;

public class AIAgentJobService : IAIAgentJobService
{
    private readonly IApplicationDbContext _context;
    private readonly IAiInsightService _aiInsightService;
    private readonly IInventoryNotificationService _notificationService;

    public AIAgentJobService(
        IApplicationDbContext context,
        IAiInsightService aiInsightService,
        IInventoryNotificationService notificationService)
    {
        _context = context;
        _aiInsightService = aiInsightService;
        _notificationService = notificationService;
    }

    public async Task ScanAndProactiveRestockAsync()
    {
        // 1. Quét toàn bộ bảng kiểm tra số lượng tồn kho thực tế ở các Bin
        var lowStockItems = await _context.BinInventories
            .Include(x => x.Product)
            .Where(x => x.Quantity < 20 && x.Status == InventoryStatus.Available)
            .ToListAsync();

        if (!lowStockItems.Any()) return;

        foreach (var item in lowStockItems)
        {
            if (item.Product == null) continue;

            // 🌟 ĐÃ SỬA: Kiểm tra sự tồn tại của phiếu thông qua bảng con Items (Sử dụng .Any)
            bool technicalTicketExists = await _context.InboundReceipts
                .AnyAsync(x => x.BinId == item.BinId &&
                               x.Items.Any(i => i.Product != null && i.Product.SKU == item.Product.SKU));

            if (technicalTicketExists) continue;

            // 2. Gọi AI sinh nội dung Email gửi nhà cung cấp dựa trên ngữ cảnh thực tế
            string aiPromptContext = $"Mặt hàng {item.Product!.Name} (SKU: {item.Product!.SKU}) hiện tại chỉ còn {item.Quantity} chiếc trong kho, dưới mức an toàn. Hãy soạn một email chuyên nghiệp bằng Tiếng Việt yêu cầu đặt thêm 200 chiếc.";
            string generatedEmailBody = await _aiInsightService.GenerateInsightAsync(aiPromptContext);

            // 3. 🌟 ĐÃ SỬA: Tạo phiếu cha InboundReceipt kèm danh sách bảng chi tiết Items chuẩn 1-N
            var autoTicket = new InboundReceipt
            {
                Id = Guid.NewGuid(),
                BinId = item.BinId,
                CreatedBy = "AI.VirtualAgent",
                CreatedAt = DateTime.UtcNow,
                Items = new List<InboundReceiptItem>
                {
                    new InboundReceiptItem
                    {
                        Id = Guid.NewGuid(),
                        ProductId = item.ProductId,
                        QuantityExpected = 200,  // Số lượng nhà cung cấp cần giao theo gợi ý AI
                        QuantityReceived = 0,    // Hàng mới đặt, thực nhận bằng 0
                        LotNumber = "AI-AUTO-LOT",
                        ExpirationDate = DateTime.UtcNow.AddDays(180) // Tạm tính hạn dùng 6 tháng
                    }
                }
            };

            _context.InboundReceipts.Add(autoTicket);

            // 4. Phát tín hiệu Real-time qua SignalR Hub tới Group Managers
            string dynamicMessage = $"Cảnh báo: Mặt hàng {item.Product!.SKU} sắp hết. AI Agent đã chuẩn bị sẵn phiếu nhập hàng gấp, mời bạn phê duyệt.";

            await _notificationService.SendToGroupAsync("Managers", "LowStockAlert", new
            {
                ProductSku = item.Product!.SKU,
                CurrentQty = item.Quantity,
                AlertMessage = dynamicMessage,
                AiEmailDraft = generatedEmailBody
            });
        }

        await _context.SaveChangesAsync(CancellationToken.None);
    }
}