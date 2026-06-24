using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Bins.Commands.CreateBin;

public record CreateBinCommand : IRequest<Result<Guid>>
{
    public string Code { get; init; } = string.Empty; // Ví dụ: "A1-R1-L1"
    public Guid ZoneId { get; init; }
    public double Width { get; init; }  // Chiều rộng kệ (cm)
    public double Height { get; init; } // Chiều cao kệ (cm)
    public double Depth { get; init; }  // Chiều sâu kệ (cm)
    public double MaxCapacity { get; set; }
}