import { describe, it, expect, afterAll } from "vitest";
import { createHash, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { writeFileToStorage, readFileFromStorage, deleteFileFromStorage, STORAGE_VISIBILITY } from "@/lib/storage";
import { createProjectPhoto } from "@/server/project-photos";

const sha = (d: Uint8Array) => createHash("sha256").update(d).digest("hex");

// A real PNG, so nothing here depends on a byte pattern that happens to be
// friendly (all-zero buffers hide plenty of encoding bugs).
const PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);

const created: { url: string }[] = [];

describe("file storage", () => {
  it("round-trips bytes and reports a matching checksum", async () => {
    const stored = await writeFileToStorage("projectPhoto", randomUUID(), "site photo (1).png", PNG, "image/png");
    created.push(stored);
    expect(stored.checksum).toBe(sha(PNG));
    expect(stored.size).toBe(PNG.byteLength);
    expect(sha(await readFileFromStorage(stored.url))).toBe(stored.checksum);
  });

  it("never lets a crafted filename escape the storage root", async () => {
    const id = randomUUID();
    const stored = await writeFileToStorage("documentFile", id, "../../../etc/passwd", PNG, "image/png");
    created.push(stored);
    // The separators are what make traversal possible, not the dots. The name
    // must end up as one flat segment under <model>/<id>/.
    const key = stored.url.replace(/^local:/, "");
    expect(key.startsWith(`documentFile/${id}/`)).toBe(true);
    expect(key.slice(`documentFile/${id}/`.length)).not.toContain("/");
    expect(sha(await readFileFromStorage(stored.url))).toBe(sha(PNG));
  });

  it("keeps every model private, so nothing is served by a bare URL", () => {
    // Guards the 2.4 decision: flipping a model to "public" drops both the
    // permission check and the tenant check its route performs today.
    expect(Object.values(STORAGE_VISIBILITY).every((v) => v === "private")).toBe(true);
  });
});

describe("the live upload path", () => {
  it("stores content outside the database and records a matching checksum", async () => {
    // The backfill itself is a one-time script whose columns no longer exist
    // (see its header). What has to keep working is the path every new upload
    // takes: bytes to storage, only a URL and a checksum in the row.
    const tenant = await db.tenant.findFirst();
    const project = tenant ? await db.project.findFirst({ where: { tenantId: tenant.id } }) : null;
    const uploader = await db.userIdentity.findFirst();
    if (!tenant || !project || !uploader) throw new Error("seed the database before running this test");

    const photo = await createProjectPhoto(tenant.id, {
      projectId: project.id,
      uploadedById: uploader.id,
      file: { data: PNG, mimeType: "image/png", size: PNG.byteLength },
      caption: "storage round-trip",
    });

    try {
      expect(photo.fileUrl).toBeTruthy();
      expect(photo.checksum).toBe(sha(PNG));
      expect(photo.fileSize).toBe(PNG.byteLength);
      // The bytes are genuinely retrievable, and byte-identical.
      expect(sha(await readFileFromStorage(photo.fileUrl))).toBe(sha(PNG));
      created.push({ url: photo.fileUrl });
      // And no column on the row carries the content itself any more.
      expect(Object.keys(photo)).not.toContain("fileData");
    } finally {
      await db.projectPhoto.delete({ where: { id: photo.id } });
    }
  });
});

afterAll(async () => {
  for (const { url } of created) await deleteFileFromStorage(url).catch(() => {});
  await db.$disconnect();
});
