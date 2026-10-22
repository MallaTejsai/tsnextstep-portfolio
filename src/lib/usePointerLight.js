import { useEffect, useRef } from "react";

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Pointer light for liquid-glass surfaces.
 *
 * Writes `--lx` / `--ly` (0-100%), `--mx` / `--my` (px inside the box) and
 * `--lit` (0-1, faded by CSS) onto the element, and optionally calls
 * `onFrame(x, y, lit)` once per animation frame for parallax work.
 *
 * Fine pointers only, never under reduced motion, rAF-throttled and it never
 * triggers a React render. `viewport: true` tracks the pointer across the
 * window instead of the element's own box, for environment-wide lighting.
 */
export function usePointerLight(ref, { viewport = false, enabled = true, onFrame = null } = {}) {
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    const el = ref.current;
    if (!enabled) return undefined;
    if (!el || typeof window === "undefined") return undefined;
    if (!window.matchMedia("(pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let raf = 0;
    let tx = 0.5;
    let ty = 0.5;
    let tl = 0;
    let x = 0.5;
    let y = 0.5;
    let l = 0;

    const tick = () => {
      raf = 0;
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      l += (tl - l) * 0.16;

      el.style.setProperty("--lx", `${(x * 100).toFixed(2)}%`);
      el.style.setProperty("--ly", `${(y * 100).toFixed(2)}%`);
      el.style.setProperty("--lit", l.toFixed(3));
      frameRef.current?.(x, y, l);

      if (Math.abs(tx - x) > 0.0015 || Math.abs(ty - y) > 0.0015 || Math.abs(tl - l) > 0.004) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    const kick = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };

    const track = (clientX, clientY) => {
      const rect = viewport
        ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
        : el.getBoundingClientRect();
      tx = clamp01((clientX - rect.left) / Math.max(rect.width, 1));
      ty = clamp01((clientY - rect.top) / Math.max(rect.height, 1));
      el.style.setProperty("--mx", `${Math.round(clientX - rect.left)}px`);
      el.style.setProperty("--my", `${Math.round(clientY - rect.top)}px`);
      tl = 1;
      kick();
    };

    const onElementMove = (event) => track(event.clientX, event.clientY);
    const dim = () => {
      tl = 0;
      tx = 0.5;
      ty = 0.5;
      kick();
    };
    const onDocumentLeave = (event) => {
      if (event.relatedTarget !== null) return;
      dim();
    };
    const onVisibility = () => {
      if (document.hidden) dim();
    };

    if (viewport) {
      window.addEventListener("pointermove", onElementMove, { passive: true });
      document.addEventListener("pointerleave", onDocumentLeave);
      document.addEventListener("visibilitychange", onVisibility);
    } else {
      el.addEventListener("pointermove", onElementMove, { passive: true });
      el.addEventListener("pointerleave", dim, { passive: true });
    }

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onElementMove);
      document.removeEventListener("pointerleave", onDocumentLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("pointermove", onElementMove);
      el.removeEventListener("pointerleave", dim);
      el.style.removeProperty("--lx");
      el.style.removeProperty("--ly");
      el.style.removeProperty("--lit");
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
  }, [ref, viewport, enabled]);
}
