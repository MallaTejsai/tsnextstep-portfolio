# Tejsai / TS nextstep — Portfolio

Premium dark (black + electric blue / violet) portfolio site for **Tejsai (TS nextstep)** —
student, developer, AI builder and content creator. Built with **React + Vite**, fully
data-driven, mobile-first and accessible.

- Flagship project: **ALLI** (personal AI assistant, currently **v0.6 — current development**)
- Interactive **"Meet ALLI"** experience: a CSS-3D visualization (rings, orbiting nodes, depth
  panels) plus an honest, interactive **architecture flow** — USER → PYTHON → ALLI → OLLAMA →
  QWEN → RESPONSE. The scene is labelled as a visualization; nothing on the site pretends to be
  live inference or real telemetry.
- Public ALLI history: **v0.1 → v0.6 on the timeline** (the line stops at v0.6) with a separate
  **Planned next** list for v0.7 → v1.0 — future work is never presented as built
- Video series library: **8 episodes** shown with their **real cover artwork**, each opening a
  platform picker (YouTube / Instagram)
- **Resources & Digital Toolkit**: a featured, searchable and filterable index of the verified
  ALLI field notes, plus honest Prompt Library and PDF/download empty states ready for approved
  public material
- Local-only **Resource Studio** for drag-and-drop files, visual metadata editing, previews,
  keyboard-accessible reordering, local draft recovery, validated catalog export and optional
  repository-folder writing through the browser File System Access API
