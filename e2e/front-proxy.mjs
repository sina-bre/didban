// Test-only stand-in for Caddy/Nginx in front of the Next.js example: forwards everything to
// TARGET and sets X-Forwarded-For to the client address, like `reverse_proxy` does. Never shipped.
import { createServer, request } from "node:http";

const port = Number(process.env.PORT ?? 5305);
const target = new URL(process.env.TARGET ?? "http://localhost:5303");

createServer((req, res) => {
  const headers = { ...req.headers, "x-forwarded-for": req.socket.remoteAddress };
  const upstream = request(
    { host: target.hostname, port: target.port, method: req.method, path: req.url, headers },
    (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(res);
    },
  );
  upstream.on("error", () => res.writeHead(502).end());
  req.pipe(upstream);
}).listen(port, () => console.log(`e2e front proxy on ${port} → ${target.origin}`));
