# Uses the existing Windows Pester 3.4 framework; no Docker processes are launched.
. "$PSScriptRoot\Start-DockerDesktop.ps1"

Describe 'Docker health probe isolation' {
    # Compile a standalone .NET Framework fixture with Windows PowerShell 5.1.
    # It records only synthetic test inputs, never invokes Docker or uses a network.
    $script:probeExe = Join-Path $TestDrive 'Harmless probe fixture.exe'
    Add-Type -OutputAssembly $probeExe -OutputType ConsoleApplication -TypeDefinition @'
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
public static class RddHarmlessProbeFixture {
    public static int Main(string[] args) {
        using (var receipt = new StreamWriter(Environment.GetEnvironmentVariable("RDD_PROBE_TEST_RECEIPT"))) {
            receipt.WriteLine(Process.GetCurrentProcess().Id);
            foreach (var arg in args) receipt.WriteLine(arg);
            foreach (var name in new[] { "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH", "DOCKER_TLS" })
                receipt.WriteLine(name + "=" + (Environment.GetEnvironmentVariable(name) ?? "<absent>"));
            receipt.WriteLine("sentinel=" + Environment.GetEnvironmentVariable("RDD_PROBE_TEST_SENTINEL"));
        }
        var mode = Environment.GetEnvironmentVariable("RDD_PROBE_TEST_MODE");
        if (mode == "timeout") Thread.Sleep(10000); // Self-exits even if probe cleanup regresses.
        if (mode == "stderr") Console.Error.Write(new string('x', 262144));
        Console.WriteLine(mode == "windows" ? "windows" : "linux");
        return mode == "failure" ? 17 : 0;
    }
}
'@

    BeforeEach {
        $script:probeReceipt = Join-Path $TestDrive ([guid]::NewGuid().ToString('N') + '.txt')
        $script:probeEnvironment = @{
            DOCKER_HOST = 'tcp://rdd-probe.invalid:2376'
            DOCKER_CONTEXT = 'rdd-synthetic-remote-context'
            DOCKER_TLS_VERIFY = '1'
            DOCKER_CERT_PATH = 'C:\rdd-synthetic-certs'
            DOCKER_TLS = '1'
            RDD_PROBE_TEST_RECEIPT = $probeReceipt
            RDD_PROBE_TEST_SENTINEL = 'keep-unrelated-environment'
            RDD_PROBE_TEST_MODE = 'healthy'
        }
        $script:savedProbeEnvironment = @{}
        foreach ($name in $probeEnvironment.Keys) {
            $savedProbeEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
            [Environment]::SetEnvironmentVariable($name, $probeEnvironment[$name], 'Process')
        }
    }

    AfterEach {
        try {
            # Cleanup only this executable, if a failed timeout assertion left it alive.
            if (Test-Path -LiteralPath $probeReceipt) {
                $fixturePid = [int](Get-Content -LiteralPath $probeReceipt -TotalCount 1)
                $fixtureProcess = $null
                try { $fixtureProcess = [Diagnostics.Process]::GetProcessById($fixturePid) }
                catch [ArgumentException] { } # Already exited, as expected.
                if ($null -ne $fixtureProcess) {
                    try {
                        if (-not $fixtureProcess.HasExited -and $fixtureProcess.MainModule.FileName -eq $probeExe) {
                            $fixtureProcess.Kill()
                            $null = $fixtureProcess.WaitForExit(3000)
                        }
                    }
                    finally { $fixtureProcess.Dispose() }
                }
            }
        }
        finally {
            foreach ($name in $savedProbeEnvironment.Keys) {
                [Environment]::SetEnvironmentVariable($name, $savedProbeEnvironment[$name], 'Process')
            }
        }
    }

    It 'passes the explicit local Linux pipe and info query to the executable' {
        Test-RddDockerHealthy $probeExe | Should Be $true
        $receipt = @(Get-Content -LiteralPath $probeReceipt)
        ($receipt[1..4] -join '|') | Should Be '--host|npipe:////./pipe/dockerDesktopLinuxEngine|info|--format={{.OSType}}'
        $receipt.Count | Should Be 11
    }

    It 'removes remote and TLS overrides only from the child environment' {
        Test-RddDockerHealthy $probeExe | Should Be $true
        $receipt = @(Get-Content -LiteralPath $probeReceipt)
        foreach ($name in @('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_TLS')) {
            ($receipt -contains ($name + '=<absent>')) | Should Be $true
            [Environment]::GetEnvironmentVariable($name, 'Process') | Should Be $probeEnvironment[$name]
        }
        $receipt[10] | Should Be 'sentinel=keep-unrelated-environment'
    }

    It 'rejects a failed CLI exit even when stdout says linux' {
        [Environment]::SetEnvironmentVariable('RDD_PROBE_TEST_MODE', 'failure', 'Process')
        Test-RddDockerHealthy $probeExe | Should Be $false
    }

    It 'rejects a successful response for Windows containers' {
        [Environment]::SetEnvironmentVariable('RDD_PROBE_TEST_MODE', 'windows', 'Process')
        Test-RddDockerHealthy $probeExe | Should Be $false
    }

    It 'drains stderr without blocking a healthy probe' {
        [Environment]::SetEnvironmentVariable('RDD_PROBE_TEST_MODE', 'stderr', 'Process')
        Test-RddDockerHealthy $probeExe | Should Be $true
    }

    It 'times out and terminates its own unresponsive probe' {
        [Environment]::SetEnvironmentVariable('RDD_PROBE_TEST_MODE', 'timeout', 'Process')
        $timer = [Diagnostics.Stopwatch]::StartNew()
        Test-RddDockerHealthy $probeExe | Should Be $false
        $timer.Stop()
        # Allow scheduler overhead while distinguishing the fixture's 10-second exit.
        ($timer.Elapsed.TotalSeconds -ge 2.5) | Should Be $true
        ($timer.Elapsed.TotalSeconds -lt 8) | Should Be $true
        $fixturePid = [int](Get-Content -LiteralPath $probeReceipt -TotalCount 1)
        $fixtureProcess = $null
        try { $fixtureProcess = [Diagnostics.Process]::GetProcessById($fixturePid) }
        catch [ArgumentException] { }
        if ($null -ne $fixtureProcess) {
            try { $fixtureProcess.HasExited | Should Be $true }
            finally { $fixtureProcess.Dispose() }
        }
    }
}

