import { describe, it, expect } from "vitest";
import { can, canWrite, levelFor, PERMISSION_MATRIX, RESOURCES } from "@/lib/permissions";
import { ROLES } from "@/lib/constants";

describe("permission matrix", () => {
  it("every role has an explicit entry for every resource (no accidental gaps)", () => {
    for (const role of ROLES) {
      for (const resource of RESOURCES) {
        expect(PERMISSION_MATRIX[role][resource]).toBeDefined();
      }
    }
  });

  it("OWNER and ADMIN have full access to every resource", () => {
    for (const resource of RESOURCES) {
      expect(can("OWNER", resource, "FULL")).toBe(true);
      expect(can("ADMIN", resource, "FULL")).toBe(true);
    }
  });

  it("Architect cannot see Finance — the PRD's explicit acceptance criterion", () => {
    expect(can("ARCHITECT", "FINANCE", "READ")).toBe(false);
    expect(levelFor("ARCHITECT", "FINANCE")).toBe("NONE");
  });

  it("Architect cannot manage users", () => {
    expect(can("ARCHITECT", "USER_MANAGEMENT", "READ")).toBe(false);
  });

  it("Finance role has full access to Finance but not to HR or user management", () => {
    expect(can("FINANCE", "FINANCE", "FULL")).toBe(true);
    expect(can("FINANCE", "HR", "WRITE")).toBe(false);
    expect(can("FINANCE", "USER_MANAGEMENT", "READ")).toBe(false);
  });

  it("HR role has full access to HR but not Finance", () => {
    expect(can("HR", "HR", "FULL")).toBe(true);
    expect(can("HR", "FINANCE", "READ")).toBe(false);
  });

  it("a WRITE requirement is not satisfied by a READ-only grant", () => {
    expect(can("VIEWER", "TASKS", "READ")).toBe(true);
    expect(can("VIEWER", "TASKS", "WRITE")).toBe(false);
  });

  it("Viewer role cannot write to any resource", () => {
    for (const resource of RESOURCES) {
      expect(can("VIEWER", resource, "WRITE")).toBe(false);
    }
  });
});

describe("canWrite (access-mode override)", () => {
  it("blocks writes for VIEW_ONLY access mode even for a role that otherwise could write", () => {
    expect(canWrite("PM", "TASKS", "VIEW_ONLY")).toBe(false);
  });

  it("blocks writes for SUSPENDED and ARCHIVED access modes", () => {
    expect(canWrite("OWNER", "PROJECTS", "SUSPENDED")).toBe(false);
    expect(canWrite("OWNER", "PROJECTS", "ARCHIVED")).toBe(false);
  });

  it("allows writes for STANDARD access mode when the role has WRITE+", () => {
    expect(canWrite("PM", "TASKS", "STANDARD")).toBe(true);
  });

  it("still denies writes for STANDARD access mode if the role itself lacks WRITE", () => {
    expect(canWrite("VIEWER", "TASKS", "STANDARD")).toBe(false);
  });
});
