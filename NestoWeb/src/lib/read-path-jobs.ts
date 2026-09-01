import "server-only";

/**
 * Throttle for idempotent maintenance jobs that pages run before reading.
 *
 * Several pages call an `ensure…`/`backfill…`/`process…` helper on every
 * render to repair or top up state before listing it. Each is idempotent and
 * almost always a no-op — but "no-op" still means a query, and against a
 * remote database a query is a ~125ms network round trip that the page cannot
 * overlap with anything, because the read that follows depends on it. That is
 * a permanent per-render tax paid to handle a condition that is true once.
 *
 * This runs such a job at most once per `everyMs` per key, per server
 * instance. What that costs: work the job would have done can be up to
 * `everyMs` late. Each call site picks a window where that is harmless, and
 * `invalidateJob` exists for the cases where a writer knows it has just
 * created work the next reader must not miss.
 *
 * Deliberately in-process rather than in the cache layer: the state is a
 * scheduling hint, not data. If a second instance runs the job too, or a
 * deploy resets the map, the only consequence is a job running sooner than it
 * strictly had to — which is exactly what happened before this existed.
 */
type Entry = { ranAt: number; inFlight: Promise<unknown> | null };

const runs = new Map<string, Entry>();

export async function runAtMostEvery(key: string, everyMs: number, job: () => Promise<unknown>): Promise<void> {
  const entry = runs.get(key);
  const now = Date.now();

  // Already running — join it rather than firing a second copy. Two concurrent
  // requests to the same page would otherwise both start the job.
  if (entry?.inFlight) {
    await entry.inFlight;
    return;
  }
  if (entry && now - entry.ranAt < everyMs) return;

  const inFlight = job();
  runs.set(key, { ranAt: now, inFlight });
  try {
    await inFlight;
    runs.set(key, { ranAt: Date.now(), inFlight: null });
  } catch (error) {
    // A failed run must not count as a run, or a transient error would be
    // cached for the whole window.
    runs.delete(key);
    throw error;
  }
}

/** Forces the next `runAtMostEvery(key, …)` to run, whatever the window says. */
export function invalidateJob(key: string) {
  runs.delete(key);
}

/** Test seam — the maps are module state and would otherwise leak between cases. */
export function __resetJobsForTest() {
  runs.clear();
}