Describe 'Docker process discovery' {
    BeforeEach {
        # Never enumerate this host's real processes in this group.
        Mock Get-Process { @() }
    }

    It 'reports no Docker processes for an empty inventory' {
        Test-RddDockerProcesses | Should Be $false
    }

    It 'ignores unrelated processes and the CLI alone' {
        Mock Get-Process {
            foreach ($name in @('explorer', 'docker', 'Docker Desktop Helper', 'com.docker.backend-other')) {
                [pscustomobject]@{ ProcessName = $name }
            }
        }
        Test-RddDockerProcesses | Should Be $false
    }

    It 'detects Desktop without a backend' {
        Mock Get-Process { [pscustomobject]@{ ProcessName = 'Docker Desktop' } }
        Test-RddDockerProcesses | Should Be $true
    }

    It 'detects the backend without Desktop' {
        Mock Get-Process { [pscustomobject]@{ ProcessName = 'com.docker.backend' } }
        Test-RddDockerProcesses | Should Be $true
    }

    It 'does not require access to executable paths or process owners' {
        Mock Get-Process {
            $foreignProcess = [pscustomobject]@{ ProcessName = 'com.docker.backend' }
            $foreignProcess | Add-Member -MemberType ScriptProperty -Name Path -Value { throw 'Path access denied' }
            $foreignProcess | Add-Member -MemberType ScriptMethod -Name GetOwner -Value { throw 'Owner access denied' }
            $foreignProcess
        }
        Test-RddDockerProcesses | Should Be $true
    }

    It 'fails closed when process enumeration fails' {
        Mock Get-Process { throw 'Process enumeration denied' }
        { Test-RddDockerProcesses } | Should Throw 'Process enumeration denied'
        # Pester 3 exposes common parameters through PSBoundParameters, not locals.
        Assert-MockCalled Get-Process -Times 1 -Exactly -Scope It -ParameterFilter { $PSBoundParameters['ErrorAction'] -eq 'Stop' }
    }
}

