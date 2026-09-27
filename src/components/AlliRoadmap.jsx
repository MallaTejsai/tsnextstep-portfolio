import { useEffect, useRef } from "react";
import { ALLI_ROADMAP, CURRENT_VERSION, ROADMAP_DISCLAIMER } from "../data/alliRoadmap";
import Reveal from "./Reveal";

const STATUS_LABEL = {
  past: "Earlier stage",
  current: "Current development",
  future: "Upcoming",
};

const CURRENT_INDEX = ALLI_ROADMAP.findIndex((v) => v.status === "current");
const HORIZONTAL_QUERY = "(min-width: 769px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/*
 * Reusable roadmap progress system (desktop + mobile):
 *
 *   geometry  — measure()  : node centers in journey content coordinates,
 *                axis distances (first node → v0.6 = stopDist), rail + stop tick.
 *   target    — computeTarget() : continuous 0→1 progress from the journey
 *                container's position relative to a viewport reference line.
 *                0 = line at the first node, 1 = line exactly at the v0.6 node
 *                center. Always clamped — the red line can never enter v0.7+.
 *   smoothing — a single requestAnimationFrame loop lerps current → target
 *                (factor 0.12; instant when prefers-reduced-motion), then
 *                writes the result straight to the DOM:
 *                  --roadmap-progress  →  fill size via CSS calc
 *                    desktop: width = progress * --roadmap-stop
 *                    mobile : height = progress * --roadmap-stop
 *                plus is-lit node classes. No React state on the scroll path.
 *
 * Scroll/resize handlers only flag `dirty` and schedule the one frame in
 * flight; getBoundingClientRect runs at most once per scheduled frame.
 */
