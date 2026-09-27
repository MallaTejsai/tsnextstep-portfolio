import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Relative base + single-file output so the built index.html works everywhere:
// any subpath, any static host, and even double-clicked from disk (file://).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
  build: {
    target: "es2020",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
