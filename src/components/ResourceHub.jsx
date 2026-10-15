import { useId, useMemo, useState } from "react";

import {
  RESOURCE_CATEGORIES,
  RESOURCE_TYPES,
  RESOURCES,
} from "../data/resources";
import { asset } from "../lib/asset";
import "../styles/resources.css";

function ExternalArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
      <path d="M5 3h8v8M13 3 7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 9.5V13H3V5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <circle cx="8.75" cy="8.75" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.7 12.7 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="m4.5 10.5 3.4 3.4L15.7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResourcePoster({ resource, featured = false }) {
  const [failed, setFailed] = useState(false);
  const poster = resource.cover || resource.poster;

  return (
    <div className={`resource-poster${featured ? " resource-poster-featured" : ""}`}>
      {!failed && poster ? (
        <img
          src={asset(poster)}
          alt={`${resource.title} — cover artwork for the ALLI build series`}
          width="1000"
          height="1200"
          loading={featured ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : null}
      <span
        className={`resource-poster-fallback${failed || !poster ? " is-visible" : ""}`}
        aria-hidden="true"
      >
        {resource.number || "TS"}
      </span>
      <span className="resource-poster-number" aria-hidden="true">
        {resource.number || "FILE"}
      </span>
    </div>
  );
}

function PlatformLink({ label, url, resource }) {
  if (!url) return null;

  return (
    <a
      className={`resource-platform-link resource-platform-${label.toLowerCase()}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}: ${resource.title}`}
    >
      <span>{label}</span>
      <ExternalArrow />
    </a>
  );
}

function ResourceCard({ resource }) {
  return (
    <article className="resource-card">
      <ResourcePoster resource={resource} />
      <div className="resource-card-body">
        <div className="resource-card-meta">
          <span className="resource-kind">{resource.kind === "episode" ? `Episode ${resource.number}` : resource.type}</span>
          <span className="resource-series">{resource.category}</span>
        </div>
        <h3>{resource.title}</h3>
        <p>{resource.description}</p>
        {resource.tags?.length ? (
          <ul className="resource-tags" aria-label={`${resource.title} tags`}>
            {resource.tags.slice(0, 3).map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        ) : null}
        <div className="resource-card-links" role="group" aria-label={`Open ${resource.title}`}>
          <PlatformLink label="YouTube" url={resource.youtubeUrl} resource={resource} />
          <PlatformLink label="Instagram" url={resource.instagramUrl} resource={resource} />
          {resource.filePath ? (
            <a className="resource-platform-link resource-platform-download" href={asset(resource.filePath)} download aria-label={`Download ${resource.title}`}>
              <span>{resource.kind === "pdf" ? "Download PDF" : "Download"}</span>
              <DownloadIcon />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size not listed";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function copyWithFallback(text) {
  if (!text) throw new Error("There is no prompt text to copy.");

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy textarea path for older or restricted contexts.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand?.("copy") || false;
  textarea.remove();

  if (!copied) throw new Error("Copy is not available in this browser.");
}

function PromptCard({ prompt }) {
  const [copyState, setCopyState] = useState("idle");

  const onCopy = async () => {
    setCopyState("copying");
    try {
      await copyWithFallback(prompt.promptText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("error");
    }
  };

  return (
    <article className="prompt-card">
      <div className="prompt-card-top">
        <span className="resource-kind">{prompt.category}</span>
        <span className="prompt-card-mark">PROMPT</span>
      </div>
      <h4>{prompt.title}</h4>
      <p>{prompt.description}</p>
      <details className="prompt-details">
        <summary>View prompt</summary>
        <pre>{prompt.promptText}</pre>
      </details>
      <div className="prompt-card-actions">
        <button className="resource-action resource-action-primary" type="button" onClick={onCopy} disabled={copyState === "copying"}>
          {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
          {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy prompt"}
        </button>
        <span className={`prompt-copy-feedback${copyState === "error" ? " is-error" : ""}`} role="status" aria-live="polite">
          {copyState === "error" ? "Select the prompt text to copy it manually." : ""}
        </span>
      </div>
    </article>
  );
}

function DownloadCard({ resource }) {
  if (!resource.filePath) return null;
  const href = asset(resource.filePath);

  return (
    <article className="download-card">
      <span className="download-card-icon"><DownloadIcon /></span>
      <div>
        <div className="resource-card-meta">
          <span className="resource-kind">{resource.type || "FILE"}</span>
          <span className="resource-series">{formatSize(resource.fileSize)}</span>
        </div>
        <h4>{resource.title}</h4>
        <p>{resource.description}</p>
        <div className="download-actions">
          <a className="resource-action resource-action-primary" href={href} download>
            <DownloadIcon />
            Download
          </a>
          {resource.type === "pdf" || resource.kind === "pdf" ? <a className="resource-action resource-action-secondary" href={asset(resource.viewPath || resource.filePath)} target="_blank" rel="noopener noreferrer">View PDF</a> : resource.viewPath ? <a className="resource-action resource-action-secondary" href={asset(resource.viewPath)} target="_blank" rel="noopener noreferrer">View file</a> : null}
        </div>
      </div>
    </article>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="resource-filter-group" aria-label={label} role="group">
      <span className="resource-filter-label">{label}</span>
      <div className="resource-filter-options">
        {options.map((option) => (
          <button
            className="resource-filter-button"
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyToolkitCard({ kind, title, description, anchor }) {
  return (
    <article className={`toolkit-card toolkit-card-${kind}`} id={anchor}>
      <div className="toolkit-card-heading">
        <span className="toolkit-card-kicker">{kind === "prompts" ? "AI Prompt Vault" : "PDF & Downloads"}</span>
        <span className="toolkit-card-count">Coming next</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="toolkit-empty-note">
        <span aria-hidden="true">—</span>
        <span>No public {kind === "prompts" ? "prompts" : "downloadable files"} are registered yet.</span>
      </div>
    </article>
  );
}

/**
 * Resource hub for verified local content. The index is intentionally local:
 * browsing, filtering and search do not need a backend or external API.
 */
export default function ResourceHub({ resources = RESOURCES }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");

  const publishedResources = resources.filter((resource) => resource.published === true);
  const featuredResource = publishedResources.find((resource) => resource.featured) || publishedResources[0];
  const promptResources = publishedResources.filter((resource) => resource.kind === "prompt");
  const downloadResources = publishedResources.filter((resource) => resource.filePath && ["pdf", "note", "prompt"].includes(resource.kind));

  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return publishedResources.filter((resource) => {
      const searchable = [
        resource.title,
        resource.description,
        resource.series,
        resource.category,
        ...(resource.tags || []),
        resource.number,
      ].filter(Boolean).join(" ").toLowerCase();

      return (
        (type === "all" || resource.kind === type) &&
        (category === "all" || resource.categoryId === category) &&
        (!normalizedQuery || searchable.includes(normalizedQuery))
      );
    });
  }, [category, publishedResources, query, type]);

  const hasFilters = Boolean(query.trim()) || type !== "all" || category !== "all";
  const resetFilters = () => {
    setQuery("");
    setType("all");
    setCategory("all");
  };

  return (
    <section className="resource-hub section section-alt" id="resources" aria-labelledby="resources-title">
      <div className="container resource-hub-container">
        <header className="resource-hub-header">
          <div>
            <span className="eyebrow">Resources &amp; Digital Toolkit</span>
            <h2 className="section-title" id="resources-title">
              Useful things to <span className="accent">take away.</span>
            </h2>
            <p className="section-lead">
              Useful prompts, guides, notes and downloads from my learning journey — starting with
              the verified TS nextstep build notes already published in public.
            </p>
          </div>
          <p className="resource-hub-count" aria-live="polite">
            <strong>{filteredResources.length}</strong>
            <span>of {publishedResources.length} public resources shown</span>
          </p>
        </header>

        {featuredResource ? (
          <article className="resource-featured">
            <ResourcePoster resource={featuredResource} featured />
            <div className="resource-featured-copy">
              <span className="resource-featured-kicker">Featured field note · {featuredResource.series}</span>
              <h3>{featuredResource.title}</h3>
              <p>{featuredResource.description}</p>
              <div className="resource-featured-meta">
                <span>{featuredResource.category}</span>
                <span>{featuredResource.tags?.slice(0, 2).join(" · ")}</span>
              </div>
              <div className="resource-card-links">
                <PlatformLink label="YouTube" url={featuredResource.youtubeUrl} resource={featuredResource} />
                <PlatformLink label="Instagram" url={featuredResource.instagramUrl} resource={featuredResource} />
                <a className="resource-text-link" href="#resources-library">Search the library <ExternalArrow /></a>
              </div>
            </div>
          </article>
        ) : null}

        <div className="resource-library" id="resources-library">
          <div className="resource-library-heading">
            <div>
              <span className="eyebrow">The library</span>
              <h3>Find a useful <span className="accent">starting point.</span></h3>
            </div>
            <p>Search actual titles, descriptions, categories and tags — not just visual placeholders.</p>
          </div>

          <div className="resource-controls">
            <div className="resource-search">
              <label className="sr-only" htmlFor={searchId}>Search resources</label>
              <span className="resource-search-icon"><SearchIcon /></span>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, tag or topic…"
                autoComplete="off"
              />
              {query ? <button type="button" className="resource-search-clear" onClick={() => setQuery("")} aria-label="Clear resource search">×</button> : null}
            </div>
            <div className="resource-filter-row">
              <FilterGroup label="Format" options={RESOURCE_TYPES} value={type} onChange={setType} />
              <FilterGroup label="Category" options={RESOURCE_CATEGORIES} value={category} onChange={setCategory} />
              {hasFilters ? <button className="resource-reset resource-reset-inline" type="button" onClick={resetFilters}>Reset all</button> : null}
            </div>
          </div>

          {filteredResources.length ? (
            <div className="resource-grid">
              {filteredResources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}
            </div>
          ) : (
            <div className="resource-empty" role="status">
              <span className="resource-empty-mark" aria-hidden="true">—</span>
              <h3>No matching resources</h3>
              <p>Try a different search or reset the filters to return to the full verified collection.</p>
              {hasFilters ? <button className="resource-reset" type="button" onClick={resetFilters}>Reset filters</button> : null}
            </div>
          )}
        </div>

        <div className="resource-toolkit-heading">
          <span className="eyebrow">More soon, only when real</span>
          <h3>Prompt Library <span className="accent">+ downloads.</span></h3>
          <p>These shelves are wired for future material without pretending that unpublished files exist.</p>
        </div>
        <div className="resource-toolkit-grid">
          {promptResources.length ? promptResources.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />) : (
            <EmptyToolkitCard
              kind="prompts"
              anchor="prompt-library"
              title="Prompt Library"
              description="A focused place for practical coding, learning and creative prompts. Prompts will appear here only after they are approved for publication."
            />
          )}
          {downloadResources.length ? downloadResources.map((resource) => <DownloadCard key={resource.id} resource={resource} />) : (
            <EmptyToolkitCard
              kind="downloads"
              anchor="download-center"
              title="PDF & Download Center"
              description="A clean home for public notes, guides and PDFs. No PDF or downloadable learning file was present in the audited repository yet."
            />
          )}
        </div>

        <p className="resource-maintenance-note">
          Future public material is prepared through the local Resource Studio. Missing files are
          never presented as downloadable.
        </p>
      </div>
    </section>
  );
}
