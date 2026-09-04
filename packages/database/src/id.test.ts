import { describe, it, expect } from "vitest";
import { newId, idCreatedAt, isUuid, shortRef } from "./id";

describe("identifiers", () => {
  it("mints version 7 uuids", () => {
    const id = newId();
    expect(isUuid(id)).toBe(true);
    // Version nibble sits at position 14 of the canonical form.
    expect(id[14]).toBe("7");
  });

  it("sorts lexicographically in creation order, which is why v7 was chosen", () => {
    const ids = Array.from({ length: 50 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
  });

  it("recovers the creation instant", () => {
    const before = Date.now();
    const t = idCreatedAt(newId()).getTime();
    expect(t).toBeGreaterThanOrEqual(before - 5);
    expect(t).toBeLessThanOrEqual(Date.now());
  });

  it("takes shortRef from the entropy, not the timestamp prefix", () => {
    // Ids minted in the same millisecond share their leading digits. A fixture
    // that used the head collided on a unique constraint; this is the guard.
    const batch = Array.from({ length: 200 }, () => newId());
    expect(new Set(batch.map(shortRef)).size).toBe(200);
    expect(new Set(batch.map((id) => id.slice(0, 8))).size).toBeLessThan(200);
  });

  it("rejects things that are not uuids", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
