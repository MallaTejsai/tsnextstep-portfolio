import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const studioRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(studioRoot, "../..");

export default defineConfig({
  root: studioRoot,
  base: "/",
  plugins: [react()],
  publicDir: path.join(repositoryRoot, "public"),
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
    fs: {
      allow: [repositoryRoot],
    },
  },
  build: {
    outDir: path.join(repositoryRoot, ".resource-studio-dist"),
    emptyOutDir: true,
  },
});
