import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import {
  ROOT, SERVICES, STATE_PATH, request, mac, equalMac, writeState, removeState, sleep,
} from "./launcher-common.mjs";

const instance = crypto.randomBytes(16).toString("hex");
const secret = crypto.randomBytes(32).toString("hex");
const running = new Map();
let phase = "starting";
let committed = false;
let stopping;
let initializing;
let control;
const send = (message) => { if (process.connected) process.send(message, () => {}); };

async function healthy(service) {
  const owned = running.get(service.name);
  if (!owned) return false;
  try {
    if (service.name === "bridge") {
      if (owned.server.address()?.port !== service.port) return false;
      const result = await request(`${service.url}/api/health`, {
        headers: { Origin: SERVICES[1].url, Authorization: `Bearer ${owned.token}` },
      });
      const body = JSON.parse(result.body);
      return result.status === 200 && body.ok === true && body.pid === process.pid &&
        path.resolve(ROOT, body.root) === ROOT && owned.root === ROOT;
    }
    if (owned.httpServer?.address()?.port !== service.port || path.resolve(owned.config.root) !== service.root) return false;
    const results = await Promise.all([request(`${service.url}/`), request(`${service.url}${service.entry}`)]);
    if (!results.every((result) => result.status === 200 && result.headers["x-ts-launcher-instance"] === instance) ||
        !results[0].body.includes(service.entry.slice(1)) || !/javascript/.test(results[1].headers["content-type"] || "")) return false;
    // A transformed entry can be 200 while React's optimized modules are
    // missing or inaccessible. Read those too before reporting readiness.
    const imports = [...results[1].body.matchAll(/\bfrom\s*["']([^"']+)["']/g)]
      .map((match) => match[1]).filter((url) => url.startsWith("/") && !url.startsWith("//") && url.includes("/.vite-launcher/"));
    const dependencies = await Promise.all([...new Set(imports)].map((url) => request(service.url + url)));
    return dependencies.every((result) => result.status === 200 && result.headers["x-ts-launcher-instance"] === instance && /javascript/.test(result.headers["content-type"] || ""));
  } catch { return false; }
}

async function status() {
  return {
    root: ROOT, pid: process.pid, instance, phase,
    services: await Promise.all(SERVICES.map(async (service) => ({ name: service.name, port: service.port, healthy: await healthy(service) }))),
  };
}

function closeHttp(server) {
  return new Promise((resolve, reject) => {
    if (!server?.listening) return resolve();
    server.close((error) => error ? reject(error) : resolve());
  });
}

function shutdown(exitCode = 0) {
  if (stopping) return stopping;
  phase = "stopping";
  stopping = (async () => {
    // If the launching terminal disappears during listen(), let initialization
    // settle before closing: no newly created server can escape this cleanup.
    await initializing?.catch(() => {});
    const results = await Promise.allSettled([...running.entries()].map(async ([name, server]) => {
      if (name === "bridge") await closeHttp(server.server);
      else {
        // Let the initial module crawl settle before cancelling optimization.
        // Otherwise Vite can wait on a transform whose optimizer was cancelled.
        await server.environments.client.waitForRequestsIdle();
        await server.close();
      }
      console.log(`Closed ${name} gracefully.`);
    }));
    if (results.some((result) => result.status === "rejected")) {
      phase = "shutdown-error";
      stopping = undefined;
      console.error("Graceful server close failed; retained launcher control and state for retry.");
      return;
    }
    await removeState(instance);
    await closeHttp(control);
    process.exit(exitCode);
  })().catch(() => {
    phase = "shutdown-error";
    stopping = undefined;
    console.error(`Could not finish graceful shutdown; inspect ${STATE_PATH} and retry Stop All.`);
  });
  return stopping;
}

