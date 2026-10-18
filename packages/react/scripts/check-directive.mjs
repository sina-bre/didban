// Fails the build when dist/index.js does not start with "use client" (addendum A2, RSC-safe).
import { readFileSync } from "node:fs";

const code = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
if (!code.startsWith('"use client";')) {
  console.error('dist/index.js must start with "use client";');
  process.exit(1);
}
console.log('check-directive: "use client" ok');
