import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
export const STATE_PATH = path.join(ROOT, ".resource-studio", "local-services.json");
export const LOG_DIRECTORY = path.join(ROOT, "logs", "local-dev");
export const SERVICES = [
  { name: "bridge", port: 4175, url: "http://127.0.0.1:4175" },
  { name: "studio", port: 4174, url: "http://127.0.0.1:4174", root: path.join(ROOT, "tools", "resource-studio"), entry: "/main.jsx" },
  { name: "portfolio", port: 5173, url: "http://127.0.0.1:5173", root: ROOT, entry: "/src/main.jsx" },
];
export const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
export const isAlive = (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
};

export async function readState() {
  try { return JSON.parse(await fsp.readFile(STATE_PATH, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Cannot read launcher state at ${STATE_PATH}. Inspect it before moving it aside.`);
  }
}

export function validState(state) {
  return state?.version === 2 && state.root === ROOT && Number.isSafeInteger(state.pid) && state.pid > 0 &&
    Number.isInteger(state.controlPort) && state.controlPort > 0 && state.controlPort <= 65535 &&
    /^[a-f0-9]{64}$/.test(state.secret) && /^[a-f0-9]{32}$/.test(state.instance);
}

export async function writeState(state) {
  await fsp.mkdir(path.dirname(STATE_PATH), { recursive: true });
  const temporary = `${STATE_PATH}.${state.instance}.tmp`;
  await fsp.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  try { await fsp.rename(temporary, STATE_PATH); }
  finally { await fsp.rm(temporary, { force: true }); }
}

export async function removeState(instance) {
  const current = await readState();
  if (current?.instance === instance) await fsp.rm(STATE_PATH, { force: true });
}

// An OS-held mutex has no stale lock file or PID-reuse recovery race. Named
// pipes are exclusive in libuv on Windows and disappear when the process dies.
export async function acquireLock(timeout = 60000) {
  const digest = crypto.createHash("sha256").update(process.platform === "win32" ? ROOT.toLowerCase() : ROOT).digest("hex");
  const address = process.platform === "win32"
    ? { path: `\\\\.\\pipe\\ts-nextstep-launcher-${digest.slice(0, 24)}` }
    : { host: "127.0.0.1", port: 20000 + (parseInt(digest.slice(0, 6), 16) % 20000), exclusive: true };
  const deadline = Date.now() + timeout;
  while (true) {
    const server = net.createServer((socket) => socket.destroy());
    try {
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(address, resolve); });
      return () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    } catch (error) {
      if (!["EADDRINUSE", "EACCES"].includes(error.code)) throw error;
      if (Date.now() >= deadline) throw new Error("Another launcher action is still running. Wait, then retry.");
      await sleep(150);
    }
  }
}

export async function assertPortsFree() {
  for (const service of SERVICES) {
    const server = net.createServer((socket) => socket.destroy());
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port: service.port, exclusive: true }, resolve);
      });
    } catch {
      throw new Error(`${service.name} port ${service.port} is occupied or unavailable. Its repository identity is unverified; inspect the listener before retrying. Nothing on that port was stopped.`);
    } finally { if (server.listening) await new Promise((resolve) => server.close(resolve)); }
  }
}

// http.request gives a total deadline, including body reads (not only headers),
// a size limit, no redirect following, and no ambient proxy configuration.
export function request(url, { method = "GET", headers = {}, timeout = 2500, maxBytes = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers, agent: false });
    const timer = setTimeout(() => req.destroy(new Error("HTTP readiness request timed out")), timeout);
    const fail = (error) => { clearTimeout(timer); reject(error); };
    req.once("error", fail);
    req.once("response", (res) => {
      const chunks = [];
      let bytes = 0;
      res.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          const error = new Error("HTTP readiness response exceeded its size limit");
          fail(error);
          req.destroy(error);
        } else chunks.push(chunk);
      });
      res.once("error", fail);
      res.once("end", () => { clearTimeout(timer); resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }); });
    });
    req.end();
  });
}

export function mac(secret, value) { return crypto.createHmac("sha256", secret).update(value).digest("hex"); }
export function equalMac(actual, expected) {
  return typeof actual === "string" && /^[a-f0-9]{64}$/.test(actual) && crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export async function controlRequest(state, method, endpoint) {
  const nonce = crypto.randomBytes(32).toString("hex");
  const result = await request(`http://127.0.0.1:${state.controlPort}${endpoint}`, {
    method, timeout: 10000, maxBytes: 32768,
    headers: { "X-Launcher-Nonce": nonce, "X-Launcher-Proof": mac(state.secret, `${method}\n${endpoint}\n${nonce}`) },
  });
  if (result.status !== 200 || !equalMac(result.headers["x-launcher-proof"], mac(state.secret, `${nonce}\n${result.body}`))) {
    throw new Error("Worker control identity could not be authenticated");
  }
  const payload = JSON.parse(result.body);
  if (payload.root !== ROOT || payload.pid !== state.pid || payload.instance !== state.instance) throw new Error("Worker repository identity does not match");
  return payload;
}