async function initialize() {
  if (!process.send) throw new Error("This helper must be started by tools/local-dev.mjs.");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 19) || major === 21 || (major === 22 && minor < 12)) {
    throw new Error("Vite requires Node 20.19+ or 22.12+. Install a supported Node release, then rerun the shortcut installer.");
  }
  let createServer;
  try {
    const require = createRequire(new URL("../package.json", import.meta.url));
    for (const dependency of ["vite", "@vitejs/plugin-react", "vite-plugin-singlefile", "react", "react-dom"]) require.resolve(dependency);
    ({ createServer } = await import("vite"));
  } catch {
    throw new Error(`Project dependencies are missing or cannot load. Run npm ci in ${ROOT}, then retry. See logs/local-dev/worker.log.`);
  }
  const { startBridge } = await import("./resource-studio/bridge.mjs");
  const seen = new Set();
  control = http.createServer(async (req, res) => {
    const nonce = req.headers["x-launcher-nonce"];
    const allowed = req.socket.remoteAddress === "127.0.0.1" &&
      req.headers.host === `127.0.0.1:${control.address()?.port}` && !req.headers.origin &&
      typeof nonce === "string" && /^[a-f0-9]{64}$/.test(nonce) && !seen.has(nonce) &&
      equalMac(req.headers["x-launcher-proof"], mac(secret, `${req.method}\n${req.url}\n${nonce}`));
    if (!allowed) { res.writeHead(403); res.end(); return; }
    seen.add(nonce);
    if (seen.size > 1024) seen.delete(seen.values().next().value);
    if (!((req.method === "GET" && req.url === "/status") || (req.method === "POST" && req.url === "/shutdown"))) {
      res.writeHead(404); res.end(); return;
    }
    try {
      const body = JSON.stringify(req.url === "/status" ? await status() : { root: ROOT, pid: process.pid, instance, phase: "stopping" });
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Launcher-Proof": mac(secret, `${nonce}\n${body}`) });
      res.end(body);
      if (req.url === "/shutdown") void shutdown();
    } catch { res.writeHead(500); res.end(); }
  });
  control.headersTimeout = 5000;
  control.requestTimeout = 10000;
  await new Promise((resolve, reject) => { control.once("error", reject); control.listen(0, "127.0.0.1", resolve); });
  await writeState({ version: 2, root: ROOT, pid: process.pid, instance, secret, controlPort: control.address().port, startedAt: new Date().toISOString() });

  for (const service of SERVICES) {
    if (phase === "stopping") return;
    if (service.name === "bridge") {
      running.set(service.name, await startBridge({ root: ROOT, port: service.port }));
    } else {
      const server = await createServer({
        root: service.root,
        configFile: path.join(service.root, "vite.config.js"),
        // Both roots resolve to the same package.json. Vite's default shared
        // cache makes the two optimizers overwrite each other's metadata.
        cacheDir: path.join(ROOT, "node_modules", ".vite-launcher", service.name),
        optimizeDeps: { entries: [path.join(service.root, "index.html")] },
        clearScreen: false,
        plugins: [{
          name: "launcher-instance", enforce: "pre",
          configureServer(vite) {
            vite.middlewares.use((req, res, next) => {
              let pathname;
              try { pathname = decodeURIComponent((req.url || "/").split("?")[0]).replaceAll("\\", "/"); }
              catch { res.writeHead(400); res.end(); return; }
              if (/(^|\/)(\.resource-studio|logs)(\/|$)/i.test(pathname)) {
                res.writeHead(403); res.end("Private launcher data is not served."); return;
              }
              res.setHeader("X-TS-Launcher-Instance", instance);
              next();
            });
          },
        }],
        server: {
          host: "127.0.0.1", port: service.port, strictPort: true, open: false,
          // The ignored control secret must never be downloadable via /@fs/.
          fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.resource-studio/**", "**/logs/**"] },
        },
      });
      running.set(service.name, server);
      await server.listen();
    }
  }
  const deadline = Date.now() + 20000;
  while (phase !== "stopping" && Date.now() < deadline) {
    const result = await status();
    if (result.services.every((service) => service.healthy)) {
      phase = "ready";
      console.log(`Repository services ready; worker PID ${process.pid}.`);
      send({ type: "ready" });
      return;
    }
    await sleep(200);
  }
  if (phase !== "stopping") throw new Error("Repository services did not pass HTTP readiness within 20 seconds. See logs/local-dev/worker.log.");
}

process.on("message", (message) => {
  if (message?.type === "commit" && phase === "ready") { committed = true; send({ type: "committed" }); }
});
process.on("disconnect", () => { if (!committed) void shutdown(1); });
process.on("SIGTERM", () => { void shutdown(); });
process.on("SIGINT", () => { void shutdown(); });
initializing = initialize();
initializing.catch((error) => {
  console.error(`Launcher worker failed: ${error.message}`);
  send({ type: "error", message: error.message });
  void shutdown(1);
});
