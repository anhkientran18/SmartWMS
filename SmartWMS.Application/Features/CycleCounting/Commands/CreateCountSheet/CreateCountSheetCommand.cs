using MediatR;
using SmartWMS.Application.Common.Models;
using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.CreateCountSheet;

public class CreateCountSheetCommand : IRequest<Result<Guid>>
{
    public string Title { get; set; } = string.Empty;
    public string AssignedOperator { get; set; } = string.Empty; // Nhân viên chịu trách nhiệm kiểm đếm
    public List<Guid> TargetBinIds { get; set; } = new(); // Danh sách các ô kệ cần rà soát
}