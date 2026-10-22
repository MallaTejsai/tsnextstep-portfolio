# TS nextstep resource directory

This folder is the public output for the portfolio's resource catalog. Manage
resources through the local Resource Studio instead of editing this JSON by
hand:

```bash
npm run studio
```

The owner catalog is `src/data/resourceCatalog.json`. The validation step
generates `src/data/resourceCatalog.public.json` and this folder's
`resources.json`, including only records marked `published: true`.

## Folder map

```text
public/assets/resources/
├── pdfs/          # public PDF files
├── prompt-packs/  # optional .md/.txt prompt packs
├── covers/        # real cover images only
├── notes/         # public Markdown/text notes
├── resources.json # static catalog mirror
└── README.md
```

## Add a PDF

1. Put the final, public PDF in `pdfs/`.
2. Confirm that it contains no private information, secrets or unpublished
   material.
3. Open Resource Studio, drop the PDF, edit its details, choose a category and
   tags, and publish it only when the file is ready for visitors.
4. Click **Save Changes**. The loopback bridge chooses a safe path such as
   `assets/resources/pdfs/python-notes.pdf`, detects filename conflicts, validates
   the canonical catalog and regenerates both public manifests. Published files go
   to `public/`; unpublished files stay under ignored `.resource-studio/drafts/`.
5. Use **Export ZIP** as a recovery option, then run `npm run build`. The build refuses to continue if a published file is
   missing or a path, ID, category or display order is invalid. It also moves
   stale managed files out of `public/` into the local `.resource-studio/trash/`
   recovery area so an unpublished draft cannot ship accidentally.

The download UI renders only records with a real `filePath`; missing files are
never presented as working downloads.

## Add a prompt or prompt pack

1. Put a public Markdown or text file in `prompt-packs/` when a downloadable
   pack is useful.
2. Open Resource Studio and choose **Add Prompt**, or drop the file and edit its
   prompt text in the editor.
3. Publish only after reviewing the exact text visitors will copy. The Studio
   registers a `filePath` only when the prompt-pack file exists.
4. Do not add a prompt just because it sounds useful: publish only prompts you
   have written or explicitly approved. Do not claim that a prompt was tested
   unless that is documented truthfully.

Prompt records automatically receive an expandable detail view and a
Clipboard API copy button with a fallback. Copy feedback is shown only after
the copy operation succeeds; failures remain visible as failures.

## Categories, tags and covers

- Reuse a clear category instead of creating near-duplicates. Categories and
  tags are searchable in the Resource Hub.
- Keep tags short and factual (`Python`, `embeddings`, `web development`).
- Store only real cover art in `covers/`; do not create a decorative cover that
  misrepresents a document.
- Keep `src/data/resourceCatalog.json` as the single authoring source. Do not
  edit the generated public JSON mirrors manually.

## Verify locally

From the repository root:

```bash
npm install
npm run dev
```

Open the Studio URL, search for the new title, filter by its type, edit and
preview it, try Move Up / Move Down, then save through the local bridge. Use ZIP
export as a recovery option and run:

```bash
npm run build
npm run verify
npm run preview
```

The Vite build uses `base: "./"`, so resource paths remain relative when the
site is served from a GitHub Pages project subpath or from the built `dist/`
folder. Review `dist/assets/resources/` as well as `dist/index.html`; the
downloadable files are not inlined into the HTML.

## Publish updates

The existing project currently publishes a static Vite build to GitHub Pages
without a checked-in GitHub Actions workflow. Build with `npm run build`,
inspect the complete `dist/` tree, and follow the repository's existing
deployment process for the `gh-pages` branch. Do not push or publish changes
without explicit approval. The Studio never commits, pushes or deploys.
