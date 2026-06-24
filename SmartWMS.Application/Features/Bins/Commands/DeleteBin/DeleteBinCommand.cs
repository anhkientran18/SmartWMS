using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.Bins.Commands; // Đảm bảo namespace này trùng khớp với Handler

public class DeleteBinCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }

    public DeleteBinCommand(Guid id)
    {
        Id = id;
    }
}