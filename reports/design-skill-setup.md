# Verified design-skill setup

Verified 2026-10-21, Windows PowerShell 5.1, Node v24.15.0.

## Outcome and provenance

All three instruction packages are installed as project-local copies in
`.agents/skills/`. [OpenCode officially discovers this directory](https://opencode.ai/docs/skills/).
The installer lists all three with scope `project` and agent `OpenCode`.
Each installed skill directory matched its cloned source with
`git -c core.autocrlf=false diff --no-index --exit-code` (three exit-0 comparisons).

| Repository / pinned README | Commit | Installed skill / source within repository |
| --- | --- | --- |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable/blob/dad8dbb3aac21ad1fa236c110315ef4abece23e8/README.md) | `dad8dbb3aac21ad1fa236c110315ef4abece23e8` | `impeccable` / `.agents/skills/impeccable` (compiled v4.7.0) |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/blob/6010f91a9935f1c167dfc500fb1a475681892e6b/README.md) | `6010f91a9935f1c167dfc500fb1a475681892e6b` | `design-taste-frontend` / `skills/taste-skill` |
| [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/README.md) | `f9a8a041b85185ee4881b3471d3415e939aac772` | `motion-design` / `skills/motion-design` |

Public HTTPS clones used `git -c credential.helper= clone --depth 1` under the
approved temporary parent after `Test-Path` returned `True`. Commit IDs came from
`git rev-parse HEAD`. Upstream licenses/notices are retained in `.agents/licenses/`.
The generated `skills-lock.json` was normalized from temporary local paths to the
verified GitHub commits and skill paths, preserving the installer's payload hashes;
its field shape was checked against `skills@1.7.4`'s `projectLockEntry` implementation.
Remote restore/update has not been tested.

**Activation:** quit and restart OpenCode, then ask it to load `impeccable`,
`design-taste-frontend`, or `motion-design`. This running session's registered skill
list does not include them; hot registration and post-restart activation are not
claimed. No slash-command wrapper was installed. Until restart, read the installed
`SKILL.md` and relevant references directly, and use the reviewed scripts below.

