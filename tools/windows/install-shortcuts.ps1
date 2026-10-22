param([switch]$VerifyOnly, [switch]$Startup, [switch]$RemoveStartup)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not (Test-Path -LiteralPath $desktop -PathType Container)) { throw "Active user's Desktop does not exist: $desktop" }
$wrapper = Join-Path $PSScriptRoot 'launch-local.vbs'
if (-not (Test-Path -LiteralPath $wrapper -PathType Leaf)) { throw "Missing launcher wrapper: $wrapper" }
$node = @(Get-Command node.exe -CommandType Application -ErrorAction Stop)[0].Source
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw 'Could not resolve an absolute Node.js executable.' }
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$shell = New-Object -ComObject WScript.Shell
# ASCII source works with Windows PowerShell 5.1's legacy script encoding.
$prefix = 'TS nextstep ' + [char]0x2014 + ' '
$definitions = @(
    @{ Name = 'Start All'; Mode = 'start'; Icon = 'shell32.dll,137'; Description = 'Start the local bridge, Resource Studio and portfolio; open both pages.' },
    @{ Name = 'Portfolio'; Mode = 'portfolio'; Icon = 'shell32.dll,13'; Description = 'Start or reuse the local environment and open the portfolio.' },
    @{ Name = 'Resource Studio'; Mode = 'studio'; Icon = 'shell32.dll,70'; Description = 'Start or reuse the local environment and open Resource Studio.' },
    @{ Name = 'Stop All'; Mode = 'stop'; Icon = 'shell32.dll,131'; Description = 'Gracefully stop only the authenticated TS nextstep launcher worker.' }
)
foreach ($definition in $definitions) {
    $location = Join-Path $desktop ($prefix + $definition.Name + '.lnk')
    $arguments = '//B //Nologo "{0}" {1} "{2}"' -f $wrapper, $definition.Mode, $node
    $icon = Join-Path (Join-Path $env:SystemRoot 'System32') $definition.Icon
    if ($VerifyOnly -and -not (Test-Path -LiteralPath $location -PathType Leaf)) { throw "Shortcut is missing: $location" }
    if (-not $VerifyOnly) {
        $link = $shell.CreateShortcut($location)
        $link.TargetPath = $wscript
        $link.Arguments = $arguments
        $link.WorkingDirectory = $root
        $link.WindowStyle = 7
        $link.IconLocation = $icon
        $link.Description = $definition.Description
        $link.Save()
    }
    $saved = $shell.CreateShortcut($location)
    if ($saved.TargetPath -ne $wscript -or $saved.Arguments -ne $arguments -or
        $saved.WorkingDirectory -ne $root -or $saved.WindowStyle -ne 7 -or $saved.IconLocation -ne $icon) {
        throw "Shortcut verification failed: $location"
    }
    [pscustomobject]@{ Path = $location; Target = $saved.TargetPath; Arguments = $saved.Arguments; WorkingDirectory = $saved.WorkingDirectory; Icon = $saved.IconLocation }
}

# Optional sign-in launcher (master prompt section 12): one plain .lnk in the current
# user's Startup folder, quiet mode (start --no-open). No installer, no registry key,
# no scheduled task, no elevation. -Startup creates it, -RemoveStartup deletes it,
# -VerifyOnly -Startup reads it back and fails if it is wrong.
$startupFolder = [Environment]::GetFolderPath('Startup')
if (-not (Test-Path -LiteralPath $startupFolder -PathType Container)) { throw "Startup folder does not exist: $startupFolder" }
$startupLocation = Join-Path $startupFolder ($prefix + 'Start All at sign-in.lnk')
$startupArguments = '//B //Nologo "{0}" start "{1}" --no-open' -f $wrapper, $node
$startupIcon = Join-Path (Join-Path $env:SystemRoot 'System32') 'shell32.dll,137'
if ($RemoveStartup) {
    if (Test-Path -LiteralPath $startupLocation -PathType Leaf) { Remove-Item -LiteralPath $startupLocation -Force }
    [pscustomobject]@{ Path = $startupLocation; Exists = (Test-Path -LiteralPath $startupLocation -PathType Leaf) }
}
if ($Startup -and -not $RemoveStartup -and -not $VerifyOnly) {
    $link = $shell.CreateShortcut($startupLocation)
    $link.TargetPath = $wscript
    $link.Arguments = $startupArguments
    $link.WorkingDirectory = $root
    $link.WindowStyle = 7
    $link.IconLocation = $startupIcon
    $link.Description = $prefix + 'Start the local environment at sign-in (quiet, no windows opened).'
    $link.Save()
}
if (($Startup -or ($VerifyOnly -and (Test-Path -LiteralPath $startupLocation -PathType Leaf))) -and -not $RemoveStartup) {
    if (-not (Test-Path -LiteralPath $startupLocation -PathType Leaf)) { throw "Startup shortcut is missing: $startupLocation" }
    $savedStartup = $shell.CreateShortcut($startupLocation)
    if ($savedStartup.TargetPath -ne $wscript -or $savedStartup.Arguments -ne $startupArguments -or
        $savedStartup.WorkingDirectory -ne $root -or $savedStartup.WindowStyle -ne 7 -or $savedStartup.IconLocation -ne $startupIcon) {
        throw "Startup shortcut verification failed: $startupLocation"
    }
    [pscustomobject]@{ Path = $startupLocation; Target = $savedStartup.TargetPath; Arguments = $savedStartup.Arguments; WorkingDirectory = $savedStartup.WorkingDirectory; WindowStyle = $savedStartup.WindowStyle }
}
