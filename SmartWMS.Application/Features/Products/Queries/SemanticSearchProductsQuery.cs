using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Products.Queries;

public record SemanticSearchProductsQuery(string SearchText, double MinScore = 0.5)
    : IRequest<Result<List<SemanticSearchResultDto>>>;

public class SemanticSearchResultDto
{
    public Guid Id { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double SimilarityScore { get; set; } // Điểm số độ trùng khớp ngữ nghĩa (0.0 -> 1.0)
}