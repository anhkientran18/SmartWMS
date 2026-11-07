[CmdletBinding()]
param(
    # Acknowledges writes to bin/obj/dist and existing frontend verification files.
    # Prefer a separate working copy when those files must be preserved.
    [switch]$AllowDirty,
    [switch]$SkipFrontendTests
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repo
try {
    if (-not (Test-Path 'SmartWMS.slnx') -or -not (Test-Path 'frontend/package.json')) {
        throw 'Khong tim thay solution hoac frontend/package.json. Chay tu repo SmartWMS.'
    }
    $dirty = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw 'git status failed' }
    if ($dirty.Count -gt 0 -and -not $AllowDirty) {
        throw "Working tree co $($dirty.Count) paths thay doi. Dung clean worktree hoac chon -AllowDirty khi da xem xet side effects. Khong tu clean/reset."
    }
    if (-not (Test-Path 'frontend/node_modules')) {
        throw 'Chua co frontend/node_modules. Chay npm ci trong clean worktree sau khi review lifecycle scripts.'
    }
    $sdkVersion = & dotnet --version
    if ($LASTEXITCODE -ne 0 -or $sdkVersion -notmatch '^10\.') {
        throw 'Can chon .NET SDK 10 truoc khi verify; xem docs/DEVELOPMENT_WORKFLOW.md.'
    }
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v22\.') {
        throw 'Can Node.js 22 de khop CI.'
    }
    Write-Host 'SIDE EFFECTS: restore/build writes bin/obj/dist; sprint overwrites verification bundles/logs/results and removes two temporary bundles. No artifact cleanup by this script.'
    Write-Host 'CHECK: .NET solution restore/build; no SQL/API host/migration.'
    & dotnet restore 'SmartWMS.slnx' --nologo
    if ($LASTEXITCODE -ne 0) { throw 'dotnet restore failed' }
    & dotnet build 'SmartWMS.slnx' --configuration Release --no-restore --nologo
    if ($LASTEXITCODE -ne 0) { throw 'dotnet build failed' }

    Write-Host 'CHECK: frontend typecheck/build; tests run only when not skipped.'
    & npm --prefix frontend run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'frontend typecheck failed' }
    if (-not $SkipFrontendTests) {
        # run-sprint.mjs does not create its ignored evidence directory.
        New-Item -ItemType Directory -Path 'frontend/verification/shared/evidence' -Force | Out-Null
        & npm --prefix frontend run test:sprint
        if ($LASTEXITCODE -ne 0) { throw 'frontend test:sprint failed' }
    }
    else {
        Write-Host 'NOT RUN: frontend test:sprint (-SkipFrontendTests).'
    }
    & npm --prefix frontend run build
    if ($LASTEXITCODE -ne 0) { throw 'frontend build failed' }
    Write-Host 'PASS: selected local checks completed. This does not certify SQL/API regression or skipped tests.'
}
finally {
    Pop-Location
}
