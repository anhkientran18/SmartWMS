# Run from the repository root. All build outputs live in an ignored source mirror.
$ErrorActionPreference = 'Stop'
$repoRoot = (Get-Location).Path
$mirror = Join-Path $repoRoot 'obj/K1/source'
New-Item -ItemType Directory -Force -Path $mirror | Out-Null
$files = @((git ls-files) + (git ls-files --others --exclude-standard verification/KittingK1)) | Sort-Object -Unique
foreach ($relative in $files) {
    if ($relative -match '(^|/)(obj|bin)/' -or $relative -match '\.user$' -or $relative -notmatch '\.(cs|csproj|json|slnx|resx)$') { continue }
    $destination = Join-Path $mirror $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
    if ($relative -eq 'SmartWMS.Infrastructure/Services/PasswordHasher.cs') {
        # Use the committed dependency; do not depend on or rewrite the dirty baseline.
        $content = git show "HEAD:$relative"
        [System.IO.File]::WriteAllLines($destination, [string[]]$content, [System.Text.UTF8Encoding]::new($false))
    } else { Copy-Item -LiteralPath (Join-Path $repoRoot $relative) -Destination $destination -Force }
}
Write-Output $mirror
# Legacy Phase4A/4B suites snapshot a business connection. In the mirror only,
# force that read-only reference to a generated empty K1 fixture, never a shared DB.
foreach ($suite in @('Phase4A', 'Phase4B')) {
    $program = Join-Path $mirror "verification/$suite/Program.cs"
    $source = Get-Content -LiteralPath $program -Raw
    $source = [regex]::Replace($source, '(?m)^(?:const string business|var production) = .*;\r?$', {
        param($match)
        $name = if ($match.Value.StartsWith('const')) { 'business' } else { 'production' }
        'var ' + $name + ' = Environment.GetEnvironmentVariable("K1_REGRESSION_ANCHOR") ?? throw new InvalidOperationException("K1 isolated regression anchor required");'
    })
    [System.IO.File]::WriteAllText($program, $source, [System.Text.UTF8Encoding]::new($false))
}
