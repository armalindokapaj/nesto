/**
 * S3-compatible object storage — ADR-0007, PRD §21.
 *
 * Rules this class exists to make unavoidable:
 *   - keys are random and carry no tenant, company, user or file name, so a key
 *     that leaks says nothing about what it holds or whose it is;
 *   - buckets are private and no signed URL is ever stored or cached — every
 *     download re-authorizes and gets sixty seconds;
 *   - bytes land in quarantine first and are promoted only after inspection.
 */

import { randomBytes } from "node:crypto";
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  CopyObjectCommand, HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const UPLOAD_URL_TTL_SECONDS = 300;
export const DOWNLOAD_URL_TTL_SECONDS = 60;

export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  objectsBucket: string;
  quarantineBucket: string;
  forcePathStyle: boolean;
};

export function storageConfigFromEnv(): StorageConfig {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for object storage.`);
    return value;
  };
  return {
    endpoint: required("STORAGE_ENDPOINT"),
    region: process.env["STORAGE_REGION"] ?? "eu-central-1",
    accessKeyId: required("STORAGE_ACCESS_KEY"),
    secretAccessKey: required("STORAGE_SECRET_KEY"),
    objectsBucket: required("STORAGE_BUCKET_OBJECTS"),
    quarantineBucket: required("STORAGE_BUCKET_QUARANTINE"),
    forcePathStyle: (process.env["STORAGE_FORCE_PATH_STYLE"] ?? "true") === "true",
  };
}

/**
 * A key with no meaning in it.
 *
 * The two-character shard prefix is for the store's own sake — a flat bucket
 * with millions of keys lists badly — and carries no information about the
 * object. Deliberately absent: tenant id, company name, original filename,
 * upload date. §21.2 requires that a key leak nothing.
 */
export function newObjectKey(): string {
  const raw = randomBytes(24).toString("hex");
  return `${raw.slice(0, 2)}/${raw.slice(2)}`;
}

export class ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly config: StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  /** Step 3 of §21.1: the browser uploads straight to quarantine, so file bytes
   *  never pass through the API (§25.2 "file transfer bypasses API byte proxy"). */
  async presignQuarantineUpload(key: string, contentType: string, contentLength: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.quarantineBucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS }
    );
  }

  /** Issued only after a fresh authorization check, and never stored (§21.2). */
  async presignDownload(key: string, fileName: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.objectsBucket,
        Key: key,
        // Forces a download with the original name rather than rendering
        // attacker-controlled content inline in the viewer's origin.
        ResponseContentDisposition: `attachment; filename="${fileName.replace(/["\\]/g, "")}"`,
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
    );
  }

  async headQuarantine(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.quarantineBucket, Key: key })
      );
      return { size: out.ContentLength ?? 0, contentType: out.ContentType };
    } catch {
      return null;
    }
  }

  async readQuarantine(key: string, maxBytes?: number): Promise<Buffer> {
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.quarantineBucket,
        Key: key,
        ...(maxBytes ? { Range: `bytes=0-${maxBytes - 1}` } : {}),
      })
    );
    const chunks: Buffer[] = [];
    for await (const chunk of out.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  /** Promotion is a copy-then-delete, in that order. If the delete fails the
   *  object is merely duplicated; if it were the other way round a failure
   *  would lose the file. */
  async promoteToObjects(key: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.config.objectsBucket,
        Key: key,
        CopySource: `${this.config.quarantineBucket}/${key}`,
      })
    );
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.quarantineBucket, Key: key }));
  }

  async deleteQuarantine(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.quarantineBucket, Key: key }));
  }

  /** Used by the retention runbook. Legal hold is checked by the caller before
   *  this is reached — §11.10 makes a hold block the purge of both metadata and
   *  object. */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.objectsBucket, Key: key }));
  }

  async putForTest(bucket: "objects" | "quarantine", key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket === "objects" ? this.config.objectsBucket : this.config.quarantineBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }
}

let shared: ObjectStore | undefined;
export function objectStore(): ObjectStore {
  shared ??= new ObjectStore(storageConfigFromEnv());
  return shared;
}