export default function AlliRoadmap() {
  const journeyRef = useRef(null);
  const trackRef = useRef(null);
  const railRef = useRef(null);
  const fillRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(() => {
    const journey = journeyRef.current;
    const track = trackRef.current;
    const fill = fillRef.current;
    const stopMark = stopRef.current;
    const rail = railRef.current;
    if (!journey || !track || !fill || !rail) return;

    const mq = window.matchMedia(HORIZONTAL_QUERY);
    const reduceMq = window.matchMedia(REDUCED_QUERY);
    const items = Array.from(track.querySelectorAll(".rm-item"));
    const nodes = items.map((item) => item.querySelector(".rm-node"));

    let hz = mq.matches;
    let pts = []; // node centers, journey content coordinates
    let rel = []; // distance along the axis from the first node
    let stopDist = 0; // first node → v0.6 node center (the hard limit)
    let railLen = 0; // first node → last node
    let target = 0; // desired progress 0..1 (1 = v0.6)
    let current = 0; // smoothed progress 0..1
    let raf = 0;
    let dirty = true;
    let lit = items.map(() => false);
    let currentArmed = false;

    const axis = (p) => (hz ? p.x : p.y);

    /* ---- geometry: node centers in content coordinates, rail layout ---- */
    const measure = (snap) => {
      hz = mq.matches;
      const jr = journey.getBoundingClientRect();
      pts = items.map((item, i) => {
        const n = nodes[i];
        if (!n) return { x: 0, y: 0 };
        const nr = n.getBoundingClientRect();
        return {
          x: nr.left + nr.width / 2 - jr.left + journey.scrollLeft,
          y: nr.top + nr.height / 2 - jr.top + journey.scrollTop,
        };
      });
      if (!pts.length) return;

      const first = axis(pts[0]);
      rel = pts.map((p) => axis(p) - first);
      stopDist = Math.max(rel[CURRENT_INDEX] ?? rel[rel.length - 1], 1);
      railLen = Math.max(rel[rel.length - 1], stopDist);

      rail.style.left = `${pts[0].x}px`;
      rail.style.top = `${pts[0].y}px`;
      if (hz) {
        rail.style.width = `${railLen}px`;
        rail.style.height = "";
        if (stopMark) {
          stopMark.style.left = `${stopDist}px`;
          stopMark.style.top = "";
        }
      } else {
        rail.style.height = `${railLen}px`;
        rail.style.width = "";
        if (stopMark) {
          stopMark.style.top = `${stopDist}px`;
          stopMark.style.left = "";
        }
      }

      journey.style.setProperty("--roadmap-stop", `${stopDist}px`);

      dirty = false;
      computeTarget();
      if (snap) current = target; // orientation/layout-mode switch: re-anchor
      render();
      kick();
    };

    /* ---- continuous 0 → 1 progress from viewport position ---- */
    const computeTarget = () => {
      const rect = journey.getBoundingClientRect();
      const vh = window.innerHeight;
      let t;
      if (hz) {
        // Horizontal timeline: page scroll carries the journey up through the
        // viewport. The line starts as the section is reached and is fully at
        // v0.6 once it has settled into view — then stops for good.
        const startTop = vh * 0.9;
        let finishTop = vh * 0.18;
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
        const minTop = rect.top - Math.max(0, maxScroll - window.scrollY);
        // If the page cannot scroll the journey up to finishTop, finish at the
        // lowest reachable position instead so the line still reaches v0.6.
        if (minTop > finishTop) finishTop = Math.min(minTop, startTop - 1);
        const span = Math.max(startTop - finishTop, 1);
        t = (startTop - rect.top) / span;
      } else {
        // Vertical timeline: a reference line at 62% of the viewport travels
        // from the first node to the v0.6 node as the user scrolls.
        const ref = vh * 0.62;
        t = (ref - rect.top - pts[0].y) / stopDist;
      }
      target = Math.min(Math.max(t, 0), 1);
    };

    /* ---- apply progress to the DOM (direct writes, no React state) ---- */
    const render = () => {
      const pos = current * stopDist;
      journey.style.setProperty("--roadmap-progress", current.toFixed(5));
      fill.classList.toggle("is-active", pos > 2);

      for (let i = 0; i < items.length; i += 1) {
        const on = pos >= (rel[i] ?? Infinity) - 1;
        if (on !== lit[i]) {
          lit[i] = on;
          items[i].classList.toggle("is-lit", on);
        }
      }

      if (!currentArmed && CURRENT_INDEX >= 0 && pos >= stopDist - 1) {
        currentArmed = true;
        items[CURRENT_INDEX]?.classList.add("is-current-active");
      }
    };

    /* ---- one rAF loop at a time: lerp toward the target, then rest ---- */
    const tick = () => {
      raf = 0;
      if (dirty) {
        computeTarget();
        dirty = false;
      }
      const k = reduceMq.matches ? 1 : 0.12;
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.0015) current = target;
      render();
      if (current !== target || dirty) raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      dirty = true;
      kick();
    };

    /* ---- card reveals — Intersection Observer only ---- */
    let io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              io.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -6% 0px", threshold: 0.12 },
      );
      items.forEach((item) => io.observe(item));
    } else {
      items.forEach((item) => item.classList.add("is-in"));
    }

    const ro = "ResizeObserver" in window ? new ResizeObserver(() => measure(false)) : null;
    ro?.observe(track);

    const onMq = () => measure(true); // desktop ⇄ mobile: re-anchor geometry
    const onReduce = () => measure(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    mq.addEventListener?.("change", onMq);
    reduceMq.addEventListener?.("change", onReduce);
    document.fonts?.ready.then(() => measure(false)).catch(() => {});

    measure(true);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mq.removeEventListener?.("change", onMq);
      reduceMq.removeEventListener?.("change", onReduce);
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  const current = ALLI_ROADMAP.find((v) => v.status === "current");

  return (
    <div className="roadmap" id="roadmap">
      <Reveal className="roadmap-head">
        <div>
          <span className="eyebrow">ALLI · Public roadmap</span>
          <h2 className="section-title">
            From <span className="accent">v0.1</span> to <span className="accent">v1.0</span>
          </h2>
          <p className="section-lead">
            The public development journey of ALLI, my personal AI assistant — ten milestones from
            a basic chat loop to a personal PC assistant. Follow the line: development currently
            stops at {CURRENT_VERSION}.
          </p>
        </div>

        <div className="roadmap-legend" role="list" aria-label="Roadmap legend">
          <span className="legend-item" role="listitem">
            <span className="legend-swatch past" aria-hidden="true" /> Earlier stage
          </span>
          <span className="legend-item" role="listitem">
            <span className="legend-swatch current" aria-hidden="true" /> Current development
          </span>
          <span className="legend-item" role="listitem">
            <span className="legend-swatch future" aria-hidden="true" /> Upcoming
          </span>
        </div>
      </Reveal>

      <div
        className="rm-journey"
        ref={journeyRef}
        tabIndex={0}
        role="group"
        aria-label={`ALLI public roadmap timeline, v0.1 to v1.0. Scroll to travel through it. Current development milestone: ${CURRENT_VERSION}.`}
      >
        <div className="rm-rail" ref={railRef} aria-hidden="true">
          <span className="rm-rail-fill" ref={fillRef} />
          <span className="rm-rail-stop" ref={stopRef} />
        </div>

        <ol className="rm-track" ref={trackRef}>
          {ALLI_ROADMAP.map((item, i) => (
            <li
              className={`rm-item is-${item.status}`}
              key={item.id}
              data-version={item.version}
              data-status={item.status}
              style={{ "--reveal-delay": `${Math.min(i * 0.045, 0.4)}s` }}
            >
              <span className="rm-node" aria-hidden="true" />
              <article className="rm-card">
                <div className="rm-version">
                  <span>{item.version}</span>
                  <span className={`rm-status ${item.status}`}>{STATUS_LABEL[item.status]}</span>
                </div>

                <h3 className="rm-title">{item.title}</h3>
                <p className="rm-summary">{item.summary}</p>

                <div className="rm-foot">
                  <span className="rm-label">{STATUS_LABEL[item.status]}</span>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>

      <p className="roadmap-disclaimer">{ROADMAP_DISCLAIMER}</p>

      <p className="roadmap-disclaimer roadmap-disclaimer-2">
        {current
          ? `${current.version} — ${current.title} is the current development milestone. Earlier versions are previous stages; everything from ${current.version} onward is roadmap.`
          : "The current development milestone is marked on the roadmap."}
      </p>
    </div>
  );
}
