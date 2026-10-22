import { useEffect } from "react";

/**
 * Pointer-driven 3D tilt for a single surface.
 * Fine pointers only, never under reduced motion, and the inline
 * transform is cleared on leave so CSS hover states own the element again.
 */
export function useTilt(ref, { max = 5, lift = -6, enabled = true } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    if (!window.matchMedia("(pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let running = false;

    const tick = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      el.style.transform = `perspective(1100px) rotateX(${(-cy * max).toFixed(3)}deg) rotateY(${(
        cx * max
      ).toFixed(3)}deg) translateY(${lift}px)`;
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) {
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
      const rect = el.getBoundingClientRect();
      tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      kick();
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      cx = 0;
      cy = 0;
      el.style.transform = "";
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.transform = "";
    };
  }, [ref, max, lift, enabled]);
}
