// Starts the built API (apps/api/dist) as a child process on the test database and waits for
// /health/ready. The probe (`--import`) reports RSS + CPU over IPC; the API code is unchanged.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAIN = fileURLToPath(new URL("../../../apps/api/dist/main.js", import.meta.url));
const PROBE = new URL("./process-probe.mjs", import.meta.url).href;

/** `settings` = env overrides the run records with its results (pool size, limits, ...). */
export async function startApi({ databaseUrl, port, settings }) {
  if (!existsSync(MAIN)) throw new Error("apps/api/dist missing: run `pnpm build` first");
  const env = {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SYSTEMROOT,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    PUBLIC_ORIGIN: "https://didban.test",
    DATABASE_URL: databaseUrl,
    ...settings,
    ...(process.env.LOAD_CPU_PROFILE ? { LOAD_CPU_PROFILE: process.env.LOAD_CPU_PROFILE } : {}),
  };
  const child = spawn(process.execPath, ["--import", PROBE, MAIN], {
    env,
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  const samples = [];
  child.on("message", (sample) => samples.push(sample));
  const base = `http://127.0.0.1:${port}`;
  await waitReady(`${base}/api/v1/health/ready`, child);
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const stop = () => {
    child.send("stop"); // the probe exits the process (and writes a CPU profile if asked)
    return exited;
  };
  return { base, samples, stop };
}

async function waitReady(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`API exited with ${child.exitCode}`);
    const ok = await fetch(url).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error(`API not ready after 20 s: ${url}`);
}
