using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Chat.Queries.GetAiChatResponse;

public record GetAiChatResponseQuery(string Message) : IRequest<Result<string>>;