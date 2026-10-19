// Runs after `vite build`. Fails the build when:
// - index.html or a CSS file references an external host (spec §13.2.10: self-host everything);
// - the initial JS (entry + modulepreloads) exceeds 180 KB gzip (addendum A2).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const INITIAL_JS_LIMIT = 180 * 1024;
const EXTERNAL_HTML = /(?:src|href)\s*=\s*["']?(?:https?:)?\/\//gi;
const EXTERNAL_CSS = /(?:url\(\s*["']?|@import\s+["'])(?:https?:)?\/\//gi;

const errors = [];
const html = readFileSync(join(DIST, "index.html"), "utf8");
if (EXTERNAL_HTML.test(html)) errors.push("index.html references an external URL");
for (const file of readdirSync(join(DIST, "assets")).filter((f) => f.endsWith(".css"))) {
  const css = readFileSync(join(DIST, "assets", file), "utf8");
  if (EXTERNAL_CSS.test(css)) errors.push(`assets/${file} references an external URL`);
}

const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const bytes = initial.reduce((sum, f) => sum + gzipSync(readFileSync(join(DIST, f))).length, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
if (bytes > INITIAL_JS_LIMIT) errors.push(`initial JS ${kb(bytes)} gz > ${kb(INITIAL_JS_LIMIT)}`);

if (errors.length > 0) {
  for (const e of errors) console.error(`error ${e}`);
  process.exit(1);
}
console.log(
  `check-dist: ok (no external URLs; initial JS ${kb(bytes)} gz in ${initial.length} file(s))`,
);
