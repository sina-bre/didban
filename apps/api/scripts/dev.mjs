// Dev loop without extra tools: one SWC build, then SWC watch + `node --watch` on the output.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const swcBin = createRequire(import.meta.url).resolve("@swc/cli/bin/swc.js");
const swcArgs = [swcBin, "src", "-d", "dist", "--strip-leading-paths", "--config-file", ".swcrc"];
const nodeArgs = [
  "--watch",
  "--enable-source-maps",
  "--env-file-if-exists=../../.env",
  "dist/main.js",
];

const first = spawnSync(process.execPath, swcArgs, { stdio: "inherit" });
if (first.status !== 0) process.exit(first.status ?? 1);

const children = [
  spawn(process.execPath, [...swcArgs, "--watch"], { stdio: "inherit" }),
  spawn(process.execPath, nodeArgs, { stdio: "inherit" }),
];

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
    process.exit(0);
  });
}
