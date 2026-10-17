// ADR 0002 / addendum A4: UI code uses logical (RTL-safe) properties only.
import { readFileSync } from "node:fs";
import { listFiles } from "./list-files.mjs";

const SCOPE = /^(apps\/dashboard\/src|examples|packages\/[^/]*react[^/]*\/src)\/.*\.(tsx|ts|css)$/;
const BANNED_CLASS =
  /(?<![\w-])-?(?:m[lr]|p[lr]|left|right|border-[lr]|rounded-(?:[lr]|tl|tr|bl|br)|scroll-[mp][lr])-[\w[\].%/-]+|(?<![\w-])(?:text|float|clear)-(?:left|right)(?![\w-])/g;
const BANNED_CSS = /(?:margin|padding|border)-(?:left|right)\s*:|(?<![\w-])(?:left|right)\s*:/g;

const errors = [];
for (const file of listFiles().filter((f) => SCOPE.test(f))) {
  const lines = readFileSync(file, "utf8").split("\n");
  const pattern = file.endsWith(".css") ? BANNED_CSS : BANNED_CLASS;
  lines.forEach((line, i) => {
    for (const match of line.matchAll(pattern)) errors.push(`${file}:${i + 1}  ${match[0]}`);
  });
}

if (errors.length > 0) {
  for (const e of errors) console.error(`error ${e}`);
  console.error("check-logical-css: use ms-/me-/ps-/pe-/start-/end-/text-start/text-end instead.");
  process.exit(1);
}
console.log("check-logical-css: ok");
