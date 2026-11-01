import { setTimeout as sleep } from "node:timers/promises";
import type { INestApplication } from "@nestjs/common";
import { ShutdownState } from "../modules/health/shutdown-state.js";

// Spec §14.2 graceful shutdown behind a proxy (ADR 0047). On SIGTERM `/ready` answers 503 at
// once, but the server keeps serving for SHUTDOWN_DRAIN_MS: the proxy holds keep-alive connections
// and would otherwise send new requests into a closing server (503 "server is closing"). After the
// wait, Nest's hooks run (jobs stop at a chunk, ingest counters flush), in-flight requests finish,
// connections close. SIGINT (Ctrl-C in development) skips the wait.

/** Readiness off, wait `drainMs`, then close the app. */
export async function drainAndClose(app: INestApplication, drainMs: number): Promise<void> {
  app.get(ShutdownState).begin();
  if (drainMs > 0) await sleep(drainMs);
  await app.close();
}

export function closeOnSignals(app: INestApplication, drainMs: number): void {
  let closing = false;
  const close = (wait: number) => {
    if (closing) return;
    closing = true;
    drainAndClose(app, wait).then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error);
        process.exit(1);
      },
    );
  };
  process.on("SIGTERM", () => close(drainMs));
  process.on("SIGINT", () => close(0));
}
