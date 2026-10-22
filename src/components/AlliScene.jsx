import { useEffect, useRef, useState } from "react";
import { ARCHITECTURE_FLOW } from "../data/alliArchitecture";

const NODES = [
  { id: "memory", label: "MEMORY", pos: "n1" },
  { id: "knowledge", label: "KNOWLEDGE", pos: "n2" },
  { id: "tools", label: "TOOLS", pos: "n3" },
  { id: "reasoning", label: "REASONING", pos: "n4" },
  { id: "workflows", label: "WORKFLOWS", pos: "n5" },
];

const PANELS = [
  { id: "python", k: "RUNTIME", v: "Python", pos: "p1" },
  { id: "ollama", k: "SERVING", v: "Ollama · local", pos: "p2" },
  { id: "qwen", k: "MODEL", v: "Qwen", pos: "p3" },
];

/**
 * "Meet ALLI" centerpiece: a CSS-3D composition (perspective + preserve-3d)
 * with a local particle field and pointer parallax, paired with a fully
 * readable, keyboard-operable system diagram. The scene is decorative and
 * marked aria-hidden; every fact it shows also exists as text.
 */
export default function AlliScene() {
  const [selected, setSelected] = useState("python");
  const detail = ARCHITECTURE_FLOW.find((node) => node.id === selected);

  const rootRef = useRef(null);
  const stageWrapRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);

  /* --- local particle field: pauses off-screen, hidden and under reduced motion --- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = stageWrapRef.current;
    const root = rootRef.current;
    if (!canvas || !wrap) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = false;
    let visible = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let dots = [];

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(44, Math.max(16, (w * h) / 17000)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.35,
        vy: -(Math.random() * 0.18 + 0.04),
        a: Math.random() * 0.4 + 0.14,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i];
        if (!reduce && visible && !document.hidden) {
          d.y += d.vy;
          if (d.y < -6) {
            d.y = h + 6;
            d.x = Math.random() * w;
          }
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 138, 152, ${d.a})`;
        ctx.fill();
      }
      if (!reduce && visible && !document.hidden) {
        raf = window.requestAnimationFrame(draw);
        running = true;
      } else {
        raf = 0;
        running = false;
      }
    };

    const start = () => {
      if (running || reduce || !visible || document.hidden) return;
      running = true;
      raf = window.requestAnimationFrame(draw);
    };

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    };

    resize();
    draw();

    const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    window.addEventListener("resize", resize);

    let io;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          root?.classList.toggle("is-offscreen", !visible);
          if (visible) start();
          else stop();
        },
        { threshold: 0.05 }
      );
      io.observe(wrap);
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  /* --- gentle pointer parallax (fine pointers only, never under reduced motion) --- */
  useEffect(() => {
    const wrap = stageWrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return undefined;
    if (!window.matchMedia("(pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let running = false;

    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      stage.style.transform = `rotateX(${(-cy * 7).toFixed(3)}deg) rotateY(${(cx * 9).toFixed(3)}deg)`;
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = window.requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const kick = () => {
      if (!running) {
        running = true;
        raf = window.requestAnimationFrame(tick);
      }
    };

    const onMove = (event) => {
      const rect = wrap.getBoundingClientRect();
      tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      wrap.style.setProperty("--lx", `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(2)}%`);
      wrap.style.setProperty("--ly", `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(2)}%`);
      wrap.style.setProperty("--lit", "1");
      kick();
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      wrap.style.setProperty("--lit", "0");
      kick();
    };

    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.style.removeProperty("--lx");
      wrap.style.removeProperty("--ly");
      wrap.style.removeProperty("--lit");
      stage.style.transform = "";
    };
  }, []);

  return (
    <figure className="alli-scene alli-system" ref={rootRef}>
      <div className="system-stage" ref={stageWrapRef} aria-hidden="true">
        <canvas className="alli-scene-canvas" ref={canvasRef} />

        <div className="alli-scene-stage" ref={stageRef}>
          <div className="alli-scene-world">
            <span className="scene-grid" />
            <span className="scene-horizon" />

            <span className="scene-ring ring-1" />
            <span className="scene-ring ring-2" />
            <span className="scene-ring ring-3" />

            <span className="scene-arm arm-1">
              <span className="scene-dot" />
            </span>
            <span className="scene-arm arm-2">
              <span className="scene-dot" />
            </span>
            <span className="scene-arm arm-3">
              <span className="scene-dot dot-violet" />
            </span>
            <span className="scene-arm arm-4">
              <span className="scene-dot" />
            </span>

            <span className="scene-core">
              <span className="core-pulse" />
              <span className="core-pulse core-pulse-2" />
              <span className="core-sphere">
                <span className="core-inner" />
                <span className="core-shine" />
              </span>
              <span className="core-label">
                ALLI
                <span className="core-sub">v0.6 · in development</span>
              </span>
            </span>

            {NODES.map((node) => (
              <span key={node.id} className={`scene-node ${node.pos}`}>
                <span className="scene-node-line" />
                {node.label}
              </span>
            ))}

            {PANELS.map((panel) => (
              <span key={panel.id} className={`scene-panel ${panel.pos}`}>
                <span className="scene-panel-k">{panel.k}</span>
                <span className="scene-panel-v">{panel.v}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="system-copy">
        <div className="system-core">
          <span className="system-wordmark">ALLI</span>
          <span className="system-version">v0.6 · in development</span>
        </div>

        <div className="system-areas">
          <span>Development areas</span>
          <ul>
            {NODES.map((node) => (
              <li key={node.id}>{node.label}</li>
            ))}
          </ul>
        </div>

        <div className="system-stack" role="group" aria-label="Select a local stack component">
          {PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              aria-pressed={selected === panel.id}
              aria-controls="alli-stack-detail"
              onClick={() => setSelected(panel.id)}
            >
              <span>{panel.k}</span>
              <strong>{panel.v}</strong>
            </button>
          ))}
        </div>

        <div className="system-detail" id="alli-stack-detail" aria-live="polite" aria-atomic="true">
          <p key={selected}>{detail.detail}</p>
        </div>

        <p className="system-note">Local project snapshot · not live telemetry</p>
      </div>

      <figcaption className="system-caption">Interactive architecture visualization</figcaption>
    </figure>
  );
}