Describe 'Docker socket recovery preflight' {
    BeforeEach {
        $script:localRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path (Join-Path $localRoot 'Docker\run') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $localRoot 'docker-secrets-engine') -Force | Out-Null
        Mock Get-ChildItem {
            foreach ($child in [IO.Directory]::EnumerateFileSystemEntries($LiteralPath)) {
                Get-Item -LiteralPath $child -Force -ErrorAction Stop
            }
        }
    }

    It 'leaves empty directories alone' {
        @(Get-RddSocketPlan $localRoot).Count | Should Be 0
    }

    It 'leaves absent directories alone' {
        $emptyRoot = Join-Path $TestDrive 'empty'
        New-Item -ItemType Directory -Path $emptyRoot -Force | Out-Null
        @(Get-RddSocketPlan $emptyRoot).Count | Should Be 0
    }

    It 'plans same-parent unique backups for known zero-byte socket reparse points' {
        Mock Get-ChildItem {
            if ($LiteralPath.EndsWith('Docker\run')) {
                [pscustomobject]@{ Name='sailor-ingest.sock'; Length=0; Attributes=[IO.FileAttributes]::ReparsePoint; PSIsContainer=$false; FullName="$LiteralPath\sailor-ingest.sock" }
            }
        }
        $first = @(Get-RddSocketPlan $localRoot)
        $second = @(Get-RddSocketPlan $localRoot)
        $first.Count | Should Be 1
        (Split-Path $first[0].Destination -Parent) | Should Be (Split-Path $first[0].Source -Parent)
        $first[0].Destination | Should Match '\.rdd-stale-'
        $first[0].Destination | Should Not Be $second[0].Destination
    }

    It 'refuses an ordinary file even if its name is a known socket' {
        New-Item -ItemType File -Path (Join-Path $localRoot 'Docker\run\sailor-ingest.sock') | Out-Null
        { @(Get-RddSocketPlan $localRoot) } | Should Throw 'Unexpected entry'
    }

    It 'refuses unknown files in the secrets-engine folder' {
        New-Item -ItemType File -Path (Join-Path $localRoot 'docker-secrets-engine\important.txt') | Out-Null
        { @(Get-RddSocketPlan $localRoot) } | Should Throw 'Unexpected entry'
    }

    It 'refuses nonempty socket entries' {
        Mock Get-ChildItem { [pscustomobject]@{ Name='sailor-ingest.sock'; Length=12; Attributes=[IO.FileAttributes]::ReparsePoint; PSIsContainer=$false; FullName='fixture' } }
        { @(Get-RddSocketPlan $localRoot) } | Should Throw 'Unexpected entry'
    }

    It 'refuses symbolic links masquerading as socket entries' {
        Mock Get-ChildItem { [pscustomobject]@{ Name='sailor-ingest.sock'; Length=0; Attributes=[IO.FileAttributes]::ReparsePoint; PSIsContainer=$false; FullName='fixture'; LinkType='SymbolicLink' } }
        { @(Get-RddSocketPlan $localRoot) } | Should Throw 'Unexpected entry'
    }

    It 'refuses directory entries' {
        New-Item -ItemType Directory -Path (Join-Path $localRoot 'Docker\run\sailor-ingest.sock') | Out-Null
        { @(Get-RddSocketPlan $localRoot) } | Should Throw 'Unexpected entry'
    }

    It 'refuses a redirected ancestor' {
        Mock Get-Item { [pscustomobject]@{ PSIsContainer=$true; Attributes=[IO.FileAttributes]::ReparsePoint } }
        { Assert-RddPlainDirectory $localRoot } | Should Throw 'Not an ordinary directory'
    }
}

