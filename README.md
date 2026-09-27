# Tejsai / TS nextstep — Portfolio

Premium black + red portfolio site for **Tejsai (TS nextstep)** — student, developer, AI builder
and content creator. Built with **React + Vite**, fully data-driven, mobile-first and accessible.

- Flagship project: **ALLI** (personal AI assistant, currently **v0.6 — current development**)
- Public ALLI roadmap: **10 milestones, v0.1 → v1.0** (a scroll-driven journey that stops at
  v0.6; nothing beyond v1.0 is ever shown publicly)
- Video series library: **8 episodes**, each opening a platform picker (YouTube / Instagram)
- Contact form via **Web3Forms** with validation and sending/success/error states (no email
  address is exposed anywhere on the site)

---

## Quick start

```bash
npm install          # if esbuild's postinstall was skipped: node node_modules/esbuild/install.js
npm run dev          # dev server → http://localhost:5173
npm run build        # production build → dist/ (one self-contained index.html)
npm run preview      # serve the production build locally
```

**Opening from disk:** `npm run build` inlines all JS and CSS into a single
`dist/index.html`, so you can double-click that file and the site just works (no server
needed). Double-clicking the *source* `index.html` redirects you to `dist/index.html`
automatically — the source entry only runs through `npm run dev`.

## Project structure

```
portfolio/
├── index.html                 # title, meta description, fonts, JSON-LD
├── vite.config.js             # React plugin, relative base
├── .env.example               # VITE_WEB3FORMS_ACCESS_KEY template
├── public/
│   ├── favicon.svg
│   └── img.png                # ← drop your portrait here (see below)
└── src/
    ├── main.jsx               # entry + style imports
    ├── App.jsx                # section composition
    ├── components/            # Navbar, Hero, About, Work, Alli, Journey, Skills,
    │                          # Content, Contact, Footer, VideoCard, VideoModal, Reveal, icons
    ├── data/
    │   ├── alliRoadmap.js     # public roadmap v0.1 → v1.0 (10 milestones, v0.6 current)
    │   ├── alliVideos.js      # 8 episodes with exact IG/YT links
    │   ├── projects.js        # "What I'm building" cards
    │   ├── skills.js          # skill groups
    │   ├── contentTopics.js   # content pillars
    │   └── site.js            # identity, social links, nav
    ├── hooks/                 # useReveal (scroll reveal + scroll-spy), useBodyScrollLock
    ├── lib/                   # contact.js (form submit), asset.js (public/ asset paths)
    └── styles/                # base, navbar-hero, sections, alli, journey, contact-footer
```

## Your portrait

Place your photo at **`public/img.jpeg`** (the shipped portrait) or **`public/img.png`** —
both are tried in that order.
The hero resolves it through `asset()`, so it also works when the site is hosted in a subfolder.

If neither file exists, the hero shows a clean `TS — Portrait coming soon` fallback instead of a
broken image or a placeholder avatar.

## Contact form setup (Web3Forms)

The site never shows an email address. Messages are delivered by [Web3Forms](https://web3forms.com)
(free tier, 250 submissions/month, no server-side code):

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
| Add an episode (Part 8, 9, …) | `src/data/alliVideos.js` — append an object; cards, counter and modal update automatically |
| Change a roadmap version | `src/data/alliRoadmap.js` — keep `version`, `title`, `summary`, `status` (`past` \| `current` \| `future`) |
| Add Project 2 / 3 / 4 | `src/data/projects.js` — uncomment the example block |
| Skills, content pillars, social URLs, nav | `src/data/skills.js`, `src/data/contentTopics.js`, `src/data/site.js` |

**Roadmap rules:** `src/data/alliRoadmap.js` is the single source of truth and is **public scope
only: v0.1 → v1.0** — never add versions beyond v1.0, and never mention them anywhere on the
site. Capabilities must not move between versions, and **v0.6 must stay `status: "current"`**
(shown as *CURRENT DEVELOPMENT*, never as completed/finished/released). The timeline's red line
stops at v0.6 by design.

**Video link rules:** each episode's Instagram and YouTube URLs must never be swapped — the test
suite verifies all 8 pairs.

## SEO

- Title: `Tejsai | AI Builder & Developer — TS nextstep`
- Description: `I'm Tejsai, a student, developer and AI builder exploring AI, programming and
  technology while building projects like ALLI.`
- Open Graph / Twitter tags, favicon and `Person` JSON-LD in `index.html`.

## Accessibility & motion

- Semantic landmarks, skip link, labelled form fields with inline errors
- Modal: focus trap, Esc, backdrop click, focus restoration, scroll lock
- Mobile menu: hamburger ↔ X animation, focus trap, Esc, `aria-expanded`
- axe-core: **0 violations**
- All animation respects `prefers-reduced-motion`

## Deploying

Build is a single self-contained `dist/index.html` (`base: "./"` + inlined assets, so it works
from any path, any host, or straight from disk):

```bash
npm run build
```

- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, output dir `dist`
- **GitHub Pages**: push the repo, run the build in CI and publish `dist/`
  (for a project site served from a subpath the relative base already handles asset URLs)

## Verification

The repo was verified with:

- static checks: identity, public roadmap exactly v0.1 → v1.0 (no version beyond v1.0 anywhere),
  v0.6 current-not-completed, all 8 episode link pairs, nav, form fields, Web3Forms config,
  no exposed email address or email links
- browser checks (Playwright): console/runtime errors, modal behaviour, form validation and
  sending/success/error states, scroll-driven roadmap fill (stops at v0.6), mobile menu, smooth
  scroll, no horizontal overflow at 320–1920px, axe-core 0 violations
