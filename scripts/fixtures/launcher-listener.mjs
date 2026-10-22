import http from "node:http";

// A deliberately convincing legacy marker/session impostor. Only test IPC
// can close it; the product launcher must never adopt or stop this process.
const server = http.createServer((req, res) => {
  if (req.url === "/api/session") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ origin: "http://127.0.0.1:4174", port: server.address().port, token: "fixture-only" }));
  } else if (req.url === "/api/health") {
    res.end(JSON.stringify({ ok: true, root: ".", pid: process.pid }));
  } else res.end("<title>TS nextstep Resource Studio</title><script src='/src/main.jsx'></script>");
});
server.listen(Number(process.argv[2] || 0), "127.0.0.1", () => {
  process.send({ port: server.address().port, pid: process.pid });
});
const close = () => server.close(() => process.exit(0));
process.on("message", (message) => { if (message === "close") close(); });
process.on("disconnect", close);
