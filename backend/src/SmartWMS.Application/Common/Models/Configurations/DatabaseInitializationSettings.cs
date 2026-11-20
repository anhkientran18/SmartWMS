using System;

namespace SmartWMS.Application.Common.Models.Configurations;

public sealed class DatabaseInitializationSettings
{
    public const string SectionName = "DatabaseInitialization";

    public bool ApplyMigrationsOnStartup { get; set; }
    public bool SeedOnStartup { get; set; }
    public string[] AllowedMigrationEnvironments { get; set; } = ["Development"];

    public bool IsEnvironmentAllowed(string environmentName)
        => Array.Exists(AllowedMigrationEnvironments ?? [],
            allowed => string.Equals(allowed, environmentName, StringComparison.OrdinalIgnoreCase));

    public void Validate(string environmentName, bool prepareHangfireSchema)
    {
        if ((ApplyMigrationsOnStartup || SeedOnStartup || prepareHangfireSchema)
            && !IsEnvironmentAllowed(environmentName))
            throw new InvalidOperationException(
                "Database initialization is enabled outside DatabaseInitialization:AllowedMigrationEnvironments.");
    }
}
