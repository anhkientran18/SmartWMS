using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Chat.Queries;

public record GetAiChatResponseQuery(string Message) : IRequest<Result<string>>;