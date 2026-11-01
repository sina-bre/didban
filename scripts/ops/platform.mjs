// Where a deployment lives and how its services restart, on Linux (systemd) and Windows (WinSW
// services). Defaults follow docs/deployment.md; every path can be overridden (ADR 0048).
import { renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { run } from "./run.mjs";

const win = process.platform === "win32";
const env = process.env;
const root = env.DIDBAN_ROOT ?? (win ? "C:\\didban" : "/opt/didban");

export const layout = {
  root,
  www: env.DIDBAN_WWW ?? (win ? join(root, "www") : "/srv/didban/www"),
  migratorEnv:
    env.DIDBAN_MIGRATOR_ENV ??
    (win ? join(root, "config", "migrator.env") : "/etc/didban/migrator.env"),
  ports: (env.DIDBAN_PORTS ?? "5101 5102").split(/\s+/).filter(Boolean),
  keep: Number(env.DIDBAN_KEEP_RELEASES ?? 3),
  settleMs: Number(env.DIDBAN_SETTLE_SECONDS ?? 5) * 1000,
};

/** Linux: root (it builds as `didban` and owns the release). Windows: an elevated shell. */
export function assertPrivileged() {
  if (!win && process.getuid?.() !== 0) throw new Error("run as root");
  if (win && !env.DIDBAN_RESTART) run("net", ["session"], { stdio: "ignore" });
}

const KEEP_WIN = [
  "SystemRoot",
  "SystemDrive",
  "ComSpec",
  "APPDATA",
  "LOCALAPPDATA",
  "USERPROFILE",
  "TEMP",
  "TMP",
];

/** `pnpm install` + `pnpm build` in `dir` with a clean environment (nothing secret leaks in). */
export function buildRelease(dir) {
  const base = { PATH: env.PATH, CI: "1", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" };
  const steps = [["install", "--frozen-lockfile"], ["build"]];
  if (win) {
    const keep = Object.fromEntries(KEEP_WIN.filter((k) => env[k]).map((k) => [k, env[k]]));
    for (const args of steps) run("pnpm", args, { cwd: dir, env: { ...keep, ...base } });
    return;
  }
  run("chown", ["-R", "didban:didban", dir]);
  const clean = ["env", "-i", `PATH=${env.PATH}`, "HOME=/var/lib/didban", "LANG=C.UTF-8"];
  const vars = Object.entries(base)
    .filter(([k]) => k !== "PATH")
    .map(([k, v]) => `${k}=${v}`);
  for (const args of steps) {
    run("runuser", ["-u", "didban", "--", ...clean, ...vars, "pnpm", ...args], { cwd: dir });
  }
  // Built code is root's: the service user reads it but cannot change what runs next time.
  run("chown", ["-R", "root:root", dir]);
}

/** Points `current` at the release: an atomic symlink rename on Linux, a junction on Windows. */
export function switchCurrent(release) {
  const current = join(root, "current");
  if (win) {
    rmSync(current, { force: true, recursive: false });
    symlinkSync(release, current, "junction");
    return;
  }
  symlinkSync(release, `${current}.next`);
  renameSync(`${current}.next`, current);
}

/**
 * Restarts one API instance: `systemctl` on Linux, the WinSW service on Windows. `DIDBAN_RESTART`
 * (a command with `{port}`) replaces both for other supervisors (pm2, a container runtime, ...).
 */
export function restartService(port) {
  if (env.DIDBAN_RESTART) {
    const [command, ...args] = env.DIDBAN_RESTART.replaceAll("{port}", port).split(" ");
    return run(command, args);
  }
  if (!win) return run("systemctl", ["restart", `analytics-api@${port}`]);
  run("powershell", ["-NoProfile", "-Command", `Restart-Service -Name analytics-api-${port}`]);
}
