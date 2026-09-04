/**
 * Shared integration-test bootstrap: loads the one .env at the repository root
 * and refuses to run against a connection that bypasses RLS.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env"), quiet: true });

if (!process.env["DATABASE_URL"]?.includes("nesto_app")) {
  throw new Error(
    "Integration tests must connect as nesto_app. The owner connection bypasses RLS, and the suite would pass while proving nothing."
  );
}
