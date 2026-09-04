import { describe, it, expect } from "vitest";
import { allEvents, isSupported, parseEventType, canonicalize, eventEnvelopeSchema } from "./index";

describe("event registry", () => {
  it("registers the whole §20.7 baseline catalogue", () => {
    // The PRD lists 33 baseline events; every one must exist before a phase
    // claims to publish it.
    expect(allEvents().length).toBe(33);
  });

  it("names every event as <domain>.<capability>.<action>.vN", () => {
    for (const e of allEvents()) {
      expect(() => parseEventType(e.type)).not.toThrow();
      expect(parseEventType(e.type).version).toBe(e.version);
    }
  });

  it("reports an unknown type as unsupported so the relay dead-letters it", () => {
    expect(isSupported("nonsense.thing.happened.v1")).toBe(false);
    expect(isSupported("payment.posted.v1")).toBe(true);
  });

  it("uses past-tense action segments — an event is a completed fact", () => {
    const commandish = ["create", "update", "delete", "post", "issue", "submit", "approve"];
    for (const e of allEvents()) {
      expect(commandish).not.toContain(parseEventType(e.type).action);
    }
  });

  it("keeps bid amounts out of the tender payload", () => {
    // A competitor must not be able to learn a price from a projection built on
    // events (§17.3).
    const bid = allEvents().find((e) => e.type === "tender.bid.submitted.v1")!;
    const shape = Object.keys((bid.schema as unknown as { shape: Record<string, unknown> }).shape);
    expect(shape).not.toContain("amount");
    expect(shape).not.toContain("price");
    expect(shape).not.toContain("total");
  });

  it("validates a well-formed envelope and rejects a malformed type", () => {
    const base = {
      eventId: "01931f4e-0000-7000-8000-000000000001",
      eventType: "payment.posted.v1",
      schemaVersion: 1,
      occurredAt: "2026-09-04T12:00:00.000Z",
      producer: "finance",
      tenantId: "01931f4e-0000-7000-8000-000000000002",
      aggregateType: "PAYMENT",
      aggregateId: "01931f4e-0000-7000-8000-000000000003",
      aggregateVersion: 1,
      actor: { type: "USER" as const, id: "01931f4e-0000-7000-8000-000000000004" },
      correlationId: "corr-1",
      data: {},
    };
    expect(eventEnvelopeSchema.safeParse(base).success).toBe(true);
    expect(eventEnvelopeSchema.safeParse({ ...base, eventType: "PaymentPosted" }).success).toBe(false);
  });
});

describe("canonicalize", () => {
  it("is stable regardless of key order, which is what the hash chain needs", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("drops undefined but keeps null, which are different facts", () => {
    expect(canonicalize({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("handles nesting and arrays", () => {
    expect(canonicalize({ z: [3, { y: 1, x: 2 }] })).toBe('{"z":[3,{"x":2,"y":1}]}');
  });
});
