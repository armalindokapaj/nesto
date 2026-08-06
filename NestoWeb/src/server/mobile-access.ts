import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_Mobile_Offline_Platform — Phase 1 "Responsive foundation" only. See
// the schema comment above RegisteredDevice for the scope decision (no
// offline sync engine — this is registration + revocation only).

export async function listMyDevices(tenantId: string, userId: string) {
  return db.registeredDevice.findMany({ where: { tenantId, userId }, orderBy: { lastSeenAt: "desc" } });
}

export async function registerDevice(tenantId: string, userId: string, input: { platform: string; deviceLabel: string }) {
  return db.registeredDevice.create({ data: { tenantId, userId, ...input } });
}

export async function touchDevice(tenantId: string, deviceId: string) {
  const device = assertTenant(await db.registeredDevice.findUnique({ where: { id: deviceId } }), tenantId, "RegisteredDevice");
  if (device.status !== "ACTIVE") return device;
  return db.registeredDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
}

/** A user can always revoke their own device; an admin can revoke any device in the tenant (AC-002-style immediate revocation). */
export async function revokeDevice(tenantId: string, deviceId: string) {
  const device = assertTenant(await db.registeredDevice.findUnique({ where: { id: deviceId } }), tenantId, "RegisteredDevice");
  return db.registeredDevice.update({ where: { id: device.id }, data: { status: "REVOKED", revokedAt: new Date() } });
}

export async function listAllDevicesForTenant(tenantId: string) {
  return db.registeredDevice.findMany({ where: { tenantId }, include: { user: true }, orderBy: { lastSeenAt: "desc" } });
}
