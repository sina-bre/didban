// Test-only recording hop in front of the real didban API (UPSTREAM): records what the example
// proxies forward (headers, socket address, events, API status) so e2e tests can assert on the
// proxy chain, then passes the request on unchanged and returns the API's answer. Never shipped.
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 5301);
const upstream = process.env.UPSTREAM ?? "http://localhost:5306";
const FORWARDED = ["content-type", "origin", "user-agent", "x-forwarded-for", "x-write-key"];
let records = [];

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

async function forward(req, body) {
  const headers = Object.fromEntries(
    FORWARDED.flatMap((name) => (req.headers[name] ? [[name, req.headers[name]]] : [])),
  );
  const reply = await fetch(`${upstream}${req.url}`, { method: "POST", headers, body });
  return { status: reply.status, text: await reply.text() };
}

createServer((req, res) => {
  if (req.url === "/__records") {
    if (req.method === "DELETE") records = [];
    return json(res, 200, records);
  }
  if (req.method !== "POST" || req.url !== "/api/v1/ingest/batch") return json(res, 404, {});
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", async () => {
    const reply = await forward(req, body).catch(() => ({ status: 502, text: "{}" }));
    records.push({
      forwardedFor: req.headers["x-forwarded-for"] ?? null,
      socket: req.socket.remoteAddress,
      origin: req.headers.origin ?? null,
      status: reply.status,
      batch: parse(body),
    });
    json(res, reply.status, reply.text);
  });
}).listen(port, () => console.log(`e2e collector on ${port} → ${upstream}`));
