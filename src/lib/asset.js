/**
 * Resolves a public/ asset path against Vite's BASE_URL.
 *
 * - dev server: BASE_URL is "/"  → "/img.png"
 * - production build (base "./"): "./img.png" → works from any subpath
 *
 * Drop your photo at: public/img.png
 */
export function asset(path) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${String(path).replace(/^\/+/, "")}`;
}
