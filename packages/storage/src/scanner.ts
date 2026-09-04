/**
 * Malware scanning — ADR-0007, declared deviation D-3.
 *
 * A driver, because a build machine has no ClamAV and pretending otherwise
 * would be dishonest. Everything around the scanner is real: the quarantine
 * bucket, the FileObject states, the rule that nothing publishes before it is
 * clean. Only the inspection itself is substituted.
 *
 * The `permissive-dev` driver refuses to load in production. That refusal is
 * the whole reason this is a declared deviation rather than a hidden hole: the
 * unsafe path cannot be reached by forgetting to change a setting.
 */

import net from "node:net";

export type ScanVerdict = { clean: true } | { clean: false; signature: string };

export type MalwareScanner = {
  readonly name: string;
  scan(bytes: Buffer): Promise<ScanVerdict>;
};

/** Development and CI only. */
export class PermissiveDevScanner implements MalwareScanner {
  readonly name = "permissive-dev";

  constructor() {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "The permissive-dev malware scanner refuses to run in production. Set MALWARE_SCANNER=clamav and provide a scanner."
      );
    }
  }

  async scan(bytes: Buffer): Promise<ScanVerdict> {
    // The EICAR test string is honoured even here, so the rejection path is
    // exercised by the test suite rather than only existing on paper.
    if (bytes.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"))) {
      return { clean: false, signature: "Eicar-Test-Signature" };
    }
    return { clean: true };
  }
}

/** Talks INSTREAM to a clamd daemon. */
export class ClamAvScanner implements MalwareScanner {
  readonly name = "clamav";

  constructor(
    private readonly host: string,
    private readonly port: number
  ) {}

  async scan(bytes: Buffer): Promise<ScanVerdict> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const chunks: Buffer[] = [];

      socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        const size = Buffer.alloc(4);
        size.writeUInt32BE(bytes.length);
        socket.write(size);
        socket.write(bytes);
        socket.write(Buffer.alloc(4)); // zero-length chunk terminates the stream
      });
      socket.on("data", (d) => chunks.push(d));
      socket.on("error", reject);
      socket.on("end", () => {
        const reply = Buffer.concat(chunks).toString("utf8");
        if (reply.includes("OK")) return resolve({ clean: true });
        const match = /stream: (.+) FOUND/.exec(reply);
        // An unparseable reply is treated as dirty. Failing open on a scanner
        // is the one direction that must never happen.
        resolve({ clean: false, signature: match?.[1] ?? "unknown" });
      });
    });
  }
}

export function createScanner(): MalwareScanner {
  const driver = process.env["MALWARE_SCANNER"] ?? "permissive-dev";
  switch (driver) {
    case "clamav":
      return new ClamAvScanner(process.env["CLAMAV_HOST"] ?? "localhost", Number(process.env["CLAMAV_PORT"] ?? 3310));
    case "permissive-dev":
      return new PermissiveDevScanner();
    default:
      throw new Error(`Unknown MALWARE_SCANNER "${driver}". Use "clamav" or "permissive-dev".`);
  }
}
