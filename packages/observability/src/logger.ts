/**
 * Structured logging with correlation — PRD §25.3.
 *
 * Every line carries the request and correlation ids, so one identifier traces
 * a business flow across the API, a queue and an event consumer (§28.23).
 * Everything logged passes through redaction on the way out; a logger you have
 * to remember to sanitise is one that eventually leaks a token.
 */

import type { ExecutionContext } from "@nesto/contracts";
import { redact } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
};

function currentLevel(): LogLevel {
  const raw = (process.env["LOG_LEVEL"] ?? "info").toLowerCase();
  return (["debug", "info", "warn", "error"] as const).includes(raw as LogLevel) ? (raw as LogLevel) : "info";
}

function emit(level: LogLevel, message: string, base: LogFields, fields?: LogFields): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[currentLevel()]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(redact({ ...base, ...fields }) as LogFields),
  };
  // One JSON object per line: greppable by a human, parseable by a collector.
  const text = JSON.stringify(line);
  if (level === "error") process.stderr.write(text + "\n");
  else process.stdout.write(text + "\n");
}

export function createLogger(base: LogFields = {}): Logger {
  return {
    debug: (m, f) => emit("debug", m, base, f),
    info: (m, f) => emit("info", m, base, f),
    warn: (m, f) => emit("warn", m, base, f),
    error: (m, f) => emit("error", m, base, f),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

/** A logger bound to a request. Tenant and company are included because a
 *  support question always starts with "which company?". */
export function loggerFor(ctx: ExecutionContext, base: LogFields = {}): Logger {
  return createLogger({
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    audience: ctx.audience,
    tenantId: ctx.tenantId,
    companyId: ctx.activeCompanyId,
    projectId: ctx.activeProjectId,
    ...base,
  });
}

export const logger = createLogger({ service: "nesto" });
