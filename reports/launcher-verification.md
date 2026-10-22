# Windows launcher verification — 2026-10-21

## Exact paths

Repository and shortcut working directory: `C:\Users\tejsa\OneDrive\Desktop\astra-project\portfolio`.

Installed using the active user's `[Environment]::GetFolderPath('Desktop')`:

- `C:\Users\tejsa\OneDrive\Desktop\TS nextstep — Start All.lnk`
- `C:\Users\tejsa\OneDrive\Desktop\TS nextstep — Portfolio.lnk`
- `C:\Users\tejsa\OneDrive\Desktop\TS nextstep — Resource Studio.lnk`
- `C:\Users\tejsa\OneDrive\Desktop\TS nextstep — Stop All.lnk`

All four target `C:\Windows\System32\wscript.exe`, invoking `C:\Users\tejsa\OneDrive\Desktop\astra-project\portfolio\tools\windows\launch-local.vbs` with their mode and `C:\Program Files\nodejs\node.exe`. The VBS wrapper runs `tools\windows\launch-local.ps1` hidden. Native shell icons, arguments, working directory and window style were read back through COM and verified.

Paths below are relative to the repository:

- Launcher: `tools/local-dev.mjs`; helpers: `tools/launcher-common.mjs`, `tools/launcher-worker.mjs`.
- Installer: `tools/windows/install-shortcuts.ps1`.
- Runtime state: `.resource-studio/local-services.json` (ignored, ephemeral; do not publish its contents).
- Logs: `logs/local-dev/worker.log`, `logs/local-dev/desktop.log`.
- Separate Vite caches: `node_modules/.vite-launcher/studio`, `node_modules/.vite-launcher/portfolio`.

## Tests and final state

Run from the repository with Node **v24.15.0**, Windows PowerShell **5.1**:

```powershell
node --test scripts/test-launcher-unit.mjs
node scripts/test-local-launcher.mjs
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tools/windows/install-shortcuts.ps1
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tools/windows/install-shortcuts.ps1 -VerifyOnly
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/test-launcher-shortcuts.ps1
```

All passed on the final implementation. The installer was also rerun successfully. Integration tests require the three service ports to be free and finish with services stopped.

- Total HTTP deadlines cover hung headers and unfinished bodies; response-size limits, redirect refusal and mutex exclusion passed.
- Convincing title/session impostors on **4175**, **4174** and **5173** were rejected and survived. A post-preflight bind conflict rolled back only the partial worker.
- Interrupted startup before IPC handoff closed all owned servers gracefully, including Vite's initial optimization work.
- Concurrent starts, repeated starts, both `open` modes and an unrelated working directory reused authenticated worker **PID 4868**. All three actual loopback listeners belonged to that PID.
- HTML, entry modules and optimized React browser modules returned successfully. Both Vite servers rejected private launcher-state URLs. Bridge origin/token enforcement and control authentication/replay protection passed.
- Wrong control identity and an unrelated live PID were preserved. Graceful stop released all ports; an unrelated HTTP process remained alive. Repeated stop, dead-state recovery and restart passed.
- Missing dependencies and missing Node produced actionable, nonzero failures. The missing-dependency repository path contained spaces.
- Saved shortcut targets were exercised through WScript → hidden PowerShell → Node with `--no-open`: Start All twice, Portfolio and Resource Studio reused **PID 22004**; Stop All shut it down gracefully. Browser-window presentation was not visually inspected.
- Final process/port inspection: **no launcher worker, WScript or esbuild processes remained; zero listeners on 4175/4174/5173; launcher state absent**. Preexisting unrelated Node processes remained running.
- JavaScript syntax checks passed. Application-wide build/lint tests were not run as part of this launcher verification.

## Recovery and reproducibility

