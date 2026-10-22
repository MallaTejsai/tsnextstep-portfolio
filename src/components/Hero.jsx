import { useRef, useState } from "react";
import { SITE } from "../data/site";
import { ALLI_VIDEOS } from "../data/alliVideos";
import { SKILL_GROUPS } from "../data/skills";
import { asset } from "../lib/asset";
import { scrollToId } from "../lib/scroll";
import { usePointerLight } from "../lib/usePointerLight";
import { ArrowRight, ArrowUpRight, CoreIcon } from "./icons";

const PORTRAIT_FILES = ["img.jpeg", "img.png"];

export default function Hero() {
  const [imgIndex, setImgIndex] = useState(0);
  const imgMissing = imgIndex >= PORTRAIT_FILES.length;

  const heroRef = useRef(null);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const labelsRef = useRef(null);

  usePointerLight(heroRef, {
    onFrame: (x, y) => {
      const dx = x - 0.5;
      const dy = y - 0.5;
      const stage = stageRef.current;
      const frame = frameRef.current;
      const labels = labelsRef.current;
      if (stage) {
        stage.style.transform = `translate3d(${(-dx * 20).toFixed(2)}px, ${(-dy * 13).toFixed(2)}px, 0)`;
      }
      if (frame) {
        frame.style.transform = `perspective(1100px) rotateY(${(dx * 4.5).toFixed(
          2
        )}deg) rotateX(${(-dy * 3.5).toFixed(2)}deg) translate3d(${(dx * 5).toFixed(2)}px, ${(
          dy * 4
        ).toFixed(2)}px, 0)`;
      }
      if (labels) {
        labels.style.translate = `${(-dx * 15).toFixed(2)}px ${(-dy * 10).toFixed(2)}px`;
      }
    },
  });

  return (
    <section className="hero" id="home" aria-label="Introduction" ref={heroRef}>
      <div className="hero-inner">
        <div className="hero-copy-col">
          <div className="hero-kicker-row">
            <span className="hero-badge">
              <span className="dot" aria-hidden="true" />
              Student → Builder → AI developer
            </span>
            <span className="hero-index">01 / TS NEXTSTEP</span>
          </div>

          <h1 className="hero-title">
            <span className="line">
              <span>Learning in public.</span>
            </span>
            <span className="line">
              <span>Building what's next.</span>
            </span>
          </h1>

          <p className="hero-copy">
            I'm Tejsai — a Diploma CSE student exploring Python, AI, web development and creative
            technology by making real projects, sharing what I discover and turning useful notes
            into resources for other learners.
          </p>

          <ul className="hero-roles" aria-label="Roles">
            {SITE.roles.map((role) => (
              <li key={role}>{role}</li>
            ))}
          </ul>

          <div className="hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => scrollToId("work")}>
              Explore my work
              <ArrowRight />
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => scrollToId("resources")}>
              Open the toolkit
              <ArrowUpRight />
            </button>
            <button className="hero-text-link" type="button" onClick={() => scrollToId("alli")}>
              <CoreIcon />
              See the ALLI thread
            </button>
          </div>

          <dl className="hero-stats">
            <div className="hero-stat">
              <dt className="lbl">Public build notes</dt>
              <dd className="num"><em>{String(ALLI_VIDEOS.length).padStart(2, "0")}</em> episodes</dd>
            </div>
            <div className="hero-stat">
              <dt className="lbl">Learning areas</dt>
              <dd className="num"><em>{String(SKILL_GROUPS.length).padStart(2, "0")}</em> in motion</dd>
            </div>
            <div className="hero-stat">
              <dt className="lbl">Current thread</dt>
              <dd className="num">ALLI <em>v0.6</em></dd>
            </div>
          </dl>
        </div>

        <div className="hero-portrait">
          <div className="portrait-stage" ref={stageRef} aria-hidden="true">
            <span className="portrait-glow" />
            <span className="orbit-ring ring-a" />
            <span className="orbit-ring ring-b" />
          </div>

          <div className="portrait-frame" ref={frameRef}>
            {!imgMissing ? (
              <img
                key={PORTRAIT_FILES[imgIndex]}
                src={asset(PORTRAIT_FILES[imgIndex])}
                alt="Tejsai Malla — Diploma CSE student and TS nextstep creator"
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

          <div className="portrait-labels" ref={labelsRef} aria-hidden="true">
            <span className="float-label label-1">PYTHON / AI</span>
            <span className="float-label label-2">TS NEXTSTEP</span>
            <span className="float-label label-3">MAKE + SHARE</span>
          </div>

          <span className="brand-chip">
            <span className="brand-chip-mark" aria-hidden="true">
              TS
            </span>
            TS nextstep
          </span>

          <aside className="alli-status liquid" aria-label="ALLI project status summary">
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
            <p className="alli-status-note">A project snapshot — not live telemetry.</p>
          </aside>
        </div>
      </div>

      <a
        className="hero-scroll"
        href="#about"
        onClick={(e) => {
          e.preventDefault();
          scrollToId("about");
        }}
        aria-label="Scroll to the about section"
      >
        Scroll
        <span className="bar" aria-hidden="true" />
      </a>
    </section>
  );
}
