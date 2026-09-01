import { describe, it, expect, beforeEach, vi } from "vitest";
import { runAtMostEvery, invalidateJob, __resetJobsForTest } from "@/lib/read-path-jobs";

// Several pages ran an idempotent ensure/backfill/catch-up job before reading,
// which against a remote database meant a fixed round trip on the critical
// path of every render to ask a question that is almost always answered "no".
// This throttle is what makes those calls free in the steady state — so the
// window, the de-duplication, and the invalidation escape hatch all need to
// hold, or a job either stops running or starts running twice.
describe("runAtMostEvery", () => {
  beforeEach(() => {
    __resetJobsForTest();
    vi.useRealTimers();
  });

  it("runs the job on the first call", async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    await runAtMostEvery("k", 60_000, job);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("skips a second call inside the window", async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    await runAtMostEvery("k", 60_000, job);
    await runAtMostEvery("k", 60_000, job);
    await runAtMostEvery("k", 60_000, job);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("runs again once the window has passed", async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    await runAtMostEvery("k", 5, job);
    await new Promise((r) => setTimeout(r, 20));
    await runAtMostEvery("k", 5, job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  it("keys are independent, so one tenant's run does not suppress another's", async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    await runAtMostEvery("tenant-a", 60_000, job);
    await runAtMostEvery("tenant-b", 60_000, job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  // Two concurrent requests to the same page both arrive before either has
  // finished. Without this they would both start the job.
  it("joins an in-flight run instead of starting a second one", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const job = vi.fn().mockImplementation(() => gate);

    const first = runAtMostEvery("k", 60_000, job);
    const second = runAtMostEvery("k", 60_000, job);
    release();
    await Promise.all([first, second]);

    expect(job).toHaveBeenCalledTimes(1);
  });

  // A transient failure must not be cached as "already ran" — that would
  // suppress the job for the whole window on the strength of one error.
  it("does not count a failed run as a run", async () => {
    const job = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue(undefined);
    await expect(runAtMostEvery("k", 60_000, job)).rejects.toThrow("db down");
    await runAtMostEvery("k", 60_000, job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  it("invalidateJob forces the next call to run", async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    await runAtMostEvery("k", 60_000, job);
    await runAtMostEvery("k", 60_000, job);
    expect(job).toHaveBeenCalledTimes(1);

    invalidateJob("k");
    await runAtMostEvery("k", 60_000, job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  it("invalidating one key leaves the others throttled", async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    await runAtMostEvery("a", 60_000, job);
    await runAtMostEvery("b", 60_000, job);
    invalidateJob("a");
    await runAtMostEvery("a", 60_000, job);
    await runAtMostEvery("b", 60_000, job);
    expect(job).toHaveBeenCalledTimes(3);
  });
});
