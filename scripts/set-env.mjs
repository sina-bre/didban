// Usage: node scripts/set-env.mjs KEY=VALUE ... — creates or updates keys in the root .env (dev only).
// Reading: node scripts/set-env.mjs --get KEY — prints the current value (empty if unset).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = new URL("../.env", import.meta.url);
const example = new URL("../.env.example", import.meta.url);
const text = existsSync(file) ? readFileSync(file, "utf8") : readFileSync(example, "utf8");
const lines = text.split("\n");

if (process.argv[2] === "--get") {
  const key = process.argv[3];
  const line = lines.find((l) => l.startsWith(`${key}=`));
  process.stdout.write(line ? line.slice(key.length + 1) : "");
  process.exit(0);
}

for (const pair of process.argv.slice(2)) {
  const key = pair.slice(0, pair.indexOf("="));
  const index = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (index >= 0) lines[index] = pair;
  else lines.push(pair);
}
writeFileSync(file, `${lines.join("\n").trimEnd()}\n`);
