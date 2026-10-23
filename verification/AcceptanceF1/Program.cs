using Microsoft.EntityFrameworkCore;
using SmartWMS.Infrastructure.Persistence.DbContext;

if (args.Length < 3) throw new ArgumentException("--exhaustive|--http|--infra|--deep-data|--data|--regression|--results <report> <api-dll|mirror|evidence>");
var report = Path.GetFullPath(args[1]); Directory.CreateDirectory(report);
var results = new List<string>();
void Check(bool ok, string label) { lock(results) { results.Add((ok ? "PASS: " : "FAIL: ") + label); Console.WriteLine(results[^1]); } }
try
{
    if (args[0] == "--results")
    {
        using var json=System.Text.Json.JsonDocument.Parse(await File.ReadAllTextAsync(args[2]));
        Check(json.RootElement.GetProperty("stats").GetProperty("assertions").GetProperty("failed").GetInt32()==0,"Newman live happy-path assertions all pass");
    }
    else if (args[0] == "--infra") await InfrastructureChecks.Run(report,args[2],Check);
    else if (args[0] == "--data") await DataChecks.Run(Check);
    else if (args[0] == "--deep-data") await DeepDataChecks.Run(Check);
    else if (args[0] == "--http") await HttpSmoke.Run(report, args[2], Check);
    else if (args[0] == "--exhaustive")
    {
        Environment.SetEnvironmentVariable("F1_DETERMINISTIC","1");
        await HttpSmoke.Run(report,args[2],Check);
    }
    else if (args[0] == "--regression") await RegressionSmoke.Run(report, args[2], Check);
    else throw new ArgumentException("Unknown mode");
}
finally { await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results); }
Console.WriteLine($"F1 {results.Count(x => x.StartsWith("PASS:"))}/{results.Count} checks passed");
return results.Any(x => x.StartsWith("FAIL:")) ? 1 : 0;
