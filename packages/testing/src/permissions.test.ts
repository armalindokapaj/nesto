import { describe, it, expect, beforeAll } from "vitest";
import { isValidPermissionKey, type PermissionDefinition } from "@nesto/contracts";
import { registerPermissions, allPermissions, clearPermissionsForTest, ROLE_MATRIX, patternMatches } from "@nesto/policy";
import { foundationPermissions } from "@nesto/domain-foundation";
import { identityPermissions } from "@nesto/domain-identity";
import { authorizationPermissions } from "@nesto/domain-authorization";
import { organizationPermissions } from "@nesto/domain-organization";
import { projectsPermissions } from "@nesto/domain-projects";

const manifests: [string, PermissionDefinition[]][] = [
  ["foundation", foundationPermissions],
  ["identity", identityPermissions],
  ["authorization", authorizationPermissions],
  ["organization", organizationPermissions],
  ["projects", projectsPermissions],
];

beforeAll(() => {
  clearPermissionsForTest();
  for (const [, manifest] of manifests) registerPermissions(manifest);
});

describe("the permission manifest (Appendix B)", () => {
  it("uses only keys under a declared domain prefix", () => {
    for (const p of allPermissions()) {
      expect(isValidPermissionKey(p.key), p.key).toBe(true);
    }
  });

  it("declares one owner per key", () => {
    // registerPermissions throws on a second owner; this proves the union has
    // no duplicates in the first place.
    const keys = allPermissions().map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every permission a description that says something", () => {
    for (const p of allPermissions()) {
      expect(p.description.length, p.key).toBeGreaterThan(20);
    }
  });

  it("audits every sensitive permission", () => {
    // §24.3: all sensitive mutations create append-only audit evidence.
    for (const p of allPermissions()) {
      if (p.sensitive) expect(p.auditRequired, p.key).toBe(true);
    }
  });

  it("requires recent authentication for the privileged ones §19.7 names", () => {
    const requiring = allPermissions().filter((p) => p.recentAuthenticationRequired).map((p) => p.key);
    expect(requiring).toContain("company.owner.transfer");
    expect(requiring).toContain("platform.company.activate");
    expect(requiring).toContain("platform.company.delete");
    expect(requiring).toContain("membership.grant.manage");
  });

  it("scopes every platform.* key to PLATFORM and nothing else", () => {
    for (const p of allPermissions().filter((x) => x.key.startsWith("platform."))) {
      expect(p.allowedScopes, p.key).toEqual(["PLATFORM"]);
    }
  });

  it("keeps platform.* out of every base role", () => {
    // Platform Control is a separate audience, not a senior company role (§3.1).
    for (const [role, entry] of Object.entries(ROLE_MATRIX)) {
      for (const p of allPermissions().filter((x) => x.key.startsWith("platform."))) {
        const granted = entry.allow.some((pattern) => patternMatches(pattern, p.key));
        expect(granted, `${role} must not hold ${p.key}`).toBe(false);
      }
    }
  });

  it("has a role that can exercise every non-platform permission", () => {
    // A permission no role can hold is either dead or a gap. Either way it
    // should be visible rather than sitting in a manifest unnoticed.
    const orphans: string[] = [];
    for (const p of allPermissions()) {
      if (p.key.startsWith("platform.")) continue;
      const held = Object.values(ROLE_MATRIX).some((entry) => {
        if (entry.deny?.some((pattern) => patternMatches(pattern, p.key))) return false;
        return entry.allow.some((pattern) => patternMatches(pattern, p.key));
      });
      if (!held) orphans.push(p.key);
    }
    expect(orphans).toEqual([]);
  });
});
