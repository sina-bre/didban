// Claude Code PostToolUse hook: formats the file an Edit/Write just touched. Never blocks the agent.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const biome = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");

let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const file = JSON.parse(input)?.tool_input?.file_path;
    if (!file || !/\.(ts|tsx|js|mjs|cjs|json|css)$/.test(file)) return;
    const args = [biome, "check", "--write", "--no-errors-on-unmatched", file];
    execFileSync(process.execPath, args, { stdio: "ignore" });
  } catch {
    // Lint errors surface in `pnpm lint`; the hook only formats.
  }
});
