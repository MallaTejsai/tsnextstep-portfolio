import { useEffect, useRef, useState } from "react";

/**
 * Adds `.is-in` to the element when it enters the viewport, which releases
 * the CSS entrance in motion.css. Content is revealed immediately without
 * observation or under reduced motion. Returns a ref to attach to the target.
 */
export function useReveal(options = {}) {
  const { threshold = 0.1, rootMargin = "0px", once = true } = options;
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (motion.matches || !("IntersectionObserver" in window)) {
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
    const onMotionChange = () => {
      if (motion.matches) {
        setRevealed(true);
        io.disconnect();
      }
    };
    motion.addEventListener?.("change", onMotionChange);
    return () => {
      io.disconnect();
      motion.removeEventListener?.("change", onMotionChange);
    };
  }, [threshold, rootMargin, once]);

  return [ref, revealed];
}

/**
 * Scroll-spy: returns the id of the section currently under the reading line.
 *
 * A plain IntersectionObserver with ratio thresholds fails here — sections are
 * wildly different heights (the ALLI block is ~3x a normal section), so tall
 * ones never cross the first threshold and never become active. Instead we
 * track the last section whose top has passed a line about 30% down the
 * viewport, which always matches what the reader is looking at.
 */
export function useSectionSpy(ids) {
  const [active, setActive] = useState(ids[0] || "");

  useEffect(() => {
    const key = ids.join("|");
    const live = key.split("|").filter((id) => document.getElementById(id));
    if (!live.length) return undefined;

    let raf = 0;

    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let best = live[0];
      for (const id of live) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) best = id;
        else break; // sections are in document order
      }
      setActive((prev) => (prev === best ? prev : best));
    };

    const onMove = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);

    return () => {
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [ids.join("|")]);

  return active;
}
