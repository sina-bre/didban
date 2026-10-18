// Static host for the script-tag example: strict CSP (no inline script), a self-hosted copy of
// the SDK with Subresource Integrity, and the same-origin /a/e proxy to the collector.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, request } from "node:http";

const port = Number(process.env.PORT ?? 5304);
const collector = new URL(process.env.COLLECTOR_URL ?? "http://localhost:5100");
// A self-hosted copy of the published file (the package also lists it under unpkg/jsdelivr).
const sdk = readFileSync(
  new URL("./node_modules/@didban/analytics/dist/didban.iife.js", import.meta.url),
);
const sri = `sha384-${createHash("sha384").update(sdk).digest("base64")}`;
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8")
  .replace("__SRI__", sri)
  .replace("__WRITE_KEY__", process.env.DIDBAN_WRITE_KEY ?? "");
const csp = "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self'";

function proxy(req, res) {
  // Append the visitor's address to X-Forwarded-For, like Caddy and Nginx do (docs/sdk.md).
  const prior = req.headers["x-forwarded-for"];
  const ip = req.socket.remoteAddress;
  const headers = { ...req.headers, host: collector.host };
  headers["x-forwarded-for"] = prior ? `${prior}, ${ip}` : ip;
  const upstream = request(
    {
      host: collector.hostname,
      port: collector.port,
      method: req.method,
      headers,
      path: req.url.replace(/^\/a\/e/, ""),
    },
    (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(res);
    },
  );
  upstream.on("error", () => res.writeHead(502).end());
  req.pipe(upstream);
}

createServer((req, res) => {
  if (req.url?.startsWith("/a/e/")) return proxy(req, res);
  if (req.url === "/favicon.ico") return res.writeHead(204).end();
  if (req.url === "/didban.iife.js") {
    res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-cache" });
    return res.end(sdk);
  }
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html", "content-security-policy": csp });
    return res.end(html);
  }
  res.writeHead(404).end();
}).listen(port, () => console.log(`script-tag example on http://localhost:${port} (SRI ${sri})`));
