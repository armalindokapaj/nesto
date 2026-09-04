import { describe, it, expect, beforeEach } from "vitest";
import { redact, redactChanges, REDACTED } from "./redact";
import { counter, histogram, renderPrometheus, resetMetricsForTest } from "./metrics";

describe("redaction", () => {
  it("removes anything whose key names a secret", () => {
    const out = redact({ email: "a@b.com", password: "hunter2", mfaSecret: "JBSWY3DP" }) as Record<string, unknown>;
    expect(out["email"]).toBe("a@b.com");
    expect(out["password"]).toBe(REDACTED);
    expect(out["mfaSecret"]).toBe(REDACTED);
  });

  it("removes a token even when the field is innocently named", () => {
    // The failure this catches: someone logs a whole request and the bearer
    // token happens to live under `value`.
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop";
    expect(redact({ value: jwt })).toEqual({ value: REDACTED });
    expect(redact({ h: "Bearer abc.def.ghi" })).toEqual({ h: REDACTED });
  });

  it("keeps ordinary long strings that are not credentials", () => {
    const prose = "A long description of the works to be carried out on site, with spaces.";
    expect(redact({ description: prose })).toEqual({ description: prose });
  });

  it("reaches into nested structures and arrays", () => {
    const out = redact({ user: { name: "A", credentials: { passwordHash: "x" } }, list: [{ apiKey: "k" }] });
    expect(out).toEqual({ user: { name: "A", credentials: REDACTED }, list: [{ apiKey: REDACTED }] });
  });

  it("stops at a depth limit instead of looping on a cycle", () => {
    const deep: Record<string, unknown> = {};
    let node = deep;
    for (let i = 0; i < 20; i++) { node["next"] = {}; node = node["next"] as Record<string, unknown>; }
    expect(JSON.stringify(redact(deep))).toContain("depth-limit");
  });

  it("records that a confidential field changed without recording what it became", () => {
    // §24.3: audit keeps redacted structured changes. The fact of the change is
    // usually what an investigation needs; the value is what it must not carry.
    const changes = redactChanges(
      { grossSalary: 1000, title: "Engineer" },
      { grossSalary: 2000, title: "Senior Engineer" },
      new Set(["grossSalary"])
    );
    expect(changes["grossSalary"]).toEqual({ from: REDACTED, to: REDACTED });
    expect(changes["title"]).toEqual({ from: "Engineer", to: "Senior Engineer" });
  });

  it("omits fields that did not change", () => {
    expect(redactChanges({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: { from: 2, to: 3 } });
  });
});

describe("metrics", () => {
  beforeEach(() => resetMetricsForTest());

  it("counts by label set", () => {
    const c = counter("t_total", "test");
    c({ route: "/a" });
    c({ route: "/a" });
    c({ route: "/b" });
    const out = renderPrometheus();
    expect(out).toContain('t_total{route="/a"} 2');
    expect(out).toContain('t_total{route="/b"} 1');
  });

  it("accumulates histogram buckets cumulatively, as Prometheus expects", () => {
    const h = histogram("t_ms", "test", [10, 100]);
    h(5);
    h(50);
    h(500);
    const out = renderPrometheus();
    expect(out).toContain('t_ms_bucket{le="10"} 1');
    expect(out).toContain('t_ms_bucket{le="100"} 2');
    expect(out).toContain('t_ms_bucket{le="+Inf"} 3');
    expect(out).toContain("t_ms_count 3");
    expect(out).toContain("t_ms_sum 555");
  });
});
