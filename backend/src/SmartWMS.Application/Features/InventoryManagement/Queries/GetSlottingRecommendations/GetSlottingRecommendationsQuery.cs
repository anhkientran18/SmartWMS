using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations;

public record GetSlottingRecommendationsQuery(SlottingRecommendationRequest RequestData) : IRequest<Result<List<SlottingRecommendationDto>>>;