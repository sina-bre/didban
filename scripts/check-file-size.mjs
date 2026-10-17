// Addendum A1: source files target <= 100 lines. Warn above 120, fail above 150 (tests: fail above 250).
import { readFileSync } from "node:fs";
import { listFiles } from "./list-files.mjs";

const SOURCE = /\.(ts|tsx|js|mjs|cjs|css)$/;
const EXEMPT = [/^\.claude\//, /^docs\//, /\/generated\//, /\/migrations\//, /^data\//, /\.d\.ts$/];
const TEST = /(\.test\.|\.spec\.|\/e2e\/)/;

const warnings = [];
const errors = [];
for (const file of listFiles()) {
  if (!SOURCE.test(file) || EXEMPT.some((re) => re.test(file))) continue;
  const lines = readFileSync(file, "utf8").split("\n").length;
  const limit = TEST.test(file) ? 250 : 150;
  if (lines > limit) errors.push(`${file}: ${lines} lines (limit ${limit})`);
  else if (!TEST.test(file) && lines > 120) warnings.push(`${file}: ${lines} lines (target 100)`);
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
if (errors.length > 0) {
  console.error(`check-file-size: ${errors.length} file(s) too long. Split by use case.`);
  process.exit(1);
}
console.log(`check-file-size: ok (${warnings.length} warning(s))`);
