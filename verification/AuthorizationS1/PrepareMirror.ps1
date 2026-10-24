# Never build the original working tree: its 25 baseline paths are protected.
$ErrorActionPreference = 'Stop'
$repo = (Get-Location).Path
$mirror = Join-Path $repo 'obj/S1/source'
New-Item -ItemType Directory -Force $mirror | Out-Null
$files = @((git ls-files) + (git ls-files --others --exclude-standard verification/AuthorizationS1 SmartWMS.Application/Features/CycleCounting)) | Sort-Object -Unique
foreach ($relative in $files) {
    if ($relative -match '(^|/)(obj|bin)/|\.user$' -or $relative -notmatch '\.(cs|csproj|json|slnx|resx)$') { continue }
    $target = Join-Path $mirror $relative
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    if ($relative -eq 'SmartWMS.Infrastructure/Services/PasswordHasher.cs') {
        [IO.File]::WriteAllLines($target, [string[]](git show "HEAD:$relative"), [Text.UTF8Encoding]::new($false))
    } else { Copy-Item -LiteralPath (Join-Path $repo $relative) -Destination $target -Force }
}
# Legacy suites only: replace their read-only business DB snapshot with an empty generated anchor.
foreach ($suite in @('Phase4A','Phase4B')) {
    $target = Join-Path $mirror "verification/$suite/Program.cs"
    $source = Get-Content -LiteralPath $target -Raw
    $source = [regex]::Replace($source, '(?m)^(?:const string business|var production) = .*;\r?$', {
        param($match)
        $name = if ($match.Value.StartsWith('const')) {'business'} else {'production'}
        'var ' + $name + ' = Environment.GetEnvironmentVariable("F1_REGRESSION_ANCHOR") ?? throw new InvalidOperationException("S1 fixture anchor required");'
    })
    [IO.File]::WriteAllText($target,$source,[Text.UTF8Encoding]::new($false))
}
# The historical Phase4B repository artifact keeps exactly the HEAD content.
# Supply the new S1 actor dependency ONLY to its existing fixture call in the mirror.
$phase4b = Join-Path $mirror 'verification/Phase4B/Program.cs'
$text = Get-Content -LiteralPath $phase4b -Raw
$old = 'new ConfirmCycleCountCommandHandler(db, new InventoryMutationCoordinator(db), new CycleCountCoordinator(db))'
if ([regex]::Matches($text,[regex]::Escape($old)).Count -ne 1) { throw 'Phase4B constructor call changed; review S1 mirror adapter' }
$new = 'new ConfirmCycleCountCommandHandler(db, new InventoryMutationCoordinator(db), new CycleCountCoordinator(db), new VerifyUser(userId))'
[IO.File]::WriteAllText($phase4b,$text.Replace($old,$new),[Text.UTF8Encoding]::new($false))
# R1 business checks remain unchanged. Its final historical Staff200 assertion
# conflicts with S1's explicit policy; adapt that assertion ONLY in this ignored mirror.
$r1 = Join-Path $mirror 'verification/ReplenishmentR1/HttpSmoke.cs'
$text = Get-Content -LiteralPath $r1 -Raw
$old = 'await Login("r1-staff"); await Post(0, "existing Authorize contract permits authenticated Staff (unchanged role policy)");'
if (-not $text.Contains($old)) { throw 'R1 historical assertion changed; review mirror adapter' }
$new = @'
await Login("r1-staff");
            var deniedBefore = await FixtureDatabase.Snapshot(fixture.Connection);
            using (var denied = await http.PostAsJsonAsync(route, new { })) check(denied.StatusCode == HttpStatusCode.Forbidden, "S1 Staff auto-replenish403 (replaces historical Staff200 expectation)");
            check(deniedBefore == await FixtureDatabase.Snapshot(fixture.Connection), "S1 rejected Staff refill preserves SQL/stock/ledger/audit");
'@
[IO.File]::WriteAllText($r1,$text.Replace($old,$new),[Text.UTF8Encoding]::new($false))
Write-Output $mirror