> **Update, 2026-10-22:** after a restart the running OpenCode session lists all three
> skills (`impeccable`, `design-taste-frontend`, `motion-design`) in its available
> skill registry, and all three were loaded and applied during the motion/glass pass.
> See [Session use and detector output](#session-use-and-detector-output-2026-10-22).


## Documented installation and actual commands

- **Impeccable:** README and actual `npx impeccable@4.7.0 install --help` confirm
  `--providers=opencode --scope=project --no-hooks`. Its native installer supports
  `.opencode/skills/`; the README also documents copying compiled provider skills.
  The advertised `dist/opencode/.opencode` path was absent in this checkout. The
  checked-in `.agents/skills/impeccable` compiled payload was present and was copied
  using the documented generic skill installer instead. Native installation was
  **not** run. Only `skills help` and `install --help` were executed for Impeccable.
- **Taste:** README documents `npx skills add https://github.com/Leonxlnx/taste-skill
  --skill "design-taste-frontend"`; its skill README also documents copying the folder.
- **Motion:** README documents `npx skills add LottieFiles/motion-design-skill`.
- The [skills CLI reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md)
  documents local paths, project-default scope, `--agent`, `--skill`, and `--copy`.
  [Its agent table](https://github.com/vercel-labs/skills/blob/main/docs/agents.md)
  maps OpenCode to project `.agents/skills/`. Actual `skills@1.7.4 --help` confirmed
  these options before installation.

Actual setup commands, from the workspace root (help ran in the temporary parent):

```powershell
$tmp = 'C:\Users\tejsa\AppData\Local\Temp\agent-tmp'
$env:npm_config_cache = "$tmp\design-skills-npm-cache"
$env:DISABLE_TELEMETRY = '1'
$env:DO_NOT_TRACK = '1'
$env:IMPECCABLE_HOME = "$tmp\design-impeccable-home"
npx --yes --ignore-scripts skills@1.7.4 --help
npx --yes --ignore-scripts impeccable@4.7.0 skills help
npx --yes --ignore-scripts impeccable@4.7.0 install --help
npx --yes --ignore-scripts skills@1.7.4 add "$tmp\design-verified-taste\skills\taste-skill" --skill design-taste-frontend --agent opencode --copy --yes --json
npx --yes --ignore-scripts skills@1.7.4 add "$tmp\design-verified-motion\skills\motion-design" --skill motion-design --agent opencode --copy --yes --json
npx --yes --ignore-scripts skills@1.7.4 add "$tmp\design-verified-impeccable\.agents\skills\impeccable" --skill impeccable --agent opencode --copy --yes --json
npx --yes --ignore-scripts skills@1.7.4 list --agent opencode --json
```

All installer/help/list commands exited 0. Installations used verified local clones,
not a moving remote branch. The reviewed Impeccable npm shim runs its engine for help;
its package/cache stayed under the temporary parent. No engine binary was installed
in the workspace. The copied Impeccable launchers can download an engine on first use;
their context/detect/live commands were not run. Motion is instructions/references,
not a Lottie runtime or a new tool. Taste's browser/asset scripts were copied as
upstream companions but not executed; execution review covered the complete
`draw.mjs` and `lint.mjs` sources. Draw's page path uses built-in Node modules and
local JSON; lint only reads source and prints diagnostics. No network/browser/server
is used by these two runs.

## Retrospective Taste draw

**The redesign was already implemented before this draw.** The earlier manual
workflow remains documented in [design-decisions.md](design-decisions.md). This is
a post-implementation direction comparison, not evidence that the generated sheet
guided those edits or that the full Taste workflow passed.

```powershell
$env:TASTE_SKILL_HISTORY = "$tmp\design-taste-history.json"
node .agents/skills/design-taste-frontend/scripts/draw.mjs --sector personal-portfolio --brief "Portrait-led developer fieldnotes for Tejas: real ALLI local AI architecture, four projects and learning resources; charcoal, off-white, crimson; Space Grotesk, Inter, JetBrains Mono; selective glass mandatory" --sections work,about,showcase,list,contact,footer --tone editorial --have photography --keep palette,type --seed 20261021 --out "$tmp\design-taste-draw" --options 3
```

| Actual option | Assessment |
| --- | --- |
| `contact-sheet` — The contact sheet | Needs many genuine frames; a thumbnail archive would dilute the existing portrait and full project explanations. |
| `name-as-monument` — The name as a monument | Oversized identity would compete with the portrait and first-screen developer explanation. |
| **`page-is-the-object` — The page is the object** | Closest to the developer-fieldnotes concept: portrait as the opening plate, real projects and architecture as readable entries. |

Then ran the same command with `--options 3` replaced by
`--direction page-is-the-object`. Both exited 0. **Seed: `20261021`; redraws: 0.**
The full sheet saved to `$tmp\design-taste-draw\direction.json`; history also stayed
in temporary storage. It explicitly kept type and palette. It dealt **Tabbed folder
stack** as hero, **Index with preview** as motion, and folder/letter/output-slip/menu/
coupon/card section blueprints. These literal layouts were **not implemented**.
Its suggested architectural stock photos were neither fetched nor used.

Chosen idea: **Tejas's portrait and the real ALLI local-stack development record
become a developer's fieldnotes, with project evidence beside the person building it.**
The existing selectable ALLI architecture is the live interaction, described in the
earlier implementation report; this follow-up did not browser-test it. Fieldnotes
is a compositional metaphor, not a claim that a physical notebook exists.

## Source lint: real output and exceptions

```powershell
node .agents/skills/design-taste-frontend/scripts/lint.mjs src index.html
node .agents/skills/design-taste-frontend/scripts/lint.mjs tools/resource-studio --app
```

| Scan | Files | FAIL | WARN | Exit |
| --- | ---: | ---: | ---: | ---: |
| Portfolio | 47 | **321** | **97** | 1 |
| Studio, app rules | 7 | **0** | **27** | 0 |

Portfolio FAIL categories: gradient **137**, shadow **102**, hairline **27**,
eyebrow **24**, numbering **11**, mono **11**, gradient-text **8**, emoji **1**.
WARN categories: outlined-box **67**, glass **22**, numbering **5**, default-font **1**,
h-screen **1**, em-dash **1**. Studio WARN: shadow **9**, eyebrow **8**, mono **6**,
glass **3**, numbering **1**. No findings were suppressed or relabelled in the scripts.

- **Required glass:** the 22/3 glass warnings are not grounds to remove the user's
  requested material. Review only the bounded blur, readable overlay contrast and
  opaque fallback. The scanner also matches `backdrop-filter: none` and `@supports`
  tests (e.g. `src/styles/v3.css:490,786`), so occurrences are not glass-panel counts.
  The neutral glass highlight at `v3.css:53` also triggers the gradient rule.
- **Required three fonts:** preserve Space Grotesk headings, Inter prose and
  JetBrains Mono technical labels. Mono/default-font findings conflict with these
  explicit choices. The source linter does **not** measure loaded font count; no
  three-font browser test is claimed.
- **Cascade limitations:** source lint scans older definitions as well as final
  overrides. `src/main.jsx:15` imports `v3.css` last; for example its earlier
  `.arch-node.is-active` gradient/shadow (`:409`) becomes flat/no-shadow at `:691`.
  It also flags declarations inside comments/resets. Counts cannot be converted to
  visible defects or a rendered pass without the parent browser review.
- **Remaining review items:** eyebrow labels (e.g. `src/components/About.jsx:34`),
  decorative indices (`src/data/alliArchitecture.js:15` onward), and non-exempt
  borders/shadows still need contextual judgment. `Contact.jsx:20` is a success
  checkmark, caught by the emoji range. Studio kicker warnings name working-panel
  labels. These were reported, not automatically treated as bugs or removed.
- **Motion constraints:** retain the existing 120ms press, 240–360ms transitions,
  500ms entrance budget, reduced motion and no ambient loops. Taste motion/image
  floors and Motion Design's ambient-layer defaults do not override the brief.

## Scope and verification boundary

This follow-up added only `.agents/skills/`, `.agents/licenses/`, `skills-lock.json`
and this report. It did not change app source, package manifests, existing agent or
OpenCode config, global settings, or create project `PRODUCT.md`/`DESIGN.md` files.
No browser, server, inspector, screenshots, Impeccable detector or application build
was run here. Parent browser regression retains ownership of its ports and rendered
verification. The supported local installation and completed draw/lint are verified;
runtime skill registration and visual acceptance require their separate checks.

Final local checks: exactly three discoverable `SKILL.md` files; no `.exe`, `.dll`
or `.node` files under `.agents/`; installer list succeeded after lock normalization;
report and lock whitespace checks passed (Git emitted only LF/CRLF notices).

## Session use and detector output (2026-10-22)

All three skills were registered in a restarted OpenCode session, loaded during the
work, and used as follows:

| Skill | How it was used |
| --- | --- |
| `impeccable` | Live detector runs against the running portfolio, plus `context`; findings were fixed where they were defects and declared where they were brief-mandated. |
| `design-taste-frontend` | Source lint re-run on `src` + `index.html` and on `tools/resource-studio --app`; the earlier `draw.mjs` direction sheet above still stands. |
| `motion-design` | Entrance/press budgets, easing, stagger choreography, reduced-motion fallbacks and ambient-layer construction for the restored hero, reveals, backdrop and ALLI scene. |

### Impeccable CLI — what it actually exposes

`impeccable --help` (compiled v4.7.0) lists exactly: `detect`, `ignores`, `help`,
`install`, `link`, `update`, `check`, `telemetry`. The `help` (skill catalogue) output
additionally lists harness slash commands such as `/audit`; **`audit` is not a CLI
subcommand** and invoking it is ignored. `context` and `live` are also available.

- `context` → `NO_PRODUCT_MD`, `BUILD_INIT_REQUIRED`, `SCOPED_EXISTING_ALLOWED`,
  `EXISTING_VISUAL_SYSTEM`, `RESOLVED_CONTEXT` (project root resolved, no
  `PRODUCT.md`/`DESIGN.md`). Narrow refinement may proceed on the incumbent code as
  design authority.
- `live` was **not** run: it creates `.impeccable/live/config.json`, starts a
  background live-variant server and injects a script tag, and expects
  `PRODUCT.md`/`DESIGN.md` plus an interactive poll loop. Rendered review was done
  with Playwright captures instead (`.resource-studio/qa/screens/`).
- `detect` accepts a file, directory or URL:

```powershell
cmd.exe /c ".agents\skills\impeccable\scripts\impeccable.cmd detect http://127.0.0.1:5173 --json"
```

| Run | Findings | Artifacts |
| --- | ---: | --- |
| First (mid-pass) | **40** | `.resource-studio/qa/impeccable-detect.json` |
| After fixes | **10** | `.resource-studio/qa/impeccable-detect-after.json` |
| After the liquid-glass pass | **10** (identical set) | `.resource-studio/qa/impeccable-detect-liquid.json` |
| After the draft unpublish (final) | **10** (identical set) | `.resource-studio/qa/impeccable-detect-final.json` |
| After the visual-impact pass | **11** (+1 warning: radial-spotlight-glow on the fixed backdrop orb, accepted for the brief) | `.resource-studio/qa/impeccable-detect-impact.json` |

The 40 broke down as: `undersized-ui-text` 17 warning + 8 advisory, `dark-glow` 3,
`wide-tracking` 3, `pulsing-dot` 2 warning + 1 **error**, `nested-cards` 2,
`tiny-text` 1, `overused-font` 1, `em-dash-overuse` 1, `codex-grid-background` 1.
Fixes applied: an 11px floor for functional micro-labels, `.system-caption` to 11px,
`.system-detail` converted from a nested card to an inset rule, and the status-dot
pulses suppressed (restoring `v3.css`'s static state — the *error* severity item). The
remaining 10 and their rationale are itemised in
[design-decisions.md](design-decisions.md). No ignore rule was added; `impeccable
ignores` was not used.

### Taste lint — re-run after the motion pass

| Scan | FAIL | WARN | Change since 2026-10-21 |
| --- | ---: | ---: | --- |
| Portfolio | **366** | **122** | +45 FAIL, +25 WARN |
| Studio (`--app`) | **0** | **32** | +5 WARN |

FAIL categories now: gradient **152**, shadow **130**, hairline **29**, eyebrow **24**,
numbering **11**, mono **11**, gradient-text **8**, emoji **1**. WARN: outlined-box
**69**, glass **45**, numbering **5**, default-font **1**, h-screen **1**, em-dash **1**.
The increase is the new `motion.css` depth/glass layer — the brief-mandated material —
and is declared rather than suppressed; the scanner's `taste-skill-ignore` comment was
not used anywhere.

### Taste lint — re-run after the liquid-glass pass (same day)

| Scan | FAIL | WARN | Change vs motion pass |
| --- | ---: | ---: | --- |
| Portfolio | **372** | **122** | +6 FAIL (gradient **156** = +4, shadow **132** = +2), WARN unchanged |
| Studio (`--app`) | **0** | **35** | −1 FAIL / +3 WARN: the decorative header sheen gradient was removed, edge/inset lights remain as WARN |

The +6 portfolio FAIL are the liquid layer's edge gradients and specular radials — the
brief-mandated glass, itemised in
[design-decisions.md](design-decisions.md). The Studio sheen was rolled back specifically
to keep the operational tool at 0 FAIL. Still no `taste-skill-ignore` usage; the
`detect` re-run in the table above confirms no new Impeccable finding either (same 10).


### Taste lint — re-run after the visual-impact pass (same day)

| Scan | FAIL | WARN | Change vs liquid pass |
| --- | ---: | ---: | --- |
| Portfolio | **390** | **124** | +18 FAIL / +2 WARN: section light pools, stronger orb fields, four-edge rims, tier glass fills, glass ghost-button and footer — the brief-mandated atmosphere and material |
| Studio (`--app`) | **0** | **35** | unchanged — no Studio file was touched in this pass |

Declared rather than suppressed (still no `taste-skill-ignore` usage). Impeccable
`detect` moved from 10 to **11**: one added severity-*warning*,
`radial-spotlight-glow`, on the fixed `div.backdrop-orb-1` (z-index-0 atmosphere
behind all content, required by the brief); artifact
`.resource-studio/qa/impeccable-detect-impact.json`, row in the table above and
the full reasoning in [design-decisions.md](design-decisions.md) Pass 4.
