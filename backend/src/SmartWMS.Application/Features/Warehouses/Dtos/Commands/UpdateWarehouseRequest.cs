using System;

namespace SmartWMS.Application.Features.Warehouses.DTOs.Commands;

public class UpdateWarehouseRequest
{
    private Guid? _defaultStagingBinId;
    public Guid? DefaultStagingBinId
    {
        get => _defaultStagingBinId;
        set
        {
            _defaultStagingBinId = value;
            DefaultStagingBinIdSpecified = true;
        }
    }

    [System.Text.Json.Serialization.JsonIgnore]
    public bool DefaultStagingBinIdSpecified { get; private set; }

    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}