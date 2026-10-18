// Loaded into the API process with `node --import` by the load runner only (never in production).
// Every second: resident set size and CPU time since the last sample, sent over the IPC channel.
// With LOAD_CPU_PROFILE set, a V8 CPU profile of the whole run is written there on "stop".
import { writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";

let last = process.cpuUsage();
let lastAt = performance.now();

setInterval(() => {
  const cpu = process.cpuUsage(last);
  const now = performance.now();
  const cpuPercent = ((cpu.user + cpu.system) / 1000 / (now - lastAt)) * 100;
  process.send?.({ rssMb: process.memoryUsage.rss() / 2 ** 20, cpuPercent });
  last = process.cpuUsage();
  lastAt = now;
}, 1000).unref();

const profileFile = process.env.LOAD_CPU_PROFILE;
const session = profileFile ? new Session() : undefined;
if (session) {
  session.connect();
  await session.post("Profiler.enable");
  await session.post("Profiler.start");
}

process.on("message", async (message) => {
  if (message !== "stop") return;
  if (session && profileFile) {
    const { profile } = await session.post("Profiler.stop");
    writeFileSync(profileFile, JSON.stringify(profile));
  }
  process.exit(0);
});
