# ADR-0007 — Object storage, malware scan and signed access

**Status:** Accepted · 2026-09-04 · PRD §21, Appendix D.7

## Context
Uploaded bytes are the highest-risk untrusted input in the platform, and a leaked object key or a
long-lived signed URL bypasses every authorization control the application has.

## Decision
- **Store.** S3-compatible, private, no public ACL. MinIO locally, an EU S3-compatible bucket in
  production. Two buckets: `nesto-quarantine` and `nesto-objects`.
- **Keys** are random (`<uuidv7>/<random>`), carry no tenant, company, user or file name, and are never
  returned to a client.
- **Two-step upload** (§21.1): `POST /files/intents` evaluates permission, quota and allowed type and
  creates a `FileObject` in `PENDING_UPLOAD` with a presigned PUT to quarantine (5-minute expiry);
  `POST /files/{id}/complete` verifies existence, size and checksum and moves it to `SCANNING`.
- **Scanning** is a driver behind `MalwareScannerPort`. `clamav` for real deployments; `permissive-dev`
  locally, which marks `CLEAN` and logs loudly. The application **refuses to boot** with `permissive-dev`
  when `NODE_ENV=production`. Declared deviation D-3.
- **MIME** is decided by content sniffing (magic bytes), never by the client's claim; a mismatch rejects.
- **Gate.** A `FileObject` that is not `CLEAN` cannot be attached, linked to a DocumentRevision,
  downloaded or previewed. The API answers `ATTACHMENT_NOT_CLEAN` (423).
- **Download** is always `GET /files/{id}/download`: authorize now, then issue a 60-second presigned GET.
  No signed URL is ever stored, cached or embedded in a page.
- **Deletion and legal hold** apply to metadata and object together; a legal hold blocks both.
- **Deduplication** by checksum happens only within one tenant, so object reuse cannot reveal that another
  tenant holds the same file.

## Consequences
- A stolen URL is useful for at most a minute and only to someone who already passed authorization.
- Local development exercises the entire real pipeline — quarantine, states, gate — with only the scanner
  substituted, so nothing about the flow is faked.
