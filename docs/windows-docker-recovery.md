# Windows Docker Desktop recovery

This is an opt-in workaround for a Windows host startup issue, not a Docker
patch, a dependency-modernization package, or a Supabase migration. It supports
the current user's ordinary, non-redirected per-user installation under
`%LOCALAPPDATA%\Programs\DockerDesktop`. All-users/custom installations are
not supported. Requires Windows PowerShell 5.1 or PowerShell 7.

## Use

From the repository:

```powershell
npm run docker:check  # Preview only; no launch or folder changes
npm run docker:start  # Recover if fully stopped, then wait for the local engine
```

Alternatively, without Node/npm:

```powershell
powershell.exe -NoProfile -File .\scripts\windows\Start-DockerDesktop.ps1
```

If Docker is healthy, the launcher does nothing. If Docker is starting or its
processes remain after a crash, it refuses to touch runtime folders. Use
**Quit Docker Desktop**, wait for the processes to exit, then run the launcher.
It never forces Docker to stop, since doing so could interrupt other projects.
Do not concurrently open Docker from another shortcut while recovery runs.

Use this command to reopen Docker when the stale-socket issue recurs; the
stock Restart command and Start-menu shortcut do not invoke this workaround.
No autostart hook, scheduled task, shortcut replacement, or registry edit is
installed. Do not reset Docker to factory defaults to use this procedure.

## Safety boundaries

- Health checks use the explicit local Docker Desktop Linux named pipe, not a
  remote Docker context or `DOCKER_HOST`.
- Recovery refuses redirected directory ancestors and unexpected directory
  contents. The only eligible locations are `Docker\run` and
  `docker-secrets-engine` beneath the current user's local application data.
- Only known names that are zero-byte, non-directory socket reparse entries
  qualify. Ordinary files, recognized symbolic links, and unknown names stop
  recovery. A change in Docker's layout requires review, not a broader cleanup.
- Both directories are validated before any rename. They are reinspected and
  Docker's process state is checked before each same-parent rename.
- A per-user mutex excludes another copy of this launcher. It cannot lock out
  Docker launched independently, so the checks minimize but do not eliminate
  external startup races.
- Qualifying nonempty folders are renamed to adjacent `.rdd-stale-<time>-<id>`
  backups. No files, images, containers, volumes, settings, or credentials are
  deleted. The launcher never reads `.env` files or starts Supabase.
- Backups are not automatically pruned. They accumulate across recoveries;
  inspect them separately before any cleanup. On partial failure, the output
  identifies completed moves; nothing is silently deleted or rolled back.
- Startup has a bounded wait (default 60 seconds). A timeout is a failure, not
  readiness, and does not kill the backend or retry automatically.

## Evidence and limitations

Observed 2026-09-07 on Windows, WSL 2.7.12, per-user Docker Desktop 4.90.0
(238679), Linux engine 29.7.2:

- The stock launcher could not rename the inaccessible socket to `.stale`,
  including after a graceful shutdown with no running containers.
- The guarded launcher's healthy-engine no-op, dry run, stopped-engine socket
  preservation, engine startup, and `hello-world` container test passed.
- Docker's supported disk-location setting subsequently moved WSL storage to
  `F:\DockerDesktop\DockerDesktopWSL`. Its settings-driven engine restart and
  a no-pull `hello-world` test passed after relocation. This is not a full
  Desktop quit/relaunch test and does not retire the socket workaround. The
  launcher does not depend on the WSL data-disk location.
- This is local-only evidence. Hosted Supabase schema, policies, authentication,
  migrations, and the full local Supabase stack remain unverified by this test.
- Docker's [4.90.0 release notes](https://docs.docker.com/desktop/release-notes/#4900)
  describe a stale-socket fix, but the published claim did not establish that
  this host's failure was fixed. Retest the stock launch after later updates;
  retire this workaround when it is no longer necessary.

## Safety tests

The Windows host already provides Pester 3.4.0. No new package was installed.
Run the separate host-tool tests in **Windows PowerShell 5.1** (`powershell.exe`,
not `pwsh`): the harmless executable fixture uses its .NET Framework compiler.
The launcher itself also supports PowerShell 7. Tests mock Docker execution and
use temporary fixtures, so they do not operate the real engine:

```powershell
Import-Module Pester -RequiredVersion 3.4.0
$result = Invoke-Pester -Script .\scripts\windows\Start-DockerDesktop.Tests.ps1 -PassThru
if ($result.FailedCount -gt 0) { throw 'Docker launcher safety tests failed' }
```

These tests are separate from the application's Vitest suite and are not
automatically executed by its Linux CI job. Do not silently treat them as a
CI pass. Repeat the real stop/recover/container test after launcher changes,
only after confirming that no containers are running.
