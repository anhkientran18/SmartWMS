using System;

namespace SmartWMS.Application.Features.CrossDocking.Commands.ProcessCrossDock.Dtos;

public class CrossDockResultDto
{
    public Guid ProductId { get; set; }
    public int TotalIncomingQuantity { get; set; }
    public int CrossDockedQuantity { get; set; } // Số lượng được cắt ngang xuất đi ngay
    public int RemainderForPutaway { get; set; } // Số lượng dư thừa còn lại bắt buộc phải cất lên kệ
    public string ExecutionSummary { get; set; } = string.Empty;
}