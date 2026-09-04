/**
 * The permission manifest registry — PRD Appendix B, ADR-0004.
 *
 * Permissions are declared data, not string literals scattered through the code.
 * Each domain exports a manifest; the union is the platform's vocabulary. An
 * architecture test fails the build when code references a key nobody declared,
 * which is what stops anyone inventing authority by typing a new string.
 */

import { isValidPermissionKey, type PermissionDefinition } from "@nesto/contracts";

const definitions = new Map<string, PermissionDefinition>();

export function registerPermissions(manifest: PermissionDefinition[]): void {
  for (const def of manifest) {
    if (!isValidPermissionKey(def.key)) {
      throw new Error(`"${def.key}" is not a valid permission key: expected <domain>.<...> under a declared prefix.`);
    }
    const existing = definitions.get(def.key);
    if (existing && existing.domain !== def.domain) {
      throw new Error(
        `Permission "${def.key}" is claimed by both ${existing.domain} and ${def.domain}. One owner per permission.`
      );
    }
    definitions.set(def.key, def);
  }
}

export function getPermission(key: string): PermissionDefinition | undefined {
  return definitions.get(key);
}

export function allPermissions(): PermissionDefinition[] {
  return [...definitions.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function permissionExists(key: string): boolean {
  return definitions.has(key);
}

export function clearPermissionsForTest(): void {
  definitions.clear();
}
