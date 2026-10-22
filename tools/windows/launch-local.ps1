param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'portfolio', 'studio', 'stop')]
    [string]$Mode,
    [Parameter(Mandatory = $true)]
    [string]$NodePath,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$logs = Join-Path $root 'logs\local-dev'
$exitCode = 1
try {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "Repository is missing: $root" }
    if (-not (Test-Path -LiteralPath $logs)) { New-Item -ItemType Directory -Path $logs -Force | Out-Null }
    if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) {
        throw 'Node.js has moved or is missing. Install a supported Node.js release and rerun tools\windows\install-shortcuts.ps1.'
    }
    $arguments = @((Join-Path $root 'tools\local-dev.mjs'))
    if ($Mode -eq 'portfolio' -or $Mode -eq 'studio') { $arguments += @('open', $Mode) }
    else { $arguments += $Mode }
    if ($NoOpen) { $arguments += '--no-open' }
    # PowerShell 5.1 turns native stderr into ErrorRecords. Capture it without
    # terminating early, then preserve the actual launcher's exit code.
    $ErrorActionPreference = 'Continue'
    $output = & $NodePath @arguments 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $text = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    $record = '{0} [{1}] exit={2}{3}{4}{3}' -f (Get-Date -Format o), $Mode, $exitCode, [Environment]::NewLine, $text
    Add-Content -LiteralPath (Join-Path $logs 'desktop.log') -Value $record -Encoding UTF8
    if ($exitCode -ne 0) { throw $text }
} catch {
    $message = "TS nextstep could not complete '$Mode'.`r`n`r`n$($_.Exception.Message)`r`n`r`nLogs: $logs"
    if ($NoOpen) { [Console]::Error.WriteLine($message) }
    else {
        $shell = New-Object -ComObject WScript.Shell
        $null = $shell.Popup($message, 0, 'TS nextstep launcher', 16)
    }
    exit 1
}
exit $exitCode
