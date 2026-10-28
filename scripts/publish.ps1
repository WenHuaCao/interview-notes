$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $workspaceRoot
$target = 'WenHuaCao/interview-notes'
$expectedRemote = "https://github.com/$target.git"

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable 执行失败（退出码 $LASTEXITCODE）" }
}

$login = & gh api user --jq .login
if ($LASTEXITCODE -ne 0) { throw '请先运行 gh auth login --hostname github.com --git-protocol https --web --scopes workflow，然后重试。' }
if ($login -ine 'WenHuaCao') { throw '当前 gh 登录账户不是 WenHuaCao，未创建或推送仓库。' }
$branch = & git branch --show-current
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw '只允许发布本项目 main 分支。' }
$dirty = & git status --porcelain
if ($dirty) { throw '请先检查并提交项目改动，再发布；脚本不会自动提交未知内容。' }

& gh repo view $target --json nameWithOwner 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Invoke-Checked 'gh' @('repo', 'create', $target, '--public', '--description', '拾问：面试问答时间线、标签归档与主动回忆博客')
}
$remote = & git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) { Invoke-Checked 'git' @('remote', 'add', 'origin', $expectedRemote) }
elseif ($remote -notin @($expectedRemote, "https://github.com/$target", "git@github.com:$target.git")) { throw 'origin 与目标仓库不一致，未推送。' }
Invoke-Checked 'git' @('push', '-u', 'origin', 'main')

$pagesText = & gh api "repos/$target/pages" 2>$null
if ($LASTEXITCODE -ne 0) {
    '{"build_type":"workflow"}' | & gh api --method POST "repos/$target/pages" --input -
    if ($LASTEXITCODE -ne 0) { throw '仓库已推送，但启用 GitHub Pages 失败。请在仓库 Settings > Pages 中选择 GitHub Actions。' }
} else {
    $pages = $pagesText | ConvertFrom-Json
    if ($pages.build_type -ne 'workflow') { Invoke-Checked 'gh' @('api', '--method', 'PUT', "repos/$target/pages", '-f', 'build_type=workflow') }
}
Write-Output "仓库：https://github.com/$target"
Write-Output '发布目标：https://wenhuacao.github.io/interview-notes/'
Write-Output '请检查 GitHub Actions，部署成功后才表示网站已经上线。'
Invoke-Checked 'gh' @('run', 'list', '--repo', $target, '--limit', '3')
