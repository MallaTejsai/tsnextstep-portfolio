# Browser pipeline QA

From the repository root, after the parent has installed `playwright`:

```powershell
node scripts/test-browser.mjs --baseline
node scripts/test-browser.mjs
```

Both commands run the same assertions. `--baseline` labels an initial run; it
does not restore old application code or suppress failures. Run it before
applying application fixes when reproducing a regression is feasible.

The runner uses Node's built-in test runner and Playwright's browser API. It
tries Chromium's `msedge` channel, the standard Windows Edge executable, then
an already-installed Playwright Chromium. It does not install dependencies or
browser binaries. A missing Playwright import exits 2 with an explicit NOT RUN
message.

Ports **4174, 4175 and 5173 must all be free**. The runner refuses occupied
ports, uses strict Vite ports, and closes only server handles it created. Stop
your own launcher deliberately before invoking it. Every scenario has bounded
browser waits and a fresh browser context. All fixture services and contexts are
closed in `finally`, including after failed assertions.

## Isolation and outputs

- Copies source, public presentation assets, tools, package and Vite configs to
  a unique `portfolio-browser-*` directory directly under
  `C:\Users\tejsa\AppData\Local\Temp\agent-tmp`.
- Excludes canonical/generated resource catalogs **before copying**, the whole
  managed public resources directory, `.env*`, `.resource-studio`, backups and
  build outputs. Seeds synthetic public notes, a private prompt and an episode.
- Shares only dependencies using a temporary `node_modules` junction. Vite's
  runner config loader and explicit fixture caches avoid writing config bundles
  or optimizer caches through that junction. The junction is unlinked before
  fixture removal.
- Uses real fixture `startBridge`, Vite `createServer`, browser uploads and
  browser-origin commit POSTs. Public file bytes, authoring catalog, generated
  manifests, HMR/live updates, filters and reloaded UI are checked together.
- The production privacy case runs the copied validator and actual Vite build
  against the fixture, scans every output file for synthetic unpublished
  markers, and checks a published download is present.
- Only negative bridge-error cases intercept requests. All other successful
  commits use the actual bridge. External browser requests are blocked;
  contact messages and external episode navigation are never triggered.
- Screenshots, bounded build output and structured `report.json` are saved in
  ignored `.resource-studio/qa/<timestamp>-baseline|final/`. Failure screenshots
  are retained too. Screenshots are review smoke artifacts, not pixel-diff
  assertions. The fixture itself is removed.

Coverage includes fresh IndexedDB initialization, uploaded TXT draft/privacy,
metadata then publication, new format/category filters without manual reload,
reload persistence, stable identity on metadata edit, unpublish/build privacy,
prompt-text/file consistency, non-last deletion/reindex/trash, keyboard reorder,
invalid input, bridge rejection/network recovery, and 390/768/1440px overflow,
navigation/modal focus traps, Escape focus restoration and reduced motion.

The overlapping-save check delays the first real bridge request to expose
out-of-order saves, and verifies the latest edit survives a reload. It also
accepts an explicitly disabled Save button while a commit is pending.

For a dependency-independent harness check (not browser coverage), run
`node scripts/browser/test-fixture.mjs`. This verifies fixture isolation, both
Vite module transformations, bridge state and a fixture production build. It
has the same fixed-port requirements and cleanup.
