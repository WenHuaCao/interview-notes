param(
    [ValidateSet('install', 'dev', 'check', 'test', 'build', 'preview', 'e2e')]
    [string]$Command = 'dev'
)
$ErrorActionPreference = 'Stop'
$previousPath = $env:PATH
$previousTelemetry = $env:ASTRO_TELEMETRY_DISABLED
try {
    Set-Location -LiteralPath $PSScriptRoot
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $nodeCandidate = if ($nodeCommand) { $nodeCommand.Source } else { $null }
    $major = if ($nodeCandidate) { [int]((& $nodeCandidate --version) -replace '^v(\d+).*', '$1') } else { 0 }
    if ($major -lt 24) {
        $nodeCandidate = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
        if (-not (Test-Path -LiteralPath $nodeCandidate)) { throw '需要 Node.js 24；未找到可复用的 Codex Node 运行时。' }
        $major = [int]((& $nodeCandidate --version) -replace '^v(\d+).*', '$1')
        if ($major -lt 24) { throw '已有 Node 运行时版本低于 24。' }
    }
    $env:PATH = (Split-Path -Parent $nodeCandidate) + ';' + $previousPath
    $env:ASTRO_TELEMETRY_DISABLED = '1'
    $npmCommand = Get-Command npm.cmd -ErrorAction Stop
    if ($Command -eq 'install') { & $npmCommand.Source ci }
    else {
        $npmScript = if ($Command -eq 'e2e') { 'test:e2e' } else { $Command }
        & $npmCommand.Source run $npmScript
    }
    if ($LASTEXITCODE -ne 0) { throw "项目命令失败：$Command（退出码 $LASTEXITCODE）" }
} finally {
    $env:PATH = $previousPath
    $env:ASTRO_TELEMETRY_DISABLED = $previousTelemetry
}
