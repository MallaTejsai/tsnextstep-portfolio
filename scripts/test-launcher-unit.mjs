import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { request, acquireLock } from "../tools/launcher-common.mjs";

test("HTTP deadline covers both hung headers and an unfinished body; redirects and oversized replies are rejected", async () => {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    if (req.url === "/body") { res.writeHead(200); res.write("partial"); }
    if (req.url === "/large") res.end("x".repeat(4096));
    if (req.url === "/redirect") { res.writeHead(302, { Location: "/hang" }); res.end(); }
  });
  server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const endpoint of ["/hang", "/body"]) {
      const start = Date.now();
      await assert.rejects(request(url + endpoint, { timeout: 100 }), /timed out/);
      assert.ok(Date.now() - start < 2000, "HTTP total deadline did not bound the request");
    }
    await assert.rejects(request(url + "/large", { maxBytes: 128 }), /size limit/);
    assert.equal((await request(url + "/redirect")).status, 302, "readiness followed an untrusted redirect");
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("launcher mutex excludes concurrent actions and can be reacquired after release", async () => {
  const release = await acquireLock(1000);
  try { await assert.rejects(acquireLock(150), /Another launcher action/); }
  finally { await release(); }
  await (await acquireLock(1000))();
});
