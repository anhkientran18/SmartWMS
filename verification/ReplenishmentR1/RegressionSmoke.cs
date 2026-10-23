using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Infrastructure.Persistence.DbContext;

static class RegressionSmoke
{
    public static async Task Run(string report, string mirror, Action<bool, string> check)
    {
        mirror = Path.GetFullPath(mirror);
        await using var anchor = new FixtureDatabase("R1 regression read-only anchor, substitutes for legacy suites' shared-DB snapshots");
        await using (var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(anchor.Connection).Options, new FixtureUser()))
            await db.Database.MigrateAsync();
        var before = await FixtureDatabase.Snapshot(anchor.Connection);
        var api = Path.Combine(mirror, "SmartWMS.Api/bin/Debug/net10.0/SmartWMS.Api.dll");
        foreach (var (suite, mode) in new[] { ("Phase4A", "--verify-localdb"), ("Phase4B", "--verify-localdb"), ("InboundB1", "--verify-localdb"), ("OutboundB3", "--schema"), ("OutboundB3", "--focused"), ("OutboundB3", "--cached-context"), ("OutboundB3", "--http"), ("KittingK1", "--focused"), ("KittingK1", "--http") })
        {
            var label = suite + mode.Replace("--", "-"); var output = Path.Combine(report, label); Directory.CreateDirectory(output);
            var start = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = report };
            start.ArgumentList.Add(Path.Combine(mirror, $"verification/{suite}/bin/Debug/net10.0/{suite}.Verification.dll"));
            start.ArgumentList.Add(mode); start.ArgumentList.Add(output);
            if (suite == "InboundB1" || mode == "--http") start.ArgumentList.Add(api);
            start.Environment["R1_REGRESSION_ANCHOR"] = anchor.Connection;
            using var process = Process.Start(start)!; var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
            try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromMinutes(5)); }
            finally { if (!process.HasExited) { process.Kill(entireProcessTree: true); await process.WaitForExitAsync(); } }
            var text = await stdout + await stderr; await File.WriteAllTextAsync(Path.Combine(output, "run.log"), text);
            Console.WriteLine(text.Split('\n').LastOrDefault(x => x.Contains("CHECKS PASSED")) ?? text[^Math.Min(text.Length, 1200)..]);
            check(process.ExitCode == 0, "regression " + label + " exit0");
        }
        check(before == await FixtureDatabase.Snapshot(anchor.Connection), "legacy regression reference fixture unchanged; no shared/business database accessed");
    }
}
