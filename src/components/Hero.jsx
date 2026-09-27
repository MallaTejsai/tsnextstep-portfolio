import { useState } from "react";
import { asset } from "../lib/asset";
import { ArrowRight, PlayIcon } from "./icons";

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
            Tejsai / TS nextstep
          </span>

          <h1 className="hero-title">
            <span className="line">
              <span>Building AI.</span>
            </span>
            <span className="line">
              <span>Learning by building.</span>
            </span>
            <span className="line">
              <span className="accent">Sharing the journey.</span>
            </span>
          </h1>

          <p className="hero-copy">
            I'm Tejsai — a student, developer and AI builder exploring AI, programming and
            technology while documenting what I build.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => scrollTo("work")}>
              EXPLORE MY WORK
              <ArrowRight />
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => scrollTo("journey")}>
              <PlayIcon />
              WATCH MY JOURNEY
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
              <dt className="lbl">Roadmap</dt>
              <dd className="num">
                38<em>+</em> versions
              </dd>
            </div>
            <div className="hero-stat">
              <dt className="lbl">Episodes published</dt>
              <dd className="num">
                8<em>+</em>
              </dd>
            </div>
          </dl>
        </div>

        <div className="hero-portrait">
          <div className="portrait-ring" aria-hidden="true" />
          <div className="portrait-frame">
            {!imgMissing ? (
              <img
                key={PORTRAIT_FILES[imgIndex]}
                src={asset(PORTRAIT_FILES[imgIndex])}
                alt="Tejsai — student, developer and AI builder"
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
          <span className="portrait-tag">Student · Developer · AI Builder</span>
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
