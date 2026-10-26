import { afterEach, expect, it, vi } from "vitest";
import { AppError } from "../../http/app-error.js";
import { CACHE_TTL_MS, MAX_CONCURRENT, QUEUE_WAIT_MS, StatsGate } from "./stats-gate.js";

afterEach(() => vi.useRealTimers());

const deferred = () => {
  let resolve: (value: string) => void = () => {};
  const promise = new Promise<string>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

it("gate: runs 3 queries per project at once; the 4th starts when one finishes", async () => {
  const gate = new StatsGate();
  const jobs = Array.from({ length: MAX_CONCURRENT + 1 }, deferred);
  const started: number[] = [];
  const runs = jobs.map((job, i) =>
    gate.run("p1", null, () => {
      started.push(i);
      return job.promise;
    }),
  );
  await Promise.resolve();
  expect(started).toEqual([0, 1, 2]);
  void gate
    .run("p2", null, async () => "other project is not blocked")
    .then((v) => started.push(v.length));
  jobs[0]?.resolve("done");
  await runs[0];
  await vi.waitFor(() => expect(started).toContain(3));
  for (const job of jobs) job.resolve("done");
  await Promise.all(runs);
});

it("gate: answers 429 with Retry-After after waiting 2 s for a slot", async () => {
  vi.useFakeTimers();
  const gate = new StatsGate();
  const hold = deferred();
  for (let i = 0; i < MAX_CONCURRENT; i++) void gate.run("p1", null, () => hold.promise);
  const late = gate.run("p1", null, async () => "never");
  const settled = late.catch((error: AppError) => error);
  await vi.advanceTimersByTimeAsync(QUEUE_WAIT_MS);
  const error = await settled;
  expect(error).toBeInstanceOf(AppError);
  expect([(error as AppError).status, (error as AppError).headers["retry-after"]]).toEqual([
    429,
    "1",
  ]);
  hold.resolve("done");
});

it("gate: caches by (project, key) for 15 s; `null` key is never cached", async () => {
  let now = 0;
  const gate = new StatsGate(() => now);
  let calls = 0;
  const work = async () => ++calls;
  expect(await gate.run("p1", "q", work)).toBe(1);
  expect(await gate.run("p1", "q", work)).toBe(1);
  expect(await gate.run("p2", "q", work)).toBe(2);
  now = CACHE_TTL_MS;
  expect(await gate.run("p1", "q", work)).toBe(3);
  expect(await gate.run("p1", null, work)).toBe(4);
  expect(await gate.run("p1", null, work)).toBe(5);
});

it("gate: forget(project) drops only that project's cached answers", async () => {
  const gate = new StatsGate(() => 0);
  let calls = 0;
  const work = async () => ++calls;
  await gate.run("p1", "q", work);
  await gate.run("p2", "q", work);
  gate.forget("p1");
  expect(await gate.run("p1", "q", work)).toBe(3);
  expect(await gate.run("p2", "q", work)).toBe(2);
});
