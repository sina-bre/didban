// Test-only stand-in for the didban collector: records what the example proxies forward
// (headers, socket address, events) so e2e tests can assert on them. Never shipped.
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 5301);
let records = [];

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

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
  req.on("end", () => {
    const batch = JSON.parse(body);
    records.push({
      forwardedFor: req.headers["x-forwarded-for"] ?? null,
      socket: req.socket.remoteAddress,
      origin: req.headers.origin ?? null,
      batch,
    });
    json(res, 200, {
      accepted: batch.events.length,
      duplicates: 0,
      rejected: [],
      requestId: "e2e",
    });
  });
}).listen(port, () => console.log(`e2e collector on ${port}`));
