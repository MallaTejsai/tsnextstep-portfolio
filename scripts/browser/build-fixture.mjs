import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { assertFixtureRoot, exists } from "./fixture.mjs";

const root = path.resolve(process.argv[2] || ".");
assertFixtureRoot(root);
if (!await exists(path.join(root, ".browser-qa-fixture"))) throw new Error("Missing synthetic fixture marker");
await import(pathToFileURL(path.join(root, "scripts/validate-resources.mjs")));
await build({
  root,
  configFile: path.join(root, "vite.config.js"),
  configLoader: "runner",
  envDir: root,
  envPrefix: "BROWSER_QA_",
  cacheDir: path.join(root, ".browser-cache/node_modules/build"),
  logLevel: "error",
  build: { outDir: path.join(root, "dist"), emptyOutDir: true },
});
