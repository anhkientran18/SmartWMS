using System;

namespace SmartWMS.Application.Features.Products.DTOs;

public class ProductResultDto
{
    public Guid Id { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double SimilarityScore { get; set; }
}