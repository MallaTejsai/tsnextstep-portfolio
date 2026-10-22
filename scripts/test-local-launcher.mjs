import assert from "node:assert/strict";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ROOT, STATE_PATH, SERVICES, assertPortsFree, controlRequest, isAlive, readState, request, mac, sleep,
} from "../tools/launcher-common.mjs";

const launcher = path.join(ROOT, "tools", "local-dev.mjs");
const fixturePath = fileURLToPath(new URL("./fixtures/launcher-listener.mjs", import.meta.url));
const fixtures = [];
let started = false;

function run(command, args, cwd = os.tmpdir()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, output }));
  });
}
const launch = (...args) => run(process.execPath, [launcher, ...args, "--no-open"]);
const success = (result) => assert.equal(result.code, 0, result.output);
const pass = (message) => console.log(`PASS ${message}`);

async function fixture(port = 0) {
  const child = spawn(process.execPath, [fixturePath, String(port)], { windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const info = await new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Fixture exited: ${code}`)));
  });
  const result = {
    ...info,
    close: () => new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      if (child.connected) child.send("close");
    }),
  };
  fixtures.push(result);
  return result;
}

async function listenerPids() {
  if (process.platform !== "win32") return null;
  const result = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 4175,4174,5173 } | Select-Object LocalAddress,LocalPort,OwningProcess) | ConvertTo-Json -Compress"]);
  success(result);
  return result.output.trim() ? JSON.parse(result.output) : [];
}

// Refuse to disrupt anyone's preexisting environment, including a healthy
// launcher session. This integration test deliberately ends with services off.
const initial = await readState();
assert.ok(!initial || initial.version === 1 || !isAlive(initial.pid), "Stop the existing launcher session before this integration test.");
await assertPortsFree();
assert.deepEqual(await listenerPids(), process.platform === "win32" ? [] : null);

try {
  const unrelated = await fixture();
  for (const service of SERVICES) {
    const impostor = await fixture(service.port);
    const result = await launch("start");
    assert.notEqual(result.code, 0, "accepted an unowned title/session impostor");
    assert.match(result.output, new RegExp(`${service.port}.*occupied`));
    assert.ok(isAlive(impostor.pid));
    assert.equal((await request(`http://127.0.0.1:${service.port}/`)).status, 200);
    const state = await readState();
    assert.ok(!state || state.version === 1 || !isAlive(state.pid), "conflict started a partial environment");
    await impostor.close();
  }
  pass("all three strict-port conflicts rejected convincing legacy impostors; no unowned listener stopped");

  // Simulate a port being taken after the CLI preflight: the worker has to
  // roll back the bridge it already started when strict Vite listen fails.
  const lateConflict = await fixture(4174);
  const failedWorker = spawn(process.execPath, [path.join(ROOT, "tools", "launcher-worker.mjs")], {
    cwd: ROOT, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const failedCode = await new Promise((resolve, reject) => {
    failedWorker.once("error", reject);
    failedWorker.once("exit", resolve);
  });
  assert.equal(failedCode, 1);
  assert.ok(isAlive(lateConflict.pid));
  assert.equal(await readState(), null);
  await lateConflict.close();
  await assertPortsFree();
  pass("post-preflight bind race rolled back the partial worker without touching the competing process");

  const interrupted = spawn(process.execPath, [path.join(ROOT, "tools", "launcher-worker.mjs")], {
    cwd: ROOT, windowsHide: true, stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const interruptedExit = new Promise((resolve, reject) => { interrupted.once("exit", resolve); interrupted.once("error", reject); });
  await new Promise((resolve, reject) => {
    interrupted.once("message", (message) => message.type === "ready" ? resolve() : reject(new Error("Interrupted-start fixture did not become ready")));
    interrupted.once("error", reject);
  });
  interrupted.disconnect();
  assert.equal(await interruptedExit, 1);
  await assertPortsFree();
  assert.equal(await readState(), null);
  pass("launcher IPC loss before durable handoff gracefully cleaned up an otherwise ready worker");

  started = true;
  const concurrent = await Promise.all([launch("start"), launch("start")]);
  concurrent.forEach(success);
  const first = await readState();
  success(await launch("start"));
  for (const name of ["portfolio", "studio"]) success(await launch("open", name));
  const second = await readState();
  assert.equal(first.pid, second.pid);
  assert.equal(first.instance, second.instance);
  assert.ok((await controlRequest(second, "GET", "/status")).services.every((entry) => entry.healthy));
  const listeners = await listenerPids();
  if (listeners) {
    assert.equal(listeners.length, 3);
    assert.ok(listeners.every((listener) => listener.OwningProcess === second.pid && listener.LocalAddress === "127.0.0.1"));
  }
  pass(`concurrent Start All, repeated Start All, both open modes and unrelated cwd reused one healthy worker PID ${second.pid}`);

  assert.equal((await request("http://127.0.0.1:4175/api/session")).status, 403);
  assert.equal((await request("http://127.0.0.1:4175/api/health", { headers: { Origin: SERVICES[1].url } })).status, 401);
  assert.equal((await request("http://127.0.0.1:4175/api/session", { headers: { Origin: "http://localhost:4174" } })).status, 403);
  for (const service of SERVICES.slice(1)) {
    const entry = await request(service.url + service.entry);
    const imports = [...entry.body.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]).filter((url) => url.includes("/.vite-launcher/"));
    assert.ok(imports.length > 0, `no optimized React imports found in ${service.name}`);
    for (const module of imports) {
      const response = await request(service.url + module);
      assert.equal(response.status, 200, `optimized browser dependency is unavailable: ${module}`);
      assert.match(response.headers["content-type"], /javascript/);
    }
    for (const endpoint of [`/@fs/${STATE_PATH.replaceAll("\\", "/")}`, "/.resource-studio/local-services.json?raw"]) {
      const response = await request(service.url + endpoint);
      assert.ok(!response.body.includes(second.secret), "control secret leaked through Vite");
      assert.ok([403, 404].includes(response.status), `private launcher URL was not rejected on ${service.name}: ${endpoint} (${response.status})`);
    }
  }
  const controlUrl = `http://127.0.0.1:${second.controlPort}`;
  assert.equal((await request(controlUrl + "/shutdown", { method: "POST" })).status, 403);
  const nonce = crypto.randomBytes(32).toString("hex");
  const headers = { "X-Launcher-Nonce": nonce, "X-Launcher-Proof": mac(second.secret, `GET\n/status\n${nonce}`) };
  assert.equal((await request(controlUrl + "/status", { headers: { ...headers, Origin: SERVICES[1].url } })).status, 403);
  assert.equal((await request(controlUrl + "/status", { headers })).status, 200);
  assert.equal((await request(controlUrl + "/status", { headers })).status, 403);
  pass("React browser modules load; bridge origin/token protections intact; private state blocked; control rejects unsigned/browser/replayed requests");

  const original = await fsp.readFile(STATE_PATH, "utf8");
  try {
    await fsp.writeFile(STATE_PATH, JSON.stringify({ ...second, secret: crypto.randomBytes(32).toString("hex") }));
    const refused = await launch("stop");
    assert.notEqual(refused.code, 0);
    assert.match(refused.output, /Cannot authenticate/);
    assert.ok(isAlive(second.pid));
  } finally { await fsp.writeFile(STATE_PATH, original); }
  pass("wrong control identity refused shutdown without killing the recorded PID");

  success(await launch("stop"));
  assert.ok(!isAlive(second.pid));
  await assertPortsFree();
  assert.equal(await readState(), null);
  assert.ok(isAlive(unrelated.pid));
  assert.equal((await request(`http://127.0.0.1:${unrelated.port}/`)).status, 200);
  success(await launch("stop"));
  pass("graceful stop released all service ports; unrelated process survived; repeated stop is safe");

  // A stale PID pointing at an unrelated live process must fail closed.
  try {
    await fsp.writeFile(STATE_PATH, JSON.stringify({ ...second, pid: unrelated.pid, controlPort: unrelated.port }));
    const refused = await launch("stop");
    assert.notEqual(refused.code, 0);
    assert.ok(isAlive(unrelated.pid));
  } finally { await fsp.rm(STATE_PATH, { force: true }); }
  // Dead state is recoverable without PID/name based termination.
  await fsp.writeFile(STATE_PATH, JSON.stringify(second));
  success(await launch("start"));
  const restarted = await readState();
  assert.notEqual(restarted.instance, second.instance);
  assert.ok((await controlRequest(restarted, "GET", "/status")).services.every((entry) => entry.healthy));
  success(await launch("stop"));
  pass("stale live PID preserved; dead state recovered; restart and second graceful stop passed");

  const temporaryParent = process.platform === "win32" ? path.join(os.tmpdir(), "agent-tmp") : os.tmpdir();
  const temporary = await fsp.mkdtemp(path.join(temporaryParent, "launcher missing dependencies "));
  try {
    await fsp.mkdir(path.join(temporary, "tools"));
    await fsp.writeFile(path.join(temporary, "package.json"), '{"type":"module"}');
    for (const file of ["local-dev.mjs", "launcher-common.mjs", "launcher-worker.mjs"]) {
      await fsp.copyFile(path.join(ROOT, "tools", file), path.join(temporary, "tools", file));
    }
    const missing = await run(process.execPath, [path.join(temporary, "tools", "local-dev.mjs"), "start", "--no-open"]);
    assert.notEqual(missing.code, 0);
    assert.match(missing.output, /dependencies are missing.*npm ci/s);
    await assertPortsFree();
    pass("missing dependencies produced actionable error in an absolute repository path containing spaces");
  } finally {
    // The failed worker exits after its IPC disconnect and graceful cleanup.
    await sleep(500);
    await fsp.rm(temporary, { recursive: true, force: true });
  }
} finally {
  if (started) success(await launch("stop"));
  await Promise.all(fixtures.map((item) => item.close()));
}
await assertPortsFree();
assert.equal(await readState(), null);
pass("final state: all launcher services stopped and test fixtures closed");
