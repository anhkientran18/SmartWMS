using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.Persistence.DbContext;

public sealed class ApplicationDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var environment = Argument(args, "--environment")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? "Development";
        var contentRoot = Argument(args, "--content-root") ?? FindApiDirectory();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(contentRoot)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true);

        if (string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase))
            configuration.AddUserSecrets("SmartWMS.Api-LocalDevelopment");

        var settings = configuration.AddEnvironmentVariables().Build();
        var connectionString = settings.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Configure ConnectionStrings:DefaultConnection for EF design-time commands.");

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connectionString).Options;

        // Design-time commands construct the model only: no API host, migration, seed or jobs.
        return new ApplicationDbContext(options, new DesignTimeUser());
    }

    private static string? Argument(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++)
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        return null;
    }

    private static string FindApiDirectory()
    {
        for (var directory = new DirectoryInfo(Directory.GetCurrentDirectory()); directory != null; directory = directory.Parent)
        {
            if (directory.Name == "SmartWMS.Api" && File.Exists(Path.Combine(directory.FullName, "appsettings.json")))
                return directory.FullName;
            var api = Path.Combine(directory.FullName, "SmartWMS.Api");
            if (File.Exists(Path.Combine(api, "appsettings.json")))
                return api;
        }
        throw new InvalidOperationException("Cannot locate SmartWMS.Api configuration. Pass --content-root to EF design-time commands.");
    }

    private sealed class DesignTimeUser : ICurrentUserService
    {
        public string? UserId => null;
        public string? Role => null;
        public string? IpAddress => null;
    }
}