- Journey timeline (education, learning, ALLI, what's next) and a 4-project showcase
- Contact: email is shown (`mailto:`), social links, and a **Web3Forms** contact form with
  validation and sending/success/error states

---

## Quick start

```bash
npm install          # if esbuild's postinstall was skipped: node node_modules/esbuild/install.js
npm run dev          # dev server → http://localhost:5173
npm run build        # validates resources, then builds dist/
npm run preview      # serve the production build locally
npm run studio       # owner-only local Resource Studio → http://127.0.0.1:4174
```

**Opening from disk:** `npm run build` inlines all JS and CSS into a single
`dist/index.html` (posters are copied to `dist/images/content/`), so you can open that file
directly and the site just works (no server needed). Double-clicking the *source* `index.html`
redirects you to `dist/index.html` automatically — the source entry only runs through
`npm run dev`.

## Project structure

```
portfolio/
├── index.html                 # title, meta description, fonts, JSON-LD
├── vite.config.js             # React plugin, relative base
├── .env.example               # VITE_WEB3FORMS_ACCESS_KEY template
├── public/
│   ├── favicon.svg
│   ├── img.jpeg               # shipped portrait (img.png tried as fallback)
│   ├── images/content/        # real episode cover artwork (intro + part-01…07)
│   └── assets/resources/      # generated public manifest and public resource folders
└── src/
    ├── main.jsx               # entry + style imports
    ├── App.jsx                # section composition
    ├── components/            # Navbar, Hero, About, Work, Alli, AlliScene, AlliArchitecture,
    │                          # AlliRoadmap, Journey, Skills, Content, ResourceHub, Contact,
    │                          # Footer, VideoCard, VideoModal, Reveal, icons
    ├── data/
    │   ├── site.js            # identity, roles, email, social links, nav
    │   ├── alliRoadmap.js     # completed history (v0.1 → v0.6) + planned list (v0.7 → v1.0)
    │   ├── alliArchitecture.js# USER → RESPONSE flow used by the interactive diagram
    │   ├── alliVideos.js      # 8 episodes with exact IG/YT links + poster paths
    │   ├── journey.js         # timeline, education, current focus
    │   ├── resourceCatalog.json        # authoritative owner catalog
    │   ├── resourceCatalog.public.json  # generated published-only catalog
    │   ├── projects.js        # verified projects (ALLI featured)
    │   ├── resources.js       # public catalog adapter and derived filters
    │   └── skills.js          # skill groups
    ├── hooks/                 # useReveal (scroll reveal + scroll-spy), useBodyScrollLock
    ├── lib/                   # contact.js (form submit), asset.js (public/ asset paths)
    └── styles/                # base, navbar-hero, sections, alli, journey, resources,
                               # contact-footer and upgrade art direction
tools/resource-studio/         # local-only owner UI; never imported by the public app
scripts/validate-resources.mjs # validates source catalog and generates public manifests
```

## Your portrait

Place your photo at **`public/img.jpeg`** (the shipped portrait) or **`public/img.png`** —
both are tried in that order.
The hero resolves it through `asset()`, so it also works when the site is hosted in a subfolder.

If neither file exists, the hero shows a clean `TS — Portrait coming soon` fallback instead of a
broken image or a placeholder avatar.

## Episode cover artwork

Posters live in **`public/images/content/`** and are referenced from `src/data/alliVideos.js`
(`poster: "images/content/part-01.webp"`). Cards show the cover in a 5:6 frame; the modal shows
it as a 16:9 preview. If a poster path is missing, the card falls back to the episode number
instead of a broken image.

## Contact form setup (Web3Forms)

Messages are delivered by [Web3Forms](https://web3forms.com)
(free tier, 250 submissions/month, no server-side code). The site also shows the email address
directly so visitors can write without the form:

1. Create a free access key at [web3forms.com](https://web3forms.com) (one-click signup, no form
   to build — the key is a client-side publish key by design).
2. Copy `.env.example` → `.env` and set:

   ```bash
   VITE_WEB3FORMS_ACCESS_KEY=your_access_key_here
   ```

3. Restart the dev server / rebuild. `.env` is gitignored, so the key never lands in the repo.

The form includes client-side validation plus an invisible honeypot field for basic spam
prevention. Without a key the form still validates, then shows the standard
*MESSAGE COULD NOT BE SENT* state.

## Editing content (all data-driven)

| What to change | File |
|---|---|
| Add or edit a resource | Run `npm run studio` — add files, edit details, reorder, preview, then export or save to the repository |
| Change the roadmap | `src/data/alliRoadmap.js` — `HISTORY` (built, up to v0.6) and `PLANNED` (future, v0.7 → v1.0) |
| Architecture flow steps | `src/data/alliArchitecture.js` — keep the USER → RESPONSE order honest |
| Projects, journey, skills, social URLs, nav | `src/data/projects.js`, `journey.js`, `skills.js`, `site.js` |
| Resource source of truth | `src/data/resourceCatalog.json` — normally changed by Resource Studio, not by hand |
| Generated public manifests | `src/data/resourceCatalog.public.json`, `public/assets/resources/resources.json` — regenerated by `npm run validate:resources` |

**Honesty rules (please keep):**

- `src/data/alliRoadmap.js` is the single source of truth. **v0.6 must stay `status: "current"`**
  (shown as *CURRENT DEVELOPMENT*), the timeline must stop there, and planned versions belong in
  `PLANNED` only — never styled or labelled as shipped.
- The ALLI scene and architecture diagram are visualizations of a local Python project. Keep the
  "not live telemetry / not connected to this website" wording.
- Don't invent GitHub or live-demo URLs — only link what actually exists.

**Video link rules:** each episode's Instagram and YouTube URLs must never be swapped.

## Resource Studio workflow

The public portfolio never contains admin controls. Resource management runs as a separate local
tool:

```bash
npm run studio
```

Then open `http://127.0.0.1:4174`.

1. Drop a PDF, prompt file, note or cover image into the Studio.
2. Select the new draft and use **Edit Details** to change its display title, description,
   category, tags, cover and visibility. The display title is separate from the real filename.
3. Use the grip to drag rows, or use **Move Up** / **Move Down** for keyboard-accessible ordering.
4. Preview the file, then click **Export for Website**. The Studio validates IDs, categories, paths,
   file types, file references and public visibility before creating a ZIP overlay package.
5. Review the package, copy it into the repository, run `npm run build`, inspect `dist/`, and use
   the existing GitHub Pages deployment process. Nothing is published by the Studio itself.

The Studio keeps a recoverable draft in browser IndexedDB. This is only a local editing convenience,
not a publishing backend. **Save to repository** is available on localhost in browsers that support
the File System Access API; otherwise use the validated ZIP export. Existing files are not deleted
automatically, and imports download a catalog backup before replacing the local draft.

See `public/assets/resources/README.md` for the resource folder rules and package review checklist.

## SEO

- Title: `Tejsai | AI Builder & Developer — TS nextstep`
- Description: `I'm Tejsai, a student, developer and AI builder exploring AI, programming and
  technology while building projects like ALLI.`
- Open Graph / Twitter tags, favicon and `Person` JSON-LD in `index.html`.

## Accessibility & motion

- Semantic landmarks, skip link, labelled form fields with inline errors
- Modal: focus trap, Esc, backdrop click, focus restoration, scroll lock, poster preview
- Mobile menu: hamburger ↔ X animation, focus trap, Esc, `aria-expanded`
- Architecture diagram: keyboard-focusable steps, `aria-live` detail panel
- Scene motion pauses when off-screen and fully stops under `prefers-reduced-motion`
- No horizontal overflow from 360px up to 1920px

## Deploying

Build produces a self-contained `dist/index.html` plus the required public asset folders such as
`dist/images/` and `dist/assets/resources/` (`base: "./"` + inlined JS/CSS, so it works from any
path or static host):

```bash
npm run build
```

- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, output dir `dist`
- **GitHub Pages**: push the repo, run the build in CI and publish `dist/`
  (for a project site served from a subpath the relative base already handles asset URLs)

## Verification

The repository has no checked-in browser test runner, lint script or typecheck script. The
smallest reproducible production check is:

```bash
npm run build
```

For resource-specific maintenance and manual checks, see
`public/assets/resources/README.md`. The resource UI uses local catalog data and relative asset
paths, so it does not need a backend or API key to search, filter or open published material.
