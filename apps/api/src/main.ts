import "reflect-metadata";
import { InvalidEnvError, loadEnv } from "./config/env.js";
import { createApp } from "./http/create-app.js";

try {
  const env = loadEnv(process.env);
  const app = await createApp(env);
  await app.listen(env.PORT, env.HOST);
} catch (error) {
  if (!(error instanceof InvalidEnvError)) throw error;
  console.error(error.message);
  process.exit(1);
}
