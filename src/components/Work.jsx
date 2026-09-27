import { useRef } from "react";
import { PROJECTS } from "../data/projects";
import Reveal from "./Reveal";
import { ArrowUpRight } from "./icons";

function ProjectCard({ project, index }) {
  const cardRef = useRef(null);

  const onMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  const onClick = () => {
    if (!project.href || project.href === "#") return;
    const id = project.href.replace("#", "");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Reveal delay={index * 0.06}>
      <article
        ref={cardRef}
        className="project-card"
        onMouseMove={onMove}
        data-featured={project.featured ? "true" : undefined}
      >
        <div className="project-top">
          <span className="project-index">
            {String(index + 1).padStart(2, "0")} / PROJECT
          </span>
          <span className={`chip${project.featured ? " chip-live" : ""}`}>{project.status}</span>
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

        {project.href && project.href !== "#" ? (
          <div className="project-cta">
            <button className="btn btn-ghost" type="button" onClick={onClick}>
              {project.cta}
              <ArrowUpRight />
            </button>
          </div>
        ) : null}
      </article>
    </Reveal>
  );
}

export default function Work() {
  return (
    <section className="section" id="work" aria-labelledby="work-title">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">What I'm building</span>
          <h2 className="section-title" id="work-title">
            Projects in <span className="accent">motion</span>
          </h2>
          <p className="section-lead">
            A snapshot of what I'm actively building and learning from. ALLI is the flagship —
            more projects will be listed here as they take shape.
          </p>
        </Reveal>

        <div className="work-grid">
          {PROJECTS.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>

        <Reveal className="work-note" delay={0.1}>
          More projects are in progress — this section will grow as they do.
        </Reveal>
      </div>
    </section>
  );
}
