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
    const items = Array.from(track.querySelectorAll(".rm-item"));
    const nodes = items.map((item) => item.querySelector(".rm-node"));

    let pts = []; // node centers, content coordinates
    let rel = []; // distances from the first node
    let stopDist = 0;
    let lit = items.map(() => false);
    let currentArmed = false;
    let queued = false;

    const measure = () => {
      const hz = mq.matches;
      pts = items.map((item, i) => {
        const n = nodes[i];
        if (!n) return { x: 0, y: 0 };
        return {
          x: item.offsetLeft + n.offsetLeft + n.offsetWidth / 2,
          y: item.offsetTop + n.offsetTop + n.offsetHeight / 2,
        };
      });
      if (!pts.length) return;

      const first = pts[0];
      const last = pts[pts.length - 1];
      rel = pts.map((p) => (hz ? p.x - first.x : p.y - first.y));
      stopDist = rel[CURRENT_INDEX] ?? rel[rel.length - 1];

      if (hz) {
        rail.style.left = `${first.x}px`;
        rail.style.top = `${first.y}px`;
        rail.style.width = `${Math.max(last.x - first.x, 0)}px`;
        rail.style.height = "";
        if (stopMark) {
          stopMark.style.left = `${stopDist}px`;
          stopMark.style.top = "";
        }
      } else {
        rail.style.left = `${first.x}px`;
        rail.style.top = `${first.y}px`;
        rail.style.height = `${Math.max(last.y - first.y, 0)}px`;
        rail.style.width = "";
        if (stopMark) {
          stopMark.style.top = `${stopDist}px`;
          stopMark.style.left = "";
        }
      }
      update();
    };

    const update = () => {
      queued = false;
      if (!rel.length) return;
      const hz = mq.matches;
      let reach;

      if (hz) {
        // Desktop: vertical scroll progress through the section drives the
        // horizontal line; it reaches v0.6 at ~60% and then stops for good.
        const rect = journey.getBoundingClientRect();
        const vh = window.innerHeight;
        const startLine = vh * 0.75;
        const endLine = vh * 0.3;
        const denom = startLine - endLine + rect.height;
        const p = denom > 0 ? (startLine - rect.top) / denom : 1;
        const c = Math.min(Math.max(p, 0), 1);
        reach = Math.min(c / 0.6, 1) * stopDist;
      } else {
        // Mobile: the line tip rides a trigger line at ~62% of the viewport.
        // A node lights when its dot crosses that line; the tip can never
        // travel past the v0.6 node.
        const rect = journey.getBoundingClientRect();
        const trigger = window.innerHeight * 0.62;
        reach = trigger - rect.top - pts[0].y;
        reach = Math.min(Math.max(reach, 0), stopDist);
      }

      fill.style[hz ? "width" : "height"] = `${Math.max(reach, 0)}px`;
      fill.style[hz ? "height" : "width"] = "";
      fill.classList.toggle("is-active", reach > 1);

      for (let i = 0; i < items.length; i += 1) {
        const on = reach >= rel[i] - 1;
        if (on !== lit[i]) {
          lit[i] = on;
          items[i].classList.toggle("is-lit", on);
        }
      }

      if (!currentArmed && CURRENT_INDEX >= 0 && reach >= stopDist - 1) {
        currentArmed = true;
        items[CURRENT_INDEX]?.classList.add("is-current-active");
      }
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    // Card reveals — Intersection Observer only, no scroll work per frame.
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

    const ro = "ResizeObserver" in window ? new ResizeObserver(schedule) : null;
    ro?.observe(track);

    const onMq = () => measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    mq.addEventListener?.("change", onMq);
    document.fonts?.ready.then(measure).catch(() => {});

    measure();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mq.removeEventListener?.("change", onMq);
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
