# Portfolio + Resource Studio design decisions

## Pass summary

| Pass | Date | Result |
| --- | --- | --- |
| Pass 1 | 2026-10-21 | Flattening and readability pass: charcoal/crimson tokens, plain headlines, matte working surfaces, Studio pane redesign. Documented in the sections below. |
| Pass 2 | 2026-10-22 | Motion, 3D and depth restoration on top of Pass 1, plus the Resource Studio publish fix. See [Pass 2](#pass-2--motion-3d-and-glass-restoration-2026-10-22) at the end of this file. |
| Pass 3 | 2026-10-22 | Liquid glass and pointer interaction: shared pointer-light hook, edge speculars, 3D tilt scoping, Studio edge lighting, full verification and a content-state finding. See [Pass 3](#pass-3--liquid-glass-pointer-light-and-3d-interaction-2026-10-22). |

Pass 1's file table and the *Motion* bullet under Brief overrides describe that earlier
pass; Pass 2 supersedes them for `Hero.jsx`, `Backdrop.jsx`, `Work.jsx`, `AlliScene.jsx`,
`Reveal.jsx` / `useReveal.js` and continuous decorative motion. Pass 3 adds
`src/lib/usePointerLight.js` and the `.liquid` utility in `motion.css`, and re-wires
`Navbar.jsx`, `Contact.jsx` and `ResourceHub.jsx` (all inline pointer handlers moved to
the shared hook). Everything else in Pass 1 and Pass 2 still stands.

## Scope and context

This pass builds on the existing dirty working tree, including the crimson palette,
scroll helper, accessibility changes, resource catalog UI and local Studio bridge.
Content, project data, links, resource workflows and configuration remain owned by
their existing implementation. Visual edits are limited to the user-authorized files.
This report contains design information only; no local draft or private resource data.

## Direction contract

- **Thesis:** the builder and the real ALLI system are the portfolio's evidence.
  The portrait, readable project descriptions and selectable architecture replace
  particle spectacle. Studio answers “What resource am I editing, and is it saved?”
- **World:** black/charcoal, off-white text, restrained crimson actions. Space Grotesk
  headings, Inter reading text, JetBrains Mono technical identifiers. Glass is a
  specific layered material, with a light-catching edge, bounded blur and an opaque
  fallback; working lists are matte.
- **Story:** meet the builder, explore all four projects, inspect ALLI, open the real
  learning resources. Studio retains the add → select → edit → preview → save flow.
- **First viewport:** readable, plain-text headline beside the existing portrait;
  project snapshot overlaps the photograph, with its non-telemetry note readable.
  Studio uses a compact branded header and denser upload area above its work panes.
- **Form:** user-pinned, manually applied direction; no generated direction or seed.
  Portfolio mode: Experience/Persuade. Studio mode: Operate. Existing assets only.
- **Finish:** scoped source checks and a review of the final diff. Rendered review
  depends on parent-provided browser captures; no service or test runner is started.

## Instructions actually fetched and read

All references below were retrieved from the repositories' `main` branches for this pass.

| Source | Files read | Applied guidance |
| --- | --- | --- |
| [Impeccable](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md) | `skill/SKILL.src.md`, [`reference/new-work.md`](https://github.com/pbakaus/impeccable/blob/main/skill/reference/new-work.md), [`reference/craft-floor.md`](https://github.com/pbakaus/impeccable/blob/main/skill/reference/craft-floor.md), [`reference/animate.md`](https://github.com/pbakaus/impeccable/blob/main/skill/reference/animate.md), `reference/mode-persuade.md`, `reference/mode-operate.md` | Brief wins; preserve product truth; separate experience from operation; plain headlines; readable contrast; purposeful motion; visible-by-default content. |
| [Taste](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) | `skills/taste-skill/SKILL.md`, [`references/app-screens.md`](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/references/app-screens.md) | Real assets and full content; equal margins; typographic hierarchy; neutral dense lists; clear selection; meaningful status colors; responsive controls. |
| [Motion Design](https://github.com/LottieFiles/motion-design-skill/blob/main/skills/motion-design/SKILL.md) | `skills/motion-design/SKILL.md`, [`director/context-adaptation.md`](https://github.com/LottieFiles/motion-design-skill/blob/main/skills/motion-design/director/context-adaptation.md) | Premium personality, zero bounce, short press feedback, bounded displacement, reduced motion and no autoplay loops. |

Impeccable context CLI was unavailable (`Get-Command impeccable` returned no command).
The required fallback was stated before continuing: “Context loading did not run;
I’ll read the existing project context directly.” No `PRODUCT.md` or `DESIGN.md`
was found. README, source, assets and existing diffs supplied context instead.
No skill CLI, random direction draw, inspector or finish-review agent was run;
these instructions were applied manually under the user's explicit permission.

## Brief overrides

- **Glass:** the user explicitly requests selective realistic glass. This overrides
  Taste's no-glass default. Blur belongs to navigation, portrait overlays and the
  featured project; dense resource lists, forms and Studio work panes stay near-solid.
- **Typography:** the three named families override Taste's two-font/mono defaults
  and Impeccable's generic-face avoidance. Technical labels have a real mono role;
  normal navigation and prose use Inter, headings use Space Grotesk.
- **Motion:** the user's 120ms press, 240–360ms transitions and 500ms entrance budget
  overrides motion-count floors and ambient-layer suggestions. There is no continuous
  decorative motion, particle field, cursor tracking or glow. Spatial motion uses
  transform/opacity only. Static state styling remains instant and visible.
- **Preservation:** existing content takes precedence over skill suggestions to delete
  labels, rewrite copy or invent sample material. Typography and composition carry
  the redesign; no proof, project or resource is fabricated.

## Concrete implementation

| File | Changes made in this pass |
| --- | --- |
| `src/styles/v3.css` | Extended the existing untracked design layer. Neutral charcoal tokens, brighter secondary/meta text, shared responsive gutters, plain headlines, readable labels, restrained controls. Glass only on nav, portrait overlays and the flagship project, with opaque fallbacks and reduced-transparency support. Other project entries become editorial rows; resources and working surfaces stay matte. Removed active glow treatments and hover filter animation. Roadmap fill now scales with transforms rather than changing width/height on scroll, retaining the existing v0.6 stop geometry. Current-version labels and form fields remain visible by default. |
| `src/styles/base.css` | Changed only the reveal default to visible and untransformed; the pre-existing palette edits were retained. |
| `src/components/Hero.jsx` | Removed headline accent/masking wrappers and decorative orbital elements. Preserved headline words, portrait fallback, role list, computed counts, project snapshot and links. Moved the three portrait labels into a static caption. Retained the existing `scrollToId` integration. |
| `src/components/Backdrop.jsx` | Replaced the particle/cursor component with a static decorative ground; removed its canvas work, pointer tracking and animation loops. |
| `src/components/Work.jsx` | Removed mouse-follow highlights. Kept every project, description, technology, link and unavailable-link state. Miniature request path now uses `ARCHITECTURE_FLOW`, including RESPONSE, rather than duplicated strings. |
| `src/components/AlliScene.jsx` | Replaced the orbital particle scene with a semantic, keyboard-operable local-stack figure. Python/Ollama/Qwen selections show descriptions from the real architecture data. Retained v0.6 development status, all five conceptual areas (explicitly labelled development areas), and a non-telemetry note. |
| `src/components/AlliArchitecture.jsx` | Plain-text heading; retained the existing keyboard controls, `aria-controls` and live detail panel. |
| `src/components/Reveal.jsx`, `src/hooks/useReveal.js` | Delay passed through to an optional 500ms featured-project entrance. No CSS hidden state; ordinary reading sections stay still. Reduced-motion preference changes cancel the active animation. Existing scroll-spy implementation is intact. |
| `tools/resource-studio/resource-studio.css` | Compact glass header, flat crimson primary action, near-solid library/editor/preview surfaces, larger labels/inputs, full wrapping resource titles, clear selected-row treatment, accessible action sizing and focus states, semantic success/warning/error colors, responsive stacked panes. No Studio JSX or storage logic edited. |

Glass uses fixed 12–16px blur, never animated blur. Press feedback is 120ms;
control/detail transitions are 240ms; menu/modal transitions are 360ms; portrait
snapshot and featured-project entrance are 500ms. Entrances start partially visible
and have no backwards fill that could strand content. Reduced motion removes spatial
travel while retaining visible selection, focus, status and control feedback.

The existing HTML entries already request all three pinned font families. The shipped
portrait (`public/img.jpeg`) was opened and inspected as an asset; it is not a rendered
page capture. This pass adds no font assets, image assets, dependencies, configuration
or generated build output.

## Actual checks

**PASS:** esbuild syntax transforms for six JSX components, one JS hook and three CSS
files, with PostCSS parsing for each stylesheet; zero parser warnings.

```powershell
node -e "const fs=require('node:fs'); const esbuild=require('esbuild'); const postcss=require('postcss'); const files=['src/components/Hero.jsx','src/components/Backdrop.jsx','src/components/Work.jsx','src/components/AlliScene.jsx','src/components/AlliArchitecture.jsx','src/components/Reveal.jsx','src/hooks/useReveal.js','src/styles/base.css','src/styles/v3.css','tools/resource-studio/resource-studio.css']; for(const file of files){ const css=file.endsWith('.css'); const source=fs.readFileSync(file,'utf8'); if(css) postcss.parse(source,{from:file}); const result=esbuild.transformSync(source,{loader:css?'css':file.endsWith('.jsx')?'jsx':'js',sourcefile:file,logLevel:'silent'}); if(result.warnings.length) throw new Error(JSON.stringify(result.warnings)); console.log('PASS syntax '+file); }"
```

**PASS:** five in-memory component bundles, resolving the modified components' import
graphs using installed esbuild. `write:false` produces no output files.

```powershell
node -e "const esbuild=require('esbuild'); esbuild.build({entryPoints:['src/components/Hero.jsx','src/components/Work.jsx','src/components/Backdrop.jsx','src/components/AlliScene.jsx','src/components/AlliArchitecture.jsx'],bundle:true,write:false,outdir:'unused-memory-only',format:'esm',platform:'browser',jsx:'automatic',logLevel:'silent'}).then(result=>{if(result.warnings.length) throw new Error(JSON.stringify(result.warnings)); console.log('PASS in-memory component bundles: '+result.outputFiles.length+' entries; no files written');}).catch(error=>{console.error(error);process.exitCode=1;});"
```

**PASS:** scoped tracked-diff whitespace/error check (Git emitted only its existing
LF/CRLF notices), plus direct whitespace/conflict-marker checks for the untracked files.

```powershell
git diff --check -- src/components/Hero.jsx src/components/Backdrop.jsx src/components/Work.jsx src/components/AlliScene.jsx src/components/AlliArchitecture.jsx src/components/Reveal.jsx src/hooks/useReveal.js src/styles/base.css src/styles/v3.css tools/resource-studio/resource-studio.css reports/design-decisions.md
node -e "const fs=require('node:fs'); for(const file of ['src/styles/v3.css','reports/design-decisions.md']){const source=fs.readFileSync(file,'utf8');if(/[\t ]+$/m.test(source)||/^(<<<<<<<|=======|>>>>>>>)/m.test(source))throw new Error('Whitespace or conflict marker: '+file);console.log('PASS new-file hygiene '+file);}"
```

**PASS:** six token-level WCAG contrast calculations, using sRGB luminance. These are
static token checks, not a rendered whole-page accessibility audit.

| Pair | Ratio |
| --- | --- |
| Body `#c1c1c8` / raised `#1d1d20` | 9.39:1 |
| Metadata `#a1a1ab` / raised `#1d1d20` | 6.57:1 |
| White / portfolio primary `#c91830` | 5.74:1 |
| White / Studio primary `#bd2035` | 6.14:1 |
| Hero glass note `#c1c1c8` / `#1a1a1d` at 82% over white | 5.49:1 |
| Studio glass metadata `#a1a1ab` / `#1a1a1d` at 94% over white | 5.76:1 |

```powershell
node -e "const rgb=h=>h.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)); const lum=c=>c.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0); const mix=(h,a)=>rgb(h).map(v=>v*a+255*(1-a)); const cases=[['body / raised','#c1c1c8',rgb('#1d1d20')],['metadata / raised','#a1a1ab',rgb('#1d1d20')],['portfolio primary','#ffffff',rgb('#c91830')],['Studio primary','#ffffff',rgb('#bd2035')],['hero glass note / white backing','#c1c1c8',mix('#1a1a1d',0.82)],['Studio glass metadata / white backing','#a1a1ab',mix('#1a1a1d',0.94)]]; for(const [name,fg,bg] of cases){const a=lum(rgb(fg)),b=lum(bg);const ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);if(ratio<4.5)process.exitCode=1;console.log((ratio>=4.5?'PASS':'FAIL')+' token contrast '+name+': '+ratio.toFixed(2)+':1');}"
```

## Limitations and parent verification

- No rendered capture was available in the workspace, logs, reports or parent QA
  screenshot directory when checked. No visual score, screenshot approval or browser
  interaction pass is claimed. Review at 390, 768 and 1440px remains the next step.
- No service, browser test runner, production build or install was started. The parent
  owns production builds and browser setup. Existing and concurrent changes outside
  the visual scope were left in place.
- The source review checked responsive cascade, default visibility, reduced-motion
  rules, glass fallbacks and preservation of existing content. Actual loaded fonts,
  headline wrapping, overflow, keyboard interactions, Studio long-title/empty/error
  states and the final screenshot appearance still require the parent's browser run.
- Skill CLI/draw/inspector output is unavailable. This report records manual application
  of the actual fetched files, not successful execution of their automated workflows.

---

## Pass 2 — motion, 3D and glass restoration (2026-10-22)

### Why and the cascade rule that governs it

Pass 1's `v3.css` is a *flattening* layer: it sets `animation`, `transition`,
`transform`, `backdrop-filter` and `box-shadow` to `none` on the elements it touches.
Every restoration therefore lives in one new layer, `src/styles/motion.css`, imported
**after** `v3.css` in `src/main.jsx`. Neither layer fights the other, and the type,
colour and copy decisions from Pass 1 are untouched. One thing Pass 1 got right and
Pass 2 kept: the headline's gradient/`accent` treatment stays flat.

### Files changed in this pass

| File | Change |
| --- | --- |
| `src/styles/motion.css` (new) | Depth tokens (`--elev-1/2/3`, `--rim-crimson`), glass tokens (`--glass-nav/panel/raised/sheen`), scroll reveals, backdrop drift, nav glass, hero entrance choreography, portrait orbit stage, Work pointer-light and tilt, ALLI 3D layout, `@supports (backdrop-filter)` glass tiers, elevation for cards/nodes, image hover scale, reduced-transparency and reduced-motion guards, and an 11px legibility floor. |
| `src/main.jsx` | Imports `motion.css` after `v3.css`. |
| `src/components/Backdrop.jsx` | Restored grid, crimson orbs, particle canvas with link lines, grain and pointer-following glow; `visibilitychange` pause, static draw under reduced motion, glow only on `pointer: fine`. |
| `src/components/Hero.jsx` | Restored `.hero-title .line > span` entrance wrappers, the portrait orbit stage (glow + rings) and the three float labels. |
| `src/components/Work.jsx` | Mouse position writes `--mx/--my` on every card for the pointer light; `useTilt` on the featured card. |
| `src/lib/useTilt.js` (new) | Fine-pointer-only tilt, reduced-motion-optional, lerped rAF, clears itself when disabled. |
| `src/components/AlliScene.jsx` | Restored the CSS-3D stage (rings, arms, core, node labels, floating panels, pointer parallax, IO/visibility pausing) while keeping the semantic, keyboard-operable stack figure and its live detail panel. |
| `src/hooks/useReveal.js`, `src/components/Reveal.jsx` | IO + reduced-motion only; the WAAPI featured-card animation was removed because it fought the new CSS transition. |
| `tools/resource-studio/resource-studio.css` | Studio depth pass: panel elevation, row hover, control transitions, `@supports` glass for preview/editor/library panels, reduced-transparency guard. |
| `tools/resource-studio/index.html` | Added the missing favicon link (removed a stray 404 in every Studio capture). |
| `scripts/capture-screens.mjs` | Screenshot helper now walks the page to fire IntersectionObservers, force-settles remaining reveals, and captures five anchored section shots. |
| `tools/resource-studio/ResourceStudio.jsx` | Functional fix (see below), not a visual change. |

### Resource Studio publishing fix

`saveEditor` validated the catalog with a `fileExists` check backed only by
bridge-managed `nextFiles`, so the eight legacy episode covers
(`images/content/part-0X.webp`) failed validation and the `/api/commit` request was
never sent — the save failed silently. Validation now uses a module-level
`projectAssetExists(relativePath, files)` at all three `validateCatalog` call sites,
with `isAllowedCoverPath` imported from `src/lib/resourceValidation.js`. No storage
layout, bridge protocol or catalog schema changed.

### Motion budget

Entrance: headline lines `line-up`, staggered `fade-up` for copy/roles/actions/stats,
`portrait-arrive`, scroll-cue bar. Ambient: orb drift, grid breathe, ring drift, grain.
Interaction: Work pointer light + featured tilt, card hover lift, image hover scale.
State: nav glass, chip/dot, node breathe, roadmap fill. Timing: 120ms press, 240ms
state, 360ms menu/panel, 500ms entrance, 600ms image hover; ambient cycles ≥2.4s.
Transform/opacity/shadow only; glass blur is static (never animated). Every ambient
and entrance rule sits inside `@media (prefers-reduced-motion: no-preference)`, so
reduced motion falls back to Pass 1's visible-by-default state, with explicit
`prefers-reduced-motion` and `prefers-reduced-transparency` guards on top.

### Declared deviations from the Taste Skill brief

The Taste Skill bans glass, gradients, shadows, glow, particles and grid backgrounds;
its own documentation says the brief wins and to declare the exceptions. The user's
brief mandates premium glassmorphism and a rich animated 3D presentation, so these
are intentional, not oversights:

| Skill rule | What we ship | Why |
| --- | --- | --- |
| No glass / blur | Tiered `@supports` glass on nav, featured project, float labels, contact form, modal and Studio panes; opaque fallback elsewhere | Explicitly requested material |
| No resting shadows | `--elev-1/2/3` crimson-rimmed elevation on cards, nodes, panels | Depth is part of the mandate |
| No glow / particles / grid / cursor effects | Crimson orbs, particle link canvas, grid, pointer glow in `Backdrop.jsx` | Restored ambient system the brief asked for |
| No pulsing dots | Pulses removed again after the detector flagged them; dots are static | Detector's #1 "AI-generated" tell, and `v3.css` had already suppressed them |
| Two fonts max | Space Grotesk / Inter / JetBrains Mono | Pinned identity |
| Body text tracking, Inter as primary font, em-dashes | Retained (footer/micro-label tracking, prose voice) | Copy and identity choices, flagged not silently changed |

### Design-skill verification

**Impeccable** (`impeccable.cmd` — valid subcommands are `detect`, `ignores`, `help`,
`install`, `link`, `update`, `check`, `telemetry`; there is no `audit` command):

```powershell
cmd.exe /c ".agents\skills\impeccable\scripts\impeccable.cmd context"
cmd.exe /c ".agents\skills\impeccable\scripts\impeccable.cmd detect http://127.0.0.1:5173 --json"
```

`context` reports `NO_PRODUCT_MD`, `BUILD_INIT_REQUIRED`, `SCOPED_EXISTING_ALLOWED` and
`EXISTING_VISUAL_SYSTEM` (plus a `RESOLVED_CONTEXT` block) — there is no
`PRODUCT.md`/`DESIGN.md`, and narrow refinement may proceed on the incumbent
implementation as authority, offering `/impeccable init` afterwards. The detector is
the required check for this kind of pass. Against
the running site:

| Run | Findings |
| --- | --- |
| First run (this pass) | **40** — 17 `undersized-ui-text` (warning) + 8 (advisory), 3 `dark-glow`, 3 `wide-tracking`, 3 `pulsing-dot` (1 **error**), 2 `nested-cards`, 1 `tiny-text`, 1 `overused-font`, 1 `em-dash-overuse`, 1 `codex-grid-background` |
| After fixes | **10** — 3 `dark-glow`, 3 `wide-tracking`, 1 `overused-font`, 1 `em-dash-overuse`, 1 `codex-grid-background`, 1 `nested-cards` |

Fixed in this pass: the ALLI caption chip was 9.28px (now 11px) and its dot stopped
pulsing; `.system-detail` was a card inside a card (now an inset crimson rule);
`.hero-badge .dot`, `.chip-live::before` pulses restored `v3.css`'s static state; a
shared 11px floor was added for `.jt-tag`, `.poster-num`, `.poster-cta`,
`.resource-filter-label` and `.content-brand em`, and `.alli-status-version` to 12px.
Artifacts: `.resource-studio/qa/impeccable-detect.json` and
`.resource-studio/qa/impeccable-detect-after.json`.

Remaining 10 are all deliberate or pre-existing, not introduced defects:

- **`dark-glow` ×3** — the crimson light on `.core-sphere/.core-inner/.core-label`,
  the focal point of the restored ALLI scene. Kept as brand/scene identity.
- **`wide-tracking` ×3** — footer and maintenance-note letter-spacing (0.06–0.10em),
  a deliberate micro-label signature.
- **`overused-font`** — Inter at 43% of text: the pinned body face.
- **`em-dash-overuse`** — 35 em-dashes in existing copy; editing copy is out of scope.
- **`codex-grid-background`** (advisory) — the ambient backdrop grid.
- **`nested-cards` ×1** — `.resource-search`, a bordered input inside the library
  panel: a form control rather than a card, pre-existing at HEAD.

**Taste Skill** source lint, re-run after this pass:

| Scan | Files | FAIL | WARN | Exit |
| --- | ---: | ---: | ---: | ---: |
| Portfolio (`src`, `index.html`) | — | **366** (was 321) | **122** (was 97) | 1 |
| Studio (`--app`) | — | **0** | **32** (was 27) | 0 |

FAIL: gradient **152**, shadow **130**, hairline **29**, eyebrow **24**, numbering
**11**, mono **11**, gradient-text **8**, emoji **1**. WARN: outlined-box **69**,
glass **45** (was 22), numbering **5**, default-font **1**, h-screen **1**, em-dash
**1**. The rise is almost entirely `motion.css`'s gradients, elevation shadows and
`backdrop-filter` — i.e. exactly the brief-mandated material, declared above. No
finding was suppressed; the script's `taste-skill-ignore` escape hatch was not used.

**Motion Design skill** — entrance/press budgets, zero bounce, bounded displacement,
reduced-motion handling and no autoplaying content loops were applied as written; its
ambient-layer defaults are the reason the background layers exist at all.

### Checks actually run

- `cmd.exe /c "npm run build"` → `dist/index.html` 437.27 kB, validated 10 records /
  8 published.
- `npm run validate:resources`, `npm run test:resources`, `npm run test:bridge` → pass.
- `npm run test:studio` → 9/9 real-repo E2E (upload → save → publish → dist → unpublish
  → delete/restore).
- `npm run test:browser` → 13/13 fixture E2E, no uncaught page errors, no horizontal
  overflow at 390/768/1440 under reduced motion.
- **Port ordering matters:** `test:studio` needs the launcher running (it drives the
  real Studio on 4174/4175); `test:browser` needs the launcher stopped, because its
  fixture binds 4174 itself and fails with `EADDRINUSE` otherwise. Working order:
  `local-dev.mjs start` → `test:studio` → `local-dev.mjs stop` → `test:browser` →
  `local-dev.mjs start`. Both orders were exercised; every failure was this
  precondition, never an assertion.
- `scripts/capture-screens.mjs` → `clean capture: capture` (no overflow, no console or
  page errors) at 1440/768/390 plus five anchored sections and both Studio widths.
  Screenshots: `.resource-studio/qa/screens/capture-*.png`; earlier state in
  `before-*`/`after-*`.
- `impeccable detect` → 40 → 10 as itemised above.
- No lint/typecheck tool is configured in this repository (no ESLint/Prettier/Biome).

### Content state observed (not a regression)

At the end of Pass 2, `src/data/resourceCatalog.json` held 10 records: 8 published
episodes and 2 prompt records that were drafts at that time ("Transfer Dock Text
20261001191611 (1)" and "New prompt"). ResourceHub deliberately filters episodes out of
the library (`resource.kind !== "episode"`), so the library grid showed its empty state
while the 8 episodes rendered as episode cards. Nothing was published, deleted or
edited by this pass; the state was reported for a human decision. **Superseded by
Pass 3's content-state finding below — both prompt records are now published.**

### Boundaries kept

No commit, push, deploy or GitHub change was made; the working tree stays dirty as
found. `package.json` only gained the `test:studio` and `test:browser` scripts. No
dependency, config, asset or `dist/` change beyond the normal build output.


## Pass 3 — liquid glass, pointer light and 3D interaction (2026-10-22)

### What shipped

- **`src/lib/usePointerLight.js`** — one shared, render-free interaction hook. rAF-lerped
  state written as inline custom properties on the target element: `--lx` / `--ly`
  (0–100% box position), `--mx` / `--my` (px inside the box), `--lit` (0–1 intensity).
  Fine pointers only (`pointer: fine`), disabled under `prefers-reduced-motion: reduce`,
  `pointerleave` dims back to 0, `viewport: true` mode tracks across the window for the
  navbar, `enabled` gates conditional surfaces, and an `onFrame(x, y, lit)` callback
  drives parallax without touching React state. Cleanup removes every inline property.
- **Wiring:** `Navbar.jsx` (`header.nav.liquid`, viewport mode) · `Hero.jsx`
  (`usePointerLight(heroRef, { onFrame })` parallax: `.portrait-stage` translate,
  `.portrait-frame` perspective transform, `.portrait-labels` on the independent
  `translate` property so `label-float` keeps owning `transform`; `.alli-status.liquid`) ·
  `Work.jsx` (inline `onMove`/`onMouseMove` replaced by the hook; `useTilt` stays on the
  featured card only because `v3.css:651` renders `.work-grid` as editorial rows) ·
  `ResourceHub.jsx` (`useTilt(max 3.5, lift −4)` + hook, both gated on
  `Boolean(featuredResource)`; `.resource-featured.liquid`) · `Contact.jsx`
  (`.contact-form.liquid`) · `AlliScene.jsx` (its existing parallax listener now also
  writes `--lx/--ly/--lit` on `.system-stage`, cleaned up on unmount).
- **`motion.css` "Liquid glass":** `.liquid { isolation: isolate }`; `::before` is the
  static edge (1px inset white highlight + edge gradient); `::after` is the pointer
  specular, positioned at `var(--lx)/var(--ly)`, `opacity: var(--lit, 0)`, 0.45s fade,
  `mix-blend-mode: screen`. `--spec-w/--spec-h` retune it for the full-width nav and the
  status chip. `.portrait-frame` now transitions border/shadow only (JS lerps the
  perspective), `.project-card::before` gained a white specular over the crimson one,
  `.project-card.project-featured` carries an inset edge light at rest and hover, and
  `.system-stage::after` is the scene specular. Everything in the liquid layer is hidden
  under `prefers-reduced-transparency`.
- **Studio `resource-studio.css`:** a "Liquid edge" inset top light on the header,
  dropzone and every work panel (no pointer effects, no animated blur — Studio stays
  operational), dropped again under `prefers-reduced-transparency`. The decorative header
  sheen gradient was removed before the final numbers so Studio keeps **0 FAIL**.

### Declared deviations delta (Pass 3)

| Skill rule | Change | Why |
| --- | --- | --- |
| Gradient fill | portfolio **+4 FAIL** (152 → 156): `.liquid::before` edge gradients and the white specular radials on stage/cards | Brief-mandated glass material |
| Shadow at rest | portfolio **+2 FAIL** (130 → 132): inset edge highlights on `.project-card` and glass surfaces | Depth is part of the mandate |
| Gradient / shadow (Studio) | sheen gradient removed → Studio stays **0 FAIL**; net **+3 WARN** for inset edge lights | Keep the operational tool at zero FAIL |

Taste lint re-run (final): portfolio **372 FAIL / 122 WARN** (gradient **156**,
shadow **132**, hairline 29, eyebrow 24, numbering 11, mono 11, gradient-text 8,
emoji 1; WARN: outlined-box 69, glass 45, numbering 5, default-font 1, h-screen 1,
em-dash 1), studio **0 FAIL / 35 WARN**. No `taste-skill-ignore` comment exists
anywhere; no Impeccable ignore rule was added.

### Checks actually run (Pass 3)

- `scripts/capture-screens.mjs` → `clean capture: capture` twice (1440/768/390 + five
  anchored sections + both Studio widths) with no overflow, console or page errors;
  hero, work, ALLI, resources, contact and Studio captures reviewed image-by-image.
- `impeccable detect http://127.0.0.1:5173 --json` → **10 findings, the identical set**
  as after Pass 2 (3 `dark-glow`, 3 `wide-tracking`, `overused-font`,
  `em-dash-overuse`, `codex-grid-background`, `nested-cards`). The liquid layer added no
  new finding. Artifact: `.resource-studio/qa/impeccable-detect-liquid.json`.
- `npm run test:studio` → **9/9** (real-repo E2E; byte-identical catalog restore).
- `npm run test:browser` → **13/13** (fixture E2E; overflow/focus/Escape at
  390/768/1440 under reduced motion; no uncaught page errors).
- `npm run test:pointer` → **9/9** — new `scripts/test-pointer-light.mjs` proves the
  interaction layer live: hero, nav, ALLI stage, contact form and featured resource all
  reach `--lit` > 0.2 on hover (lx/ly set), the featured project card computes a
  `matrix3d` tilt, the light fades to 0.004 after the pointer leaves, reduced-motion
  context holds `--lit` at 0, and no page errors are raised.
- `cmd.exe /c "npm run verify"` → `test:resources` + `test:bridge` pass, build
  `dist/index.html` **486.17 kB** (gzip 135.05 kB), privacy check "passed for 10
  published records".
- Shortcut/launcher suites re-run green (PIDs and details in
  [launcher-verification.md](launcher-verification.md)).
- **Environment note:** WSL→Windows `127.0.0.1` forwarding was unavailable in this
  session (Linux node: `ECONNREFUSED` on 4174/4175/5173; Windows-side probe: 200/403).
  Every suite that fetches the running services was therefore executed through
  `cmd.exe /c "npm run …"` (Windows node); pure-Node checks (source lint, forensics)
  ran under Linux node. Port ordering still applies: services up → `test:studio` →
  stop → `test:browser`/shortcut suites → start.

### `dist` size growth explained

`dist/index.html`: 392.0 kB (HEAD) → 437.27 kB (Pass 2 build) → **486.17 kB** (Pass 3
build). The last jump is data, not code: publishing the prompt records grew
`src/data/resourceCatalog.public.json` from 8,071 bytes / 8 records (HEAD) to 50,613
bytes / 10 records, including **37,865 bytes of `promptText`** for Transfer Dock, which
`src/data/resources.js` imports and the single-file build inlines into the HTML
(≈ +42.5 kB). The remainder is this pass's hook and CSS. Source CSS is now 174,646 bytes
vs 137,053 at HEAD. No duplication was found in the bundle. Unpublishing the drafts was
expected to remove roughly that 42.5 kB again — and after the approved unpublish the
build is **441.10 kB** (486.17 → 441.10, −45.07 kB), confirming the accounting.

### Content state — drafts briefly published, now restored (resolved)

`src/data/resourceCatalog.json` currently has **zero unpublished records**: both prompt
records are `published: true`, the generated public catalog and manifest list all 10,
`dist/index.html` contains both titles, the 38,313-byte prompt file sits in
`public/assets/resources/prompt-packs/` (and therefore in `dist/`), the live Resources
section shows "2 OF 2" with Transfer Dock as the featured card, and Studio reports
Public 10 / Drafts 0.

Evidence on how it happened — **no automated check in this repository did it**:

- `test:bridge` runs against a `mkdtemp` root on an ephemeral port; `test:browser`
  mutates only a copied fixture under the approved QA temp root; `test:studio` uploads
  its own `astra-live-proof.txt` (trash entries at 14:15, 14:59, 15:30) and asserts a
  byte-identical catalog restore — its last run finished 15:30:51. No script under
  `scripts/` or `tools/` references "transfer-dock".
- The earliest Studio backup today (14:01:50) still shows both records unpublished with
  title "Transfer Dock Text 20261001191611 (1)". Between **15:42:34 and 15:43:36** the
  backups record eight consecutive bridge commits matching interactive Studio use:
  re-upload of the base file → deletion of the "(1)" duplicate (trash entry
  `transfer-dock-text-20261001191611-1.txt` at 15:42:41) → metadata edits → publish of
  Transfer Dock → creation and publication of "New prompt". No capture/backup activity
  exists from any test in that window.

Per the standing instruction not to publish, rename, edit or delete these records,
nothing was reverted: this is reported for a human decision — flip both back to
`published: false` (also removing ~42.5 kB from `dist`), keep them published, or confirm
it was intentional. Note for that decision: `scripts/verify-public-output.mjs` skips any
record whose `published` flag is true (line 61), so the privacy check passes by design
while published records ship.

**Resolution (2026-10-22, explicitly approved by the user):** both records were set back
to `published: false` in the canonical catalog (Node `JSON.stringify(…, null, 2)`
round-trip, LF endings preserved), and the 38,313-byte file was moved from
`public/assets/resources/prompt-packs/` back to
`.resource-studio/drafts/assets/resources/prompt-packs/` — the bridge's own draft
location. `validate:resources` then regenerated both generated files with **8 published
records** and now emits its expected informational warning ("draft file … is not staged;
it will stay out of the public export") instead of silently passing. Verified after the
rebuild: `dist/index.html` **441.10 kB** (−45.07 kB), zero occurrences of either title
anywhere in `dist/`, no prompt-pack file shipped, dist manifest = 8 records,
`verify-public-output` passes for 8 published records (and genuinely excludes drafts
again), the live Toolkit renders its "0 OF 0" empty state, and Studio reports
**Public 8 / Drafts 2** with both rows badged *Draft*. The suites were re-run around the
change: `test:studio` 9/9 (byte-identical restore), `test:browser` 13/13, `test:pointer`
9/9 (its featured-resource check is conditional on a published featured resource),
`impeccable detect` still the same 10, captures clean.

### Boundaries kept (Pass 3)

No commit, push, deploy or GitHub change was made; the working tree stays dirty as
found. `package.json` gained only the `test:pointer` script this pass (plus the new
file `scripts/test-pointer-light.mjs`); `test:studio`/`test:browser` were Pass 2's. No
dependency or config change beyond the normal build output. Two state changes were made
later the same day **with explicit user approval**: unpublishing the two prompt records
(see the Content state resolution above) and creating the opt-in Startup-folder shortcut
(see [launcher-verification.md](launcher-verification.md)).

## Pass 4 — visual impact correction (2026-10-22)

**Trigger:** the review after Pass 3 said the rendered site still looked plain —
the glass utilities existed in code but the page did not visibly read as liquid
glass. This pass diagnoses the render and corrects the UI itself.

### Why the previous implementation looked plain

Computed-style probe (`.resource-studio/qa/style-probe.mjs`, Edge/1440) plus
screenshot review found six concrete causes:

1. **No light behind the glass.** v3.css had dimmed `.backdrop-orb-1/2` to
   `rgba(225,29,53,0.12)`/`rgba(137,13,32,0.11)` at `opacity 0.5` (effective ≈ 6%
   crimson) and motion.css restored only their *animation*, never their
   intensity. Translucent surfaces blurred near-black over near-black.
2. **Opaque section bands covered the backdrop.** `.section-alt` painted solid
   `var(--bg-2)`, so about/ALLI/journey/resources/skills/contact hid the fixed
   light fields entirely; only hero/work were transparent.
3. **The specular rested at zero.** `.liquid::after` computed `opacity: 0`
   (`var(--lit, 0)` default), so the signature highlight existed only while a
   fine pointer was inside the element — never in any static view.
4. **Dark fills.** Glass tiers were `rgba(22,22,25,0.66)`-class over `#09090b`;
   blur and translucency were indistinguishable from flat cards, and edges were
   single hairlines at 0.11–0.15 white.
5. **Killed hero wash.** `v3.css:573` set `.hero::before { content: none }`;
   motion restored `content` but not the gradient (left at v3's 0.055 strip).
6. **Hover-gated card sheen.** `.project-card::before` computed `opacity: 0`
   at rest — the featured card showed no reflection until hovered.

### Changes (motion.css unless noted)

- **Atmosphere:** orb opacity 0.5 → 0.8 with 0.40/0.36 alpha pools; cursor glow
  0.13; `.hero::before` rebuilt as three crimson pools; new `.hero::after`
  pointer-tracked light pool consuming the hero's own `--lx/--ly/--lit`;
  `.section`/`.section.section-alt` get alternating corner pools (opposite
  sides); alt bands turned translucent (`rgba(16,16,21,0.74)` → `0.62`) so the
  fixed fields show through; resource-hub pools raised to 0.16/0.12 at 0.9
  opacity; footer glass strip.
- **Material:** `--glass-nav/panel/sheen` lightened; nav `rgba(11,11,16,0.5)` +
  `blur(22px) saturate(150%)`, scrolled state gains a luminous bottom rim and
  `0 18px 44px` shadow; `.liquid::before` four-edge rim + brighter top light;
  `.liquid::after` now rests at `opacity: calc(0.45 + 0.55 * var(--lit, 0))`
  positioned top-right, and lifts to full under the pointer; spec sizes raised
  (nav/status 520×300, contact 640×420); featured project / featured resource /
  contact form rebuilt over four layers (sheen + crimson tint + white 0.05 +
  translucent base ≈ 0.6) with 0.17 borders, elev-3 and inset top light;
  supporting tier (fact, skill-group, jt-card, journey-card, poster-card,
  contact-point, pillar, resource-card, prompt-card, toolkit-card,
  download-card) shares one light-glass gradient + 0.10 border;
  `.system-stage::after` rests at `0.07 + 0.13·lit`; alli-system sheen 0.6 →
  0.85; portrait frame crimson bloom ring; `.btn-ghost` glass fill; float-label
  0.55 alpha + blur 14; featured card `::before` rests at 0.45 (1 on hover).
- **Composition:** hero display scale restored for ≥900px
  (`clamp(3.4rem, 5.4vw, 4.75rem)`, tracking −0.045em) after v3 flattened it to
  4.25rem.
- **Interaction:** featured project tilt 5° → 7° / lift −6 → −8 (Work.jsx);
  featured resource tilt 3.5° → 5.5° (ResourceHub.jsx).
- **Capture workflow:** `scripts/capture-screens.mjs` gained `pointer` shots —
  `interaction-hero` and `interaction-work` move the mouse and settle 700ms so
  tilt and specular are visible in stills. The 11 previous states were preserved
  as `.resource-studio/qa/screens/plain-*` for direct before/after comparison.
- **Reduced transparency:** `.hero::after` and `.project-card::before` added to
  the degradation list alongside `.liquid::*`.

### Evidence

- Baseline `plain-*` vs new `capture-*` (same 11 states + 2 interaction shots),
  reviewed image-by-image.
- Computed deltas: `nav::after` opacity 0 → 0.45; featured `::before` 0 → 0.45;
  orb opacity 0.5 → 0.8; nav `rgba(15,15,17,0.74)`/blur 18 →
  `rgba(11,11,16,0.5)`/blur 22 saturate 150; contact form `rgba(24,24,27,0.72)`
  → `rgba(17,17,24,0.6)`; section-alt opaque → translucent + pools.

### Checks run (final state)

| Check | Result |
| --- | --- |
| `test:studio` | 9/9 (byte-identical restore; publishing intact) |
| `test:browser` | 13/13 (no overflow at 390/768/1440, console clean) |
| `test:pointer` | 9/9 incl. tilt `matrix3d` and reduced-motion `lit=0` |
| `verify` | exit 0 — dist 443.62 kB (gzip 120.08), privacy passed for 8 published records |
| capture | `clean capture` ×13 (0 page errors, 0 horizontal overflow) |
| launcher unit | 2/2 (shortcut lifecycle last verified earlier the same day; launcher files untouched since) |
| taste lint portfolio | **390 FAIL / 124 WARN** (was 372/122 — +18 gradient/shadow/blur lines, the mandated glass material) |
| taste lint studio | **0 FAIL / 35 WARN** (unchanged — component separation held) |
| impeccable detect | **11** (was 10): +1 severity-*warning* `radial-spotlight-glow` on the fixed `div.backdrop-orb-1` — z-index-0 atmosphere behind all content, required by the brief; accepted and recorded |
| reduced transparency | verified via CDP `Emulation.setEmulatedMedia` (Playwright's `emulateMedia` cannot set this feature): `.hero::after`/`.nav::after` → `display: none`, nav → solid `rgb(29,29,32)`, `backdrop-filter: none` |

**Boundaries:** both prompt drafts remain unpublished (privacy check re-passed),
Resource Studio untouched (0 FAIL lint unchanged, 9/9 tests), launchers and the
Startup shortcut untouched, no commit/push/deploy.
