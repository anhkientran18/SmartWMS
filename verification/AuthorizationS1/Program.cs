if (args.Length != 3) throw new ArgumentException("--http|--ownership|--f1-relevant|--regression <report> <api-dll|mirror|ignored>");
var report = Path.GetFullPath(args[1]); Directory.CreateDirectory(report);
var checks = new List<string>();
void Check(bool ok, string label) { checks.Add((ok ? "PASS: " : "FAIL: ") + label); Console.WriteLine(checks[^1]); }
try
{
    if (args[0] == "--http") await AuthorizationChecks.Run(report, args[2], Check);
    else if (args[0] == "--ownership") await HandlerChecks.Smoke(Check);
    else if (args[0] == "--f1-relevant") { await AiChecks.Run(Check); await DeepDataChecks.Run(Check); }
    else if (args[0] == "--regression") await RegressionSmoke.Run(report, args[2], Check);
    else throw new ArgumentException("Unknown mode");
}
finally { await File.WriteAllLinesAsync(Path.Combine(report,"results.txt"),checks); }
Console.WriteLine($"S1 {checks.Count(x=>x.StartsWith("PASS:"))}/{checks.Count} checks passed");
return checks.Any(x=>x.StartsWith("FAIL:")) ? 1 : 0;
