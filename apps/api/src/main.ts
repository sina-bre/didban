import "reflect-metadata";
import { InvalidEnvError, loadEnv } from "./config/env.js";
import { createApp } from "./http/create-app.js";
import { closeOnSignals } from "./http/graceful-shutdown.js";

try {
  const env = loadEnv(process.env);
  const app = await createApp(env);
  await app.listen(env.PORT, env.HOST);
  closeOnSignals(app, env.SHUTDOWN_DRAIN_MS, env.NODE_ENV === "production");
} catch (error) {
  if (!(error instanceof InvalidEnvError)) throw error;
  console.error(error.message);
  process.exit(1);
}
