param([string[]]$CaptureFlags = @('--capture'))

$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$enginePath = Join-Path $projectPath '.tools/Godot_v4.7.2-stable_win64_console.exe'
if (-not (Test-Path -LiteralPath $enginePath)) { throw 'Run tools/get_godot.sh first.' }
foreach ($flag in $CaptureFlags) {
    if ($flag -notmatch '^--[a-z0-9-]+$') { throw "Expected a capture switch: $flag" }
}
$stdoutPath = [IO.Path]::GetTempFileName()
$stderrPath = [IO.Path]::GetTempFileName()
try {
    $arguments = '--path . --rendering-method gl_compatibility --resolution 1280x720 --script res://tools/capture_scene.gd -- ' + ($CaptureFlags -join ' ')
    $process = Start-Process -FilePath $enginePath -ArgumentList $arguments -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $output = [IO.File]::ReadAllText($stdoutPath) + [IO.File]::ReadAllText($stderrPath)
    Write-Output $output.TrimEnd()
    if ($process.ExitCode -ne 0 -or $output -match '\b(ERROR|WARNING|FAIL)\b') {
        throw 'Render capture failed; see engine output above.'
    }
} finally {
    Remove-Item -LiteralPath $stdoutPath, $stderrPath
}
