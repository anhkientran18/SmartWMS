using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Chat.DTOs.Queries;

namespace SmartWMS.Application.Features.Chat.Queries.GetAiChatResponse;

public record GetAiChatResponseQuery(AiChatRequest RequestData) : IRequest<Result<string>>;