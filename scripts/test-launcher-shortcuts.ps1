$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$desktop = [Environment]::GetFolderPath('Desktop')
$statePath = Join-Path $root '.resource-studio\local-services.json'
$prefix = 'TS nextstep ' + [char]0x2014 + ' '
$shell = New-Object -ComObject WScript.Shell

function Get-ServiceListeners {
    @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 4175,4174,5173 })
}
function Invoke-SavedShortcut([string]$Name) {
    $location = Join-Path $desktop ($prefix + $Name + '.lnk')
    if (-not (Test-Path -LiteralPath $location -PathType Leaf)) { throw "Missing shortcut: $location" }
    $link = $shell.CreateShortcut($location)
    # Use the saved target and arguments, with only the documented testing
    # flag added. This exercises WScript -> hidden PowerShell -> absolute Node.
    $process = Start-Process -FilePath $link.TargetPath -ArgumentList ($link.Arguments + ' --no-open') -WorkingDirectory $env:TEMP -WindowStyle Hidden -PassThru
    # Start-Process -Wait waits for descendants too, including the deliberately
    # persistent worker. Wait for the WScript wrapper itself instead.
    if (-not $process.WaitForExit(90000)) { throw "Shortcut wrapper timed out: $location" }
    if ($process.ExitCode -ne 0) { throw "Shortcut failed: $location (exit $($process.ExitCode)); see logs\local-dev\desktop.log" }
}
function Get-WorkerPid {
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { throw 'Launcher state is missing.' }
    # Never print the state: it includes the random local control secret.
    (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).pid
}

if (@(Get-ServiceListeners).Count -ne 0) { throw 'Stop the existing local environment before running the shortcut lifecycle test.' }
& (Join-Path $root 'tools\windows\install-shortcuts.ps1') -VerifyOnly | Format-List
try {
    Invoke-SavedShortcut 'Start All'
    $workerId = Get-WorkerPid
    Invoke-SavedShortcut 'Start All'
    if ((Get-WorkerPid) -ne $workerId) { throw 'Repeated Start All changed the worker PID.' }
    foreach ($name in @('Portfolio', 'Resource Studio')) {
        Invoke-SavedShortcut $name
        if ((Get-WorkerPid) -ne $workerId) { throw "$name did not reuse the worker." }
    }
    $listeners = @(Get-ServiceListeners)
    if ($listeners.Count -ne 3 -or @($listeners | Where-Object { $_.OwningProcess -ne $workerId -or $_.LocalAddress -ne '127.0.0.1' }).Count -ne 0) {
        throw 'Saved shortcut did not start exactly the expected loopback services.'
    }
    "PASS saved shortcut targets: repeated Start All, Portfolio and Resource Studio reused PID $workerId from an unrelated working directory."
} finally {
    Invoke-SavedShortcut 'Stop All'
}
if (@(Get-ServiceListeners).Count -ne 0) { throw 'Saved Stop All shortcut did not release the service ports.' }
if (Test-Path -LiteralPath $statePath) { throw 'Saved Stop All shortcut did not clear launcher state.' }
'PASS saved Stop All target: graceful shutdown completed; no launcher services remain.'

$wrapper = Join-Path $root 'tools\windows\launch-local.ps1'
$missingNode = Join-Path $env:TEMP 'ts-nextstep-nonexistent-node.exe'
if (Test-Path -LiteralPath $missingNode) { throw 'Missing-Node fixture unexpectedly exists.' }
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $wrapper -Mode start -NodePath $missingNode -NoOpen
if ($LASTEXITCODE -ne 1) { throw 'Missing Node did not produce a nonzero wrapper exit.' }
'PASS missing Node: wrapper returned an actionable failure instead of silently exiting.'
exit 0
