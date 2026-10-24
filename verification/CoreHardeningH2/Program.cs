if (args.Length != 2) throw new ArgumentException("<report-directory> <fixture-api-dll>");
var report=Path.GetFullPath(args[0]);Directory.CreateDirectory(report);
var checks=new List<string>();
void Check(bool ok,string label){checks.Add((ok?"PASS: ":"FAIL: ")+label);Console.WriteLine(checks[^1]);}
try
{
    await HttpChecks.Run(report,args[1],Check);
    await EmbeddingChecks.Run(Check);
}
finally { await File.WriteAllLinesAsync(Path.Combine(report,"results.txt"),checks); }
await File.WriteAllTextAsync(Path.Combine(report,"summary.json"),System.Text.Json.JsonSerializer.Serialize(new{complete=true,passed=checks.Count(x=>x.StartsWith("PASS:")),total=checks.Count}));
Console.WriteLine($"H2 {checks.Count(x=>x.StartsWith("PASS:"))}/{checks.Count} checks passed");
return checks.Any(x=>x.StartsWith("FAIL:"))?1:0;