Describe 'Docker recovery orchestration' {
    BeforeEach {
        $script:localRoot = Join-Path $TestDrive 'user'
        Mock Assert-RddPlainDirectory {}
        Mock Get-Item { [pscustomobject]@{ PSIsContainer=$false; Attributes=[IO.FileAttributes]::Normal } }
        Mock Test-RddDockerHealthy { $false }
        Mock Test-RddDockerProcesses { $false }
        Mock Get-RddSocketPlan { [pscustomobject]@{ Source='C:\fixture\Docker\run'; Destination='C:\fixture\Docker\run.rdd-stale-test' } }
        Mock Rename-Item {}
        Mock Start-Process {}
    }

    It 'is a no-op when Docker is already healthy' {
        Mock Test-RddDockerHealthy { $true }
        Start-RddDockerRecovery $localRoot
        Assert-MockCalled Get-RddSocketPlan -Times 0 -Exactly
        Assert-MockCalled Rename-Item -Times 0 -Exactly
        Assert-MockCalled Start-Process -Times 0 -Exactly
    }

    It 'refuses recovery while Docker is running or starting' {
        Mock Test-RddDockerProcesses { $true }
        { Start-RddDockerRecovery $localRoot } | Should Throw 'Quit Docker Desktop'
        Assert-MockCalled Rename-Item -Times 0 -Exactly
        Assert-MockCalled Start-Process -Times 0 -Exactly
    }

    It 'validates the entire plan before the first rename' {
        Mock Get-RddSocketPlan {
            [pscustomobject]@{ Source='C:\fixture\Docker\run'; Destination='C:\fixture\Docker\run.rdd-stale-test' }
            throw 'Unexpected second folder'
        }
        { Start-RddDockerRecovery $localRoot } | Should Throw 'Unexpected second folder'
        Assert-MockCalled Rename-Item -Times 0 -Exactly
        Assert-MockCalled Start-Process -Times 0 -Exactly
    }

    It 'does not rename or launch with WhatIf' {
        Start-RddDockerRecovery $localRoot -WhatIf
        Assert-MockCalled Rename-Item -Times 0 -Exactly
        Assert-MockCalled Start-Process -Times 0 -Exactly
    }

    It 'stops if Docker appears after preflight' {
        $script:processChecks = 0
        Mock Test-RddDockerProcesses { $script:processChecks++; return ($script:processChecks -gt 1) }
        { Start-RddDockerRecovery $localRoot } | Should Throw 'Docker appeared'
        Assert-MockCalled Rename-Item -Times 0 -Exactly
        Assert-MockCalled Start-Process -Times 0 -Exactly
    }

    It 'does not launch when preservation fails' {
        Mock Rename-Item { throw 'rename denied' }
        { Start-RddDockerRecovery $localRoot } | Should Throw 'rename denied'
        Assert-MockCalled Start-Process -Times 0 -Exactly
    }

    It 'preserves once and waits for a healthy engine' {
        $script:healthChecks = 0
        Mock Test-RddDockerHealthy { $script:healthChecks++; return ($script:healthChecks -gt 1) }
        Start-RddDockerRecovery $localRoot
        Assert-MockCalled Rename-Item -Times 1 -Exactly -Scope It
        Assert-MockCalled Start-Process -Times 1 -Exactly -Scope It
    }

    It 'reports startup failure without retrying or claiming readiness' {
        { Start-RddDockerRecovery $localRoot -WaitSeconds 0 } | Should Throw 'did not become healthy'
        Assert-MockCalled Start-Process -Times 1 -Exactly -Scope It
    }
}
