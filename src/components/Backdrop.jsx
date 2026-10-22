import { useEffect, useRef } from "react";

/**
 * Ambient depth layers: grid, crimson light fields, grain, a drifting
 * particle field and a cursor-following glow. Every layer is
 * pointer-events: none, and all motion stops under reduced motion,
 * when the tab is hidden, or when the pointer leaves the document.
 */
export default function Backdrop() {
  const canvasRef = useRef(null);
  const glowRef = useRef(null);

  /* --- particle field --- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let raf = 0;
    let running = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(72, Math.max(24, (width * height) / 26000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.4,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        a: Math.random() * 0.4 + 0.14,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];

        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -8) p.x = width + 8;
          if (p.x > width + 8) p.x = -8;
          if (p.y < -8) p.y = height + 8;
          if (p.y > height + 8) p.y = -8;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 138, 152, ${p.a})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j += 1) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = dx * dx + dy * dy;
          if (dist < 14000) {
            const op = (1 - dist / 14000) * 0.14;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(225, 29, 53, ${op})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      if (!reduce && !document.hidden) {
        raf = window.requestAnimationFrame(draw);
      } else {
        running = false;
      }
    };

    const start = () => {
      if (running || reduce || document.hidden) return;
      running = true;
      raf = window.requestAnimationFrame(draw);
    };

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();
    if (reduce) {
      draw();
      running = false;
    } else {
      start();
    }
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* --- cursor glow (fine pointers only, never under reduced motion) --- */
  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return undefined;
    if (!window.matchMedia("(pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let active = false;

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!active) {
        active = true;
        glow.classList.add("is-active");
        x = tx;
        y = ty;
      }
    };

    const onLeave = () => {
      active = false;
      glow.classList.remove("is-active");
    };

    const tick = () => {
      x += (tx - x) * 0.1;
      y += (ty - y) * 0.1;
      glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    tick();

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className="backdrop-grid" />
        <div className="backdrop-orb backdrop-orb-1" />
        <div className="backdrop-orb backdrop-orb-2" />
        <canvas ref={canvasRef} />
        <div className="backdrop-grain" />
      </div>
      <div ref={glowRef} className="cursor-glow" aria-hidden="true" />
    </>
  );
}
