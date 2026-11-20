namespace SmartWMS.Application.Common.Interfaces;

public interface IAIAgentJobService
{
    Task ScanAndProactiveRestockAsync();
}