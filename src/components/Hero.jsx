import { useState } from "react";
import { SITE } from "../data/site";
import { asset } from "../lib/asset";
import { ArrowRight, CoreIcon } from "./icons";

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const PORTRAIT_FILES = ["img.jpeg", "img.png"];

export default function Hero() {
  const [imgIndex, setImgIndex] = useState(0);
  const imgMissing = imgIndex >= PORTRAIT_FILES.length;

  return (
    <section className="hero" id="home" aria-label="Introduction">
      <div className="hero-inner">
        <div className="hero-copy-col">
          <span className="hero-badge">
            <span className="dot" aria-hidden="true" />
            Currently building ALLI
          </span>

          <h1 className="hero-title">
            <span className="line">
              <span>Building My Future,</span>
            </span>
            <span className="line">
              <span className="accent">One Project at a Time.</span>
            </span>
          </h1>

          <p className="hero-copy">
            I'm Tejsai, a Diploma CSE student exploring AI, programming and web development by
            building real things.
          </p>

          <ul className="hero-roles" aria-label="Roles">
            {SITE.roles.map((role) => (
              <li key={role}>{role}</li>
            ))}
          </ul>

          <div className="hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => scrollTo("work")}>
              Explore my work
              <ArrowRight />
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => scrollTo("alli")}>
              <CoreIcon />
              Meet ALLI
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => scrollTo("contact")}>
              Let's connect
            </button>
          </div>

          <dl className="hero-stats">
            <div className="hero-stat">
              <dt className="lbl">Current build</dt>
              <dd className="num">
                <em>v0.6</em> ALLI
              </dd>
            </div>
            <div className="hero-stat">
              <dt className="lbl">Episodes</dt>
              <dd className="num">08</dd>
            </div>
            <div className="hero-stat">
              <dt className="lbl">Focus</dt>
              <dd className="num">Local AI</dd>
            </div>
          </dl>
        </div>

        <div className="hero-portrait">
          <div className="portrait-stage" aria-hidden="true">
            <span className="portrait-glow" />
            <span className="orbit-ring ring-a" />
            <span className="orbit-ring ring-b" />
            <span className="float-label label-1">PYTHON</span>
            <span className="float-label label-2">OLLAMA · LOCAL</span>
            <span className="float-label label-3">QWEN</span>
          </div>

          <div className="portrait-frame">
            {!imgMissing ? (
              <img
                key={PORTRAIT_FILES[imgIndex]}
                src={asset(PORTRAIT_FILES[imgIndex])}
                alt="Tejsai Malla — Diploma CSE student building ALLI, a personal AI assistant"
                width={760}
                height={950}
                loading="eager"
                decoding="async"
                onError={() => setImgIndex((i) => i + 1)}
              />
            ) : (
              <div className="portrait-fallback">
                <span className="initials" aria-hidden="true">
                  TS
                </span>
                <span className="hint">Portrait coming soon</span>
              </div>
            )}
          </div>

          <span className="brand-chip">
            <span className="brand-chip-mark" aria-hidden="true">
              TS
            </span>
            TS nextstep
          </span>

          <aside className="alli-status" aria-label="ALLI project status summary">
            <header>
              <span className="alli-status-name">ALLI</span>
              <span className="alli-status-version">v0.6 · in development</span>
            </header>
            <dl>
              <div>
                <dt>Runtime</dt>
                <dd>Python</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>Qwen via Ollama</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>v0.5 embeddings</dd>
              </div>
            </dl>
            <p className="alli-status-note">Static project summary — not live telemetry.</p>
          </aside>
        </div>
      </div>

      <a
        className="hero-scroll"
        href="#about"
        onClick={(e) => {
          e.preventDefault();
          scrollTo("about");
        }}
        aria-label="Scroll to the about section"
      >
        Scroll
        <span className="bar" aria-hidden="true" />
      </a>
    </section>
  );
}
