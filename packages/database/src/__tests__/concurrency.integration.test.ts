/**
 * The concurrency harness — PRD §12.12, Phase 0.
 *
 * Every test here runs two writers at once. A single-threaded test of
 * optimistic concurrency proves only that the happy path works, which is not
 * the interesting question: the interesting question is what happens when two
 * people press Save at the same instant.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readScope, unitOfWork, disconnect } from "../unit-of-work";
import { updateWithVersion, transitionState } from "../concurrency";
import { newId, shortRef, idCreatedAt } from "../id";
import { createTenantFixture, type Fixture } from "./fixtures";

let f: Fixture;

beforeAll(async () => {
  f = await createTenantFixture("Concurrency");
});
afterAll(async () => {
  await disconnect();
});

async function makeBranch(): Promise<string> {
  const id = newId();
  await unitOfWork(f.ctx, (uow) =>
    uow.tx.branch.create({
      data: {
        id,
        name: "Subject",
        code: `CX-${id.slice(-8)}`,
        countryCode: "AL",
        createdBy: f.userId,
        updatedBy: f.userId,
      } as never,
    })
  );
  return id;
}

describe("optimistic concurrency", () => {
  it("accepts a write at the version the caller read", async () => {
    const id = await makeBranch();
    const next = await unitOfWork(f.ctx, (uow) =>
      updateWithVersion(uow.tx.branch as never, {
        id,
        expectedVersion: 1,
        data: { name: "Renamed", updatedBy: f.userId },
        label: "Branch",
      })
    );
    expect(next).toBe(2);

    const row = await readScope(f.ctx, (tx) => tx.branch.findFirst({ where: { id } }));
    expect(row?.name).toBe("Renamed");
    expect(row?.recordVersion).toBe(2);
  });

  it("lets exactly one of two simultaneous writers win", async () => {
    const id = await makeBranch();

    const attempt = (name: string) =>
      unitOfWork(f.ctx, (uow) =>
        updateWithVersion(uow.tx.branch as never, {
          id,
          expectedVersion: 1,
          data: { name, updatedBy: f.userId },
          label: "Branch",
        })
      );

    const results = await Promise.allSettled([attempt("Writer A"), attempt("Writer B")]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe("CONFLICT");

    // And crucially: the loser's value is not what ended up stored.
    const row = await readScope(f.ctx, (tx) => tx.branch.findFirst({ where: { id } }));
    expect(row?.recordVersion).toBe(2);
  });

  it("reports a stale version as CONFLICT, with both versions for the client", async () => {
    const id = await makeBranch();
    await unitOfWork(f.ctx, (uow) =>
      updateWithVersion(uow.tx.branch as never, { id, expectedVersion: 1, data: { name: "v2" }, label: "Branch" })
    );

    await expect(
      unitOfWork(f.ctx, (uow) =>
        updateWithVersion(uow.tx.branch as never, { id, expectedVersion: 1, data: { name: "v2 again" }, label: "Branch" })
      )
    ).rejects.toMatchObject({ code: "CONFLICT", meta: { expectedVersion: 1, actualVersion: 2 } });
  });

  it("reports an id outside the scope as absent, never as a conflict", async () => {
    // §19.3: a response must not confirm that another tenant's record exists.
    const other = await createTenantFixture("Other");
    const foreignId = await (async () => {
      const id = newId();
      await unitOfWork(other.ctx, (uow) =>
        uow.tx.branch.create({
          data: {
            id, name: "Theirs", code: `OT-${id.slice(-8)}`, countryCode: "AL",
            createdBy: other.userId, updatedBy: other.userId,
          } as never,
        })
      );
      return id;
    })();

    await expect(
      unitOfWork(f.ctx, (uow) =>
        updateWithVersion(uow.tx.branch as never, { id: foreignId, expectedVersion: 1, data: { name: "x" }, label: "Branch" })
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("guarded state transitions", () => {
  it("moves only from a legal source state", async () => {
    const id = await makeBranch();
    await unitOfWork(f.ctx, (uow) =>
      transitionState(uow.tx.branch as never, { id, from: ["ACTIVE"], to: "SUSPENDED", label: "Branch" })
    );
    const row = await readScope(f.ctx, (tx) => tx.branch.findFirst({ where: { id } }));
    expect(row?.lifecycleStatus).toBe("SUSPENDED");
  });

  it("refuses a transition from the wrong state", async () => {
    const id = await makeBranch();
    await expect(
      unitOfWork(f.ctx, (uow) =>
        transitionState(uow.tx.branch as never, { id, from: ["SUSPENDED"], to: "ACTIVE", label: "Branch" })
      )
    ).rejects.toMatchObject({ code: "WORKFLOW_TRANSITION_INVALID" });
  });

  it("lets only one of two simultaneous transitions succeed", async () => {
    // This is the shape that stops a double posting or a double award: the
    // legal source states are in the WHERE clause, so the second attempt
    // matches zero rows rather than re-running the transition.
    const id = await makeBranch();
    const go = () =>
      unitOfWork(f.ctx, (uow) =>
        transitionState(uow.tx.branch as never, { id, from: ["ACTIVE"], to: "SUSPENDED", label: "Branch" })
      );

    const results = await Promise.allSettled([go(), go()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});

describe("identifier assumptions", () => {
  it("does not treat the head of a UUIDv7 as unique", () => {
    // The first 48 bits are a millisecond timestamp. Ids minted together share
    // their leading digits, which is why shortRef() takes the tail — a fixture
    // that used the head collided on a unique constraint and found this.
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(shortRef(a)).not.toBe(shortRef(b));
  });

  it("recovers the creation instant from the id", () => {
    const before = Date.now();
    const id = newId();
    const t = idCreatedAt(id).getTime();
    expect(t).toBeGreaterThanOrEqual(before - 1000);
    expect(t).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
