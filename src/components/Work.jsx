import { useRef } from "react";
import { PROJECTS } from "../data/projects";
import { ARCHITECTURE_FLOW } from "../data/alliArchitecture";
import Reveal from "./Reveal";
import { ArrowUpRight, ArrowRight } from "./icons";
import { scrollToId } from "../lib/scroll";
import { useTilt } from "../lib/useTilt";
import { usePointerLight } from "../lib/usePointerLight";

function ProjectCard({ project, index }) {
  const cardRef = useRef(null);
  const featured = Boolean(project.featured);
  useTilt(cardRef, { max: 7, lift: -8, enabled: featured });
  usePointerLight(cardRef);

  const onInternal = (e, href) => {
    e.preventDefault();
    const id = href.replace("#", "");
    scrollToId(id);
  };

  return (
    <Reveal delay={index * 0.06} className={featured ? "work-featured-wrap" : undefined}>
      <article
        ref={cardRef}
        className={`project-card${featured ? " project-featured" : ""}`}
        data-featured={featured ? "true" : undefined}
      >
        <div className="project-main">
          <div className="project-top">
            <span className="project-index">
              {String(index + 1).padStart(2, "0")} / PROJECT
            </span>
            <span className={`chip${project.statusTone === "live" ? " chip-live" : ""}`}>
              {project.status}
            </span>
          </div>

          <h3 className="project-title">{project.name}</h3>
          <p className="project-tagline">{project.tagline}</p>
          <p className="project-desc">{project.description}</p>

          <ul className="project-tags" aria-label={`${project.name} technologies`}>
            {project.tags.map((tag) => (
              <li className="project-tag" key={tag}>
                {tag}
              </li>
            ))}
          </ul>

          {project.links?.length ? (
            <div className="project-cta">
              {project.links.map((link) =>
                link.internal ? (
                  <button
                    key={link.label}
                    className="btn btn-ghost"
                    type="button"
                    onClick={(e) => onInternal(e, link.href)}
                  >
                    {link.label}
                    <ArrowRight />
                  </button>
                ) : (
                  <a
                    key={link.label}
                    className="btn btn-ghost"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                    <ArrowUpRight />
                  </a>
                )
              )}
            </div>
          ) : (
            <p className="project-note">Links will appear here when this is ready to share.</p>
          )}
        </div>

        {featured ? (
          <div className="project-mini">
            <ol className="mini-flow" aria-label="ALLI request path">
              {ARCHITECTURE_FLOW.map((node) => (
                <li key={node.id}>
                  <span>{node.label}</span>
                  <small>{node.role}</small>
                </li>
              ))}
            </ol>
            <p className="mini-flow-note">
              Local request path of the assistant — visualized in full inside the ALLI section.
            </p>
          </div>
        ) : null}
      </article>
    </Reveal>
  );
}

export default function Work() {
  const [featured, ...rest] = PROJECTS;

  return (
    <section className="section" id="work" aria-labelledby="work-title">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">What I'm building</span>
          <h2 className="section-title" id="work-title">
            Projects in motion
          </h2>
          <p className="section-lead">
            A snapshot of what I'm actively building and learning from. ALLI is the flagship —
            the rest grows alongside it.
          </p>
        </Reveal>

        {featured ? <ProjectCard project={featured} index={0} /> : null}

        <div className="work-grid">
          {rest.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