- Routine use: double-click the installed shortcuts. Start All opens Studio and portfolio after readiness; individual page shortcuts start/reuse the complete environment and open only their page.
- Reinstall after moving the repository or Node: run `tools/windows/install-shortcuts.ps1` using the command above. It resolves the current user's Desktop and first available absolute `node.exe` path.
- CLI equivalents: `node tools/local-dev.mjs start`, `node tools/local-dev.mjs open portfolio`, `node tools/local-dev.mjs open studio`, `node tools/local-dev.mjs stop`. Each accepts `--no-open`.
- Port conflict: inspect `Get-NetTCPConnection -State Listen` and the listener's process identity. Close it through its own application if appropriate, then retry. Unverified services, including independently started Vite/bridge processes, are not adopted or terminated.
- Dependency failure: run `npm ci` in the exact repository above, then retry. A supported Node release is required (20.19+ on Node 20, or 22.12+).
- Unauthenticated/live or malformed state: inspect the recorded process and logs first. Stop the actual owner through its own control if necessary; move the stale state file aside only after confirming it does not represent a running launcher. Dead authenticated-format state recovers automatically on Start All. Legacy preliminary state is never authority to terminate a PID.
- Shutdown timeout: let active bridge work complete and retry Stop All. The launcher retains control/state while shutdown is pending; it never falls back to forced process-tree termination.
- Windows Script Host, PowerShell and the registered default browser must be available.
  Browser-opening calls were deliberately suppressed during automated lifecycle tests.

## Re-verification — 2026-10-22

The shortcut and launcher suites were re-run end to end after the motion/glass pass,
with the environment stopped first so the ports were free. Windows PowerShell 5.1,
Node v24.15.0, run from the repository root:

```powershell
cmd.exe /c "node tools\local-dev.mjs stop"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "scripts\test-launcher-shortcuts.ps1"
cmd.exe /c "node scripts\test-local-launcher.mjs"
cmd.exe /c "node --test scripts\test-launcher-unit.mjs"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "tools\windows\install-shortcuts.ps1"
```

| Command | Exit | Result |
| --- | ---: | --- |
| `local-dev.mjs stop` | 0 | Stopped worker PID 18876 and its services gracefully |
| `install-shortcuts.ps1 -VerifyOnly` (invoked by the test) | 0 | All four `.lnk` targets read back through COM: `wscript.exe` → `launch-local.vbs` with mode + absolute `C:\Program Files\nodejs\node.exe`, correct icons, working directory and hidden window style |
| `test-launcher-shortcuts.ps1` | 0 | 3× PASS — see below |
| `test-local-launcher.mjs` | 0 | 11× PASS, final state all services stopped |
| `test-launcher-unit.mjs` | 0 | 2/2 pass in 482ms |

Shortcut lifecycle passes:

- `PASS saved shortcut targets: repeated Start All, Portfolio and Resource Studio reused PID 16188 from an unrelated working directory.`
- `PASS saved Stop All target: graceful shutdown completed; no launcher services remain.`
- `PASS missing Node: wrapper returned an actionable error instead of silently exiting.`

Launcher integration passes (worker PID 13384 during the run; concurrent/repeated
starts reused PID 21452): strict-port impostor rejection, post-preflight bind-race
rollback, pre-handoff IPC loss cleanup, React/bridge asset and auth checks, wrong
control identity refusal, graceful stop with an unrelated process preserved,
stale/ded-state recovery, missing-dependency failure with spaces in the path, and
`final state: all launcher services stopped and test fixtures closed`.

Services were restarted with `node tools\local-dev.mjs start --no-open` afterwards so
the developer environment is left as it was found (bridge 4175, Studio 4174,
portfolio 5173).

`package.json` gained two convenience scripts this pass — `test:studio`
(`scripts/test-studio-live.mjs`) and `test:browser` (`scripts/test-browser.mjs`) — so
the four suites can be run as `npm run test:resources`, `test:bridge`, `test:studio`,
`test:browser`. Nothing else in the manifest changed. The two new suites have opposite
port requirements: `test:studio` drives the running Studio/bridge and fails with
`ECONNREFUSED` when the launcher is stopped, while `test:browser` binds 4174 itself and
fails with `EADDRINUSE` when the launcher is running — start, `test:studio`, stop,
`test:browser`, start again.


## Re-verification 2 — 2026-10-22 (after the liquid-glass pass)

