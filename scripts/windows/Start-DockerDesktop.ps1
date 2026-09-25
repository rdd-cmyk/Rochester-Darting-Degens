#requires -Version 5.1
<#
.SYNOPSIS
Starts a per-user Docker Desktop install, preserving known stale runtime sockets.
.DESCRIPTION
Windows-only workaround, not a Docker repair or Supabase command. Never stops
Docker, deletes files, changes settings, or touches images/volumes. Quit Docker
yourself before recovery. Do not launch Docker elsewhere while this runs.
#>
[CmdletBinding(SupportsShouldProcess)]
param([ValidateRange(10, 120)][int]$TimeoutSeconds = 60)

function Assert-RddPlainDirectory {
    param([Parameter(Mandatory)][string]$Path)
    # Check every ancestor, not just the leaf: a junction must not redirect a move.
    $full = [IO.Path]::GetFullPath($Path)
    $current = [IO.Path]::GetPathRoot($full)
    foreach ($part in $full.Substring($current.Length).Split([IO.Path]::DirectorySeparatorChar)) {
        if (-not $part) { continue }
        $current = Join-Path $current $part
        $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Not an ordinary directory (recovery refused): $current"
        }
    }
}

function Get-RddSocketPlan {
    param([Parameter(Mandatory)][string]$LocalRoot)
    Assert-RddPlainDirectory $LocalRoot
    $definitions = @(
        @{ Relative = 'Docker\run'; Names = @('dockerEthernetVfkit', 'dockerInference', 'sailor-ingest.sock', 'userAnalyticsOtlpHttp.sock') },
        @{ Relative = 'docker-secrets-engine'; Names = @('engine.sock') }
    )
    $suffix = '.rdd-stale-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N')
    foreach ($definition in $definitions) {
        $source = [IO.Path]::GetFullPath((Join-Path $LocalRoot $definition.Relative))
        $parent = Split-Path -Parent $source
        try { $null = Get-Item -LiteralPath $parent -Force -ErrorAction Stop }
        catch [System.Management.Automation.ItemNotFoundException] { continue }
        Assert-RddPlainDirectory $parent
        # Missing folders need no cleanup. Access errors are not treated as absence.
        try { $null = Get-Item -LiteralPath $source -Force -ErrorAction Stop }
        catch [System.Management.Automation.ItemNotFoundException] { continue }
        Assert-RddPlainDirectory $source
        $entries = @(Get-ChildItem -LiteralPath $source -Force -ErrorAction Stop)
        foreach ($entry in $entries) {
            if ($entry.PSIsContainer -or $entry.Name -cnotin $definition.Names -or
                $entry.Length -ne 0 -or -not ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
                ($entry.PSObject.Properties['LinkType'] -and $entry.LinkType)) {
                throw "Unexpected entry; recovery refused without deleting it: $($entry.FullName)"
            }
        }
        if ($entries.Count -eq 0) { continue }
        $destination = $source + $suffix
        if (Test-Path -LiteralPath $destination -ErrorAction Stop) { throw "Backup already exists: $destination" }
        [pscustomobject]@{ Source = $source; Destination = $destination }
    }
}

function Test-RddDockerProcesses {
    # Fail closed even for another user's Docker process or an unreadable exe path.
    $active = @(Get-Process -ErrorAction Stop | Where-Object {
        $_.ProcessName -in @('Docker Desktop', 'com.docker.backend')
    })
    return ($active.Count -gt 0)
}

function Test-RddDockerHealthy {
    param([Parameter(Mandatory)][string]$DockerExe)
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $DockerExe
    # Explicit local pipe: never probe a user's remote context or DOCKER_HOST.
    $info.Arguments = '--host npipe:////./pipe/dockerDesktopLinuxEngine info --format={{.OSType}}'
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($name in @('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_TLS')) {
        $info.EnvironmentVariables.Remove($name)
    }
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        $null = $process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(3000)) {
            # Only our read-only CLI probe is stopped, never Desktop or its backend.
            $process.Kill()
            $process.WaitForExit()
            return $false
        }
        return ($process.ExitCode -eq 0 -and $stdout.Result.Trim() -eq 'linux')
    }
    finally { $process.Dispose() }
}

function Start-RddDockerRecovery {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$LocalRoot, [int]$WaitSeconds = 60)
    $ErrorActionPreference = 'Stop'
    $install = Join-Path $LocalRoot 'Programs\DockerDesktop'
    Assert-RddPlainDirectory $install
    $desktop = Join-Path $install 'Docker Desktop.exe'
    $docker = Join-Path $install 'resources\bin\docker.exe'
    foreach ($exe in @($desktop, $docker)) {
        Assert-RddPlainDirectory (Split-Path -Parent $exe)
        $item = Get-Item -LiteralPath $exe -Force -ErrorAction Stop
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Unexpected executable: $exe"
        }
    }
    if (Test-RddDockerHealthy $docker) { Write-Output 'Docker is already healthy; nothing changed.'; return }
    if (Test-RddDockerProcesses) {
        throw 'Docker is running or starting but not healthy. Quit Docker Desktop, wait for it to exit, then retry. No recovery performed.'
    }
    # Materialize the whole plan: a bad second directory must block the first move.
    $plan = @(Get-RddSocketPlan $LocalRoot)
    foreach ($move in $plan) { Write-Output "Planned preservation: $($move.Source) -> $($move.Destination)" }
    if (-not $PSCmdlet.ShouldProcess('Local Docker Desktop runtime sockets', 'Preserve verified socket folders and start Docker')) { return }
    foreach ($move in $plan) {
        if (Test-RddDockerProcesses) { throw 'Docker appeared during recovery; stopped. Any previously reported backups are preserved.' }
        # Reinspect contents/ancestors immediately before each same-parent rename.
        $fresh = @(Get-RddSocketPlan $LocalRoot)
        if ($move.Source -notin $fresh.Source) { throw 'Runtime contents changed during recovery; stopped.' }
        Rename-Item -LiteralPath $move.Source -NewName ([IO.Path]::GetFileName($move.Destination)) -ErrorAction Stop
        Write-Output "Preserved runtime sockets: $($move.Destination)"
    }
    if (Test-RddDockerProcesses) { throw 'Docker appeared before launch; stopped. Rerun once it is healthy or fully closed.' }
    Start-Process -FilePath $desktop -WindowStyle Hidden -ErrorAction Stop
    $timer = [Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt $WaitSeconds) {
        if (Test-RddDockerHealthy $docker) { Write-Output 'Docker Linux engine is ready.'; return }
        Start-Sleep -Milliseconds 1000
    }
    throw 'Docker did not become healthy within the startup window. Inspect its popup/logs; no reset, forced shutdown, or automatic retry was performed.'
}

if ($MyInvocation.InvocationName -ne '.') {
    $ErrorActionPreference = 'Stop'
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This launcher is Windows-only.' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $mutex = New-Object Threading.Mutex($false, "Local\RDD-Docker-Recovery-$sid")
    $locked = $false
    try {
        try { $locked = $mutex.WaitOne(0) }
        catch [Threading.AbandonedMutexException] { $locked = $true }
        if (-not $locked) { throw 'Another RDD recovery launcher is active. Wait for it to finish.' }
        Start-RddDockerRecovery -LocalRoot ([Environment]::GetFolderPath('LocalApplicationData')) -WaitSeconds $TimeoutSeconds -WhatIf:$WhatIfPreference
    }
    finally {
        if ($locked) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}
