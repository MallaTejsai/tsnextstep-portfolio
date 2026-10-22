import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ROOT, STATE_PATH, LOG_DIRECTORY, SERVICES, acquireLock, assertPortsFree,
  controlRequest, isAlive, readState, removeState, sleep, validState,
} from "./launcher-common.mjs";

const print = (message) => console.log(message);

async function inspectState() {
  const state = await readState();
  if (!state) return null;
  // Version 1 used command-line substrings: never adopt or stop those PIDs.
  if (state.version === 1) return null;
  if (!validState(state)) throw new Error(`Unrecognized launcher state. Inspect ${STATE_PATH} before moving it aside.`);
  try {
    const status = await controlRequest(state, "GET", "/status");
    return { state, status };
  } catch {
    if (!isAlive(state.pid)) {
      await removeState(state.instance);
      return null;
    }
    throw new Error(`Cannot authenticate recorded worker PID ${state.pid}. Nothing was stopped. Inspect its identity and ${LOG_DIRECTORY} before retrying.`);
  }
}

function assertHealthy(status) {
  if (status.phase !== "ready" || !SERVICES.every((service) => status.services?.some((entry) =>
    entry.name === service.name && entry.port === service.port && entry.healthy === true))) {
    throw new Error(`Recorded worker is ${status.phase || "unhealthy"}; services are not all ready. Use Stop All, then Start All. See ${LOG_DIRECTORY}.`);
  }
}

async function launchWorker() {
  await fsp.mkdir(LOG_DIRECTORY, { recursive: true });
  const logHandle = fs.openSync(path.join(LOG_DIRECTORY, "worker.log"), "a");
  let child;
  try {
    child = spawn(process.execPath, [fileURLToPath(new URL("./launcher-worker.mjs", import.meta.url))], {
      cwd: ROOT, detached: true, windowsHide: true,
      stdio: ["ignore", logHandle, logHandle, "ipc"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });
  } finally { fs.closeSync(logHandle); }

  // IPC remains attached until the worker acknowledges the durable handoff.
  // An interrupted/failed launch closes its services on IPC disconnect.
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Worker startup exceeded 45 seconds. See logs/local-dev/worker.log.")), 45000);
      const finish = (error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
      child.once("error", (error) => finish(error));
      child.once("exit", (code) => finish(new Error(`Worker exited during startup (${code}). See logs/local-dev/worker.log.`)));
      child.on("message", (message) => {
        if (message?.type === "error") finish(new Error(message.message));
        if (message?.type === "ready") {
          inspectState().then((current) => {
            if (!current || current.state.pid !== child.pid) throw new Error("Worker state did not match its startup identity.");
            assertHealthy(current.status);
            child.send({ type: "commit" });
          }).catch(finish);
        }
        if (message?.type === "committed") finish();
      });
    });
  } finally {
    if (child.connected) child.disconnect();
    child.unref();
  }
}

async function start() {
  const current = await inspectState();
  if (current) {
    assertHealthy(current.status);
    print(`Reusing authenticated repository worker PID ${current.state.pid}.`);
  } else {
    // Check every port before starting anything. Strict listen() is the final
    // race-safe check if another program takes a port after this preflight.
    await assertPortsFree();
    await launchWorker();
  }
  for (const service of SERVICES) print(`ready  ${service.name.padEnd(9)} ${service.url}`);
}

async function stop() {
  const current = await inspectState();
  if (!current) {
    print("No authenticated launcher worker found; nothing to stop. Unowned services are left running.");
    return;
  }
  await controlRequest(current.state, "POST", "/shutdown");
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (!isAlive(current.state.pid)) {
      await removeState(current.state.instance);
      print(`Stopped launcher worker PID ${current.state.pid} and its services gracefully.`);
      return;
    }
    await sleep(150);
  }
  throw new Error("Graceful shutdown is still pending (possibly an active bridge request). State was retained; retry Stop All. No process was forcibly killed.");
}

async function openBrowser(url) {
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, windowsHide: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const noOpen = args.includes("--no-open");
  const positional = args.filter((arg) => arg !== "--no-open");
  const mode = positional[0] || "start";
  if (!(["start", "stop"].includes(mode) && positional.length <= 1) &&
      !(mode === "open" && positional.length === 2 && ["portfolio", "studio"].includes(positional[1]))) {
    throw new Error("Usage: node tools/local-dev.mjs [start | open portfolio | open studio | stop] [--no-open]");
  }
  const release = await acquireLock();
  try {
    if (mode === "stop") await stop();
    else await start();
  } finally { await release(); }
  if (mode !== "stop" && !noOpen) {
    const targets = mode === "open" ? [positional[1]] : ["studio", "portfolio"];
    for (const target of targets) await openBrowser(SERVICES.find((service) => service.name === target).url);
  }
}

main().catch((error) => {
  console.error(`Local environment failed: ${error.message}`);
  process.exitCode = 1;
});
