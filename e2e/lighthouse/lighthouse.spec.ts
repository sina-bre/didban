import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { projectBase, signIn } from "../tests/dashboard.js";
import { sendBrowserEvents } from "../tests/ingest.js";
import { DASHBOARD_URL } from "../tests/keys.js";

// Lighthouse's default mobile profile (Moto G Power: 4x CPU slowdown, slow 4G, simulated) on the
// production build. Spec A2: LCP <= 2.5 s on a mid-range phone. Pinned CLI, fetched by pnpm dlx
// (a measurement tool, not a dependency). Reports and summary.json land in test-results/lighthouse.
const LIGHTHOUSE = "lighthouse@13.6.0";
const OUT = "test-results/lighthouse";

type Audit = { numericValue?: number; score: number | null };
type Report = {
  categories: Record<string, { score: number }>;
  audits: Record<string, Audit>;
};

type Run = { name: string; url: string; headers: string | null; lang: "en-US" | "fa-IR" };

function lighthouse({ name, url, headers, lang }: Run, n: number): Report {
  const json = `${OUT}/${name}-${n}.json`;
  const args = ["dlx", LIGHTHOUSE, url, "--quiet", "--output=json", `--output-path=${json}`];
  args.push(
    "--only-categories=performance,accessibility",
    `--chrome-flags="--headless=new --lang=${lang}"`,
  );
  if (headers) args.push(`--extra-headers=${headers}`);
  if (process.env.LH_ARGS) args.push(process.env.LH_ARGS); // e.g. --throttling-method=devtools
  execFileSync("pnpm", args, { stdio: "inherit", shell: true });
  return JSON.parse(readFileSync(json, "utf8")) as Report;
}

function summary(name: string, r: Report) {
  const ms = (id: string) => Math.round(r.audits[id]?.numericValue ?? Number.NaN);
  const failed = Object.entries(r.audits).filter(([, a]) => a.score === 0);
  return {
    page: name,
    performance: r.categories.performance?.score,
    accessibility: r.categories.accessibility?.score,
    fcpMs: ms("first-contentful-paint"),
    lcpMs: ms("largest-contentful-paint"),
    tbtMs: ms("total-blocking-time"),
    cls: r.audits["cumulative-layout-shift"]?.numericValue,
    failed: failed.map(([id]) => id).join(" "),
  };
}

test("lighthouse mobile: login, overview, pages, sources", async ({ page, request }) => {
  mkdirSync(OUT, { recursive: true });
  await sendBrowserEvents(request, [
    { type: "page", path: "/pricing?utm_source=lighthouse" },
    { type: "page", path: "/docs" },
  ]);
  await signIn(page);
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const headers = `${OUT}/headers.json`;
  writeFileSync(headers, JSON.stringify({ Cookie: cookie }));
  const base = await projectBase();
  const en = "en-US" as const;
  const runs: Run[] = [
    { name: "login", url: `${DASHBOARD_URL}/login`, headers: null, lang: en },
    { name: "overview", url: `${base}/overview`, headers, lang: en },
    { name: "pages", url: `${base}/pages`, headers, lang: en },
    { name: "sources", url: `${base}/sources`, headers, lang: en },
    { name: "overview-fa", url: `${base}/overview`, headers, lang: "fa-IR" },
  ];
  // Median of three runs by LCP (single Lighthouse runs vary by a few hundred ms).
  const only = process.env.LH_ONLY?.split(",");
  const rows = runs
    .filter((run) => !only || only.includes(run.name))
    .map((run) => {
      const three = [1, 2, 3].map((n) => summary(run.name, lighthouse(run, n)));
      return three.sort((a, b) => a.lcpMs - b.lcpMs)[1] ?? three[0];
    });
  console.table(rows);
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(rows, null, 2));
  for (const row of rows) expect(row?.lcpMs).toBeLessThanOrEqual(2500);
});
