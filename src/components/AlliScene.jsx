import { useEffect, useRef } from "react";

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
 * "Meet ALLI" centerpiece — a genuine 3D composition built with CSS 3D
 * transforms (perspective + preserve-3d), a small local particle canvas and
 * pointer parallax. No WebGL, no external 3D library: it stays fast on
 * mid-range laptops, degrades to a static layered scene when the tab is
 * hidden / off-screen / reduced-motion is on, and always renders a finished
 * composition even if animation is unavailable.
 */
export default function AlliScene() {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);

  /* --- local particle field: pauses off-screen and under reduced motion --- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
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

      const count = Math.round(Math.min(46, Math.max(18, (w * h) / 16000)));
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
        if (!reduce && visible) {
          d.y += d.vy;
          if (d.y < -6) {
            d.y = h + 6;
            d.x = Math.random() * w;
          }
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 175, 255, ${d.a})`;
        ctx.fill();
      }
      raf = window.requestAnimationFrame(draw);
    };

    resize();
    if (reduce) {
      draw();
      window.cancelAnimationFrame(raf);
      raf = 0;
    } else {
      draw();
    }

    const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    window.addEventListener("resize", resize);

    let io;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          wrap.classList.toggle("is-offscreen", !visible);
          if (!visible && raf) {
            window.cancelAnimationFrame(raf);
            raf = 0;
          } else if (visible && !raf && !reduce) {
            raf = window.requestAnimationFrame(draw);
          }
        },
        { threshold: 0.05 }
      );
      io.observe(wrap);
    }

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  /* --- gentle pointer parallax (fine pointers only, never under reduced motion) --- */
  useEffect(() => {
    const wrap = wrapRef.current;
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

    const onMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      kick();
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };

    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      className="alli-scene"
      ref={wrapRef}
      role="img"
      aria-label="Interactive 3D-style visualization of the ALLI system: a central intelligence core with orbiting memory, knowledge, tools, reasoning and workflow nodes, and floating runtime, serving and model panels."
    >
      <canvas className="alli-scene-canvas" ref={canvasRef} aria-hidden="true" />

      <div className="alli-scene-stage" ref={stageRef} aria-hidden="true">
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

      <span className="alli-scene-badge">Interactive architecture visualization</span>
    </div>
  );
}