Same suites re-run again end to end after Pass 3, this time with one environment quirk:
WSL → Windows `127.0.0.1` forwarding was unavailable in the session (Linux node got
`ECONNREFUSED` on 4174/4175/5173 while a Windows-side probe answered 200/403), so every
service-touching suite below was executed through Windows node (`cmd.exe /c`). Ports
were free for the shortcut suites (`test:browser` leaves everything stopped).

| Command | Exit | Result |
| --- | ---: | --- |
| `local-dev.mjs stop` | 0 | `Stopped launcher worker PID 16108 and its services gracefully.` |
| `scripts\test-launcher-shortcuts.ps1` | 0 | 3× PASS — shortcut reuse kept worker PID **13624** from an unrelated working directory; Stop All graceful (`no launcher services remain`); missing-Node wrapper returned its actionable install message |
| `scripts\test-local-launcher.mjs` | 0 | All 11 checks PASS — worker PID **14180** during the lifecycle phase, concurrent/repeated `Start All` reused PID **1568**, both open modes, strict-port impostor rejection, bind-race rollback, IPC-loss cleanup, bridge asset/auth checks, wrong-identity refusal, graceful stop with unrelated process preserved, stale/dead-state recovery, missing-dependency error with spaces in the path; `final state: all launcher services stopped and test fixtures closed` |
| `scripts\test-launcher-unit.mjs` | 0 | 2/2 pass in 407ms |
| `install-shortcuts.ps1 -VerifyOnly` | 0 | All four `.lnk` targets read back: `wscript.exe` → `launch-local.vbs` + mode + absolute `C:\Program Files\nodejs\node.exe` |

Follow-up functional suites in the same window: `npm run test:studio` **9/9** (real repo,
byte-identical catalog restore), `npm run test:browser` **13/13** (isolated fixture),
`npm run verify` green (build `dist/index.html` 486.17 kB + privacy check), and the new
`npm run test:pointer` **9/9** (needs the launcher running — portfolio on 5173).

`package.json` gained one more script this pass: `test:pointer`
(`scripts/test-pointer-light.mjs`). Final state: services **running** again
(bridge 4175, Studio 4174, portfolio 5173) so the developer environment matches how it
was found. Port ordering is unchanged: services up → `test:studio` / `test:pointer` →
stop → `test:browser` / shortcut suites → start.

## Startup shortcut — user-approved, opt-in (2026-10-22)

Created only after explicit approval (master prompt §12 forbids silent installs).
`tools/windows/install-shortcuts.ps1` gained two switches: `-Startup` creates exactly one
plain `.lnk` in the current user's Startup folder; `-RemoveStartup` deletes it;
`-VerifyOnly -Startup` reads it back and throws on any mismatch. No installer, no
registry key, no scheduled task, no elevation, nothing system-wide.

| | |
| --- | --- |
| Path | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\TS nextstep — Start All at sign-in.lnk` |
| Target | `C:\Windows\System32\wscript.exe` |
| Arguments | `//B //Nologo "<repo>\tools\windows\launch-local.vbs" start "C:\Program Files\nodejs\node.exe" --no-open` |
| Behaviour | quiet launch of bridge 4175, Studio 4174, portfolio 5173 — no windows opened at sign-in |
| Working dir / window / icon | repository root · hidden (style 7) · `shell32.dll,137` (same as desktop Start All) |

Verification performed: `-Startup` created the link and printed its readback;
`-VerifyOnly -Startup` re-validated every field; an end-to-end ShellExecute of the actual
`.lnk` (the same launch path sign-in uses) brought all three ports up within a 60s poll
window — that run also left the developer environment started for the final suites. The
pre-existing `Ollama.lnk` in the Startup folder was left untouched.

**Disable:** `powershell -File tools\windows\install-shortcuts.ps1 -RemoveStartup` (or
delete the `.lnk` from `shell:startup`). Re-enable with `-Startup`. Uninstalling
Node.js or moving the repository will make the wrapper fail loudly with its install
message rather than silently doing nothing.
