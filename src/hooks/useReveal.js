import { useEffect, useRef, useState } from "react";

/**
 * Adds `.is-in` to the element when it enters the viewport.
 * Respects prefers-reduced-motion (reveals immediately).
 * Returns a ref to attach to the target element.
 */
export function useReveal(options = {}) {
  const { threshold = 0.15, rootMargin = "0px 0px -8% 0px", once = true } = options;
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !("IntersectionObserver" in window)) {
      setRevealed(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setRevealed(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, revealed];
}

/**
 * Generic IntersectionObserver hook: fires callback whenever targets change state.
 * Used for scroll-spy navigation and roadmap progress.
 */
export function useSectionSpy(ids) {
  const [active, setActive] = useState(ids[0] || "");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;

    const visible = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        let best = "";
        let bestRatio = 0;
        visible.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        });
        if (best) setActive(best);
      },
      { threshold: [0.15, 0.35, 0.6], rootMargin: "-15% 0px -45% 0px" }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, [ids.join("|")]);

  return active;
}
