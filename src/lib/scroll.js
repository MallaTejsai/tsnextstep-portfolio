export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToId(id, { updateHash = true } = {}) {
  const element = document.getElementById(id);
  if (!element) return false;
  element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  if (updateHash) history.replaceState(null, "", `#${id}`);
  return true;
}
