/**
 * API entry point.
 *
 * Fastify rather than Express: the PRD makes this tier the authoritative
 * transport for every read the web apps perform, so its per-request overhead is
 * paid on every page. Fastify's is materially lower, and the mandated hop is
 * already the main cost of the chosen topology (ADR-0019).
 */

import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { writeSync } from "node:fs";

loadEnv({ path: resolve(__dirname, "../../../.env"), quiet: true });

import { NestFactory, Reflector } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyCookie from "@fastify/cookie";
import { logger } from "@nesto/observability";
import { AppModule } from "./app.module";
import { env } from "./env";
import { EnvelopeInterceptor } from "./common/envelope.interceptor";
import { ErrorEnvelopeFilter } from "./common/error.filter";

async function bootstrap(): Promise<void> {
  // Validated before anything else: a missing secret must stop the process, not
  // surface as a confusing 500 hours later (ADR-0017).
  const config = env();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 10 * 1024 * 1024 }),
    // Nest's own logger stays on for warnings and errors. Silencing it entirely
    // hides messages it emits immediately before calling process.exit — such as
    // a missing optional package — and a container that dies with no output is
    // undebuggable.
    { logger: ["error", "warn"] }
  );

  await app.register(fastifyCookie);

  app.setGlobalPrefix("api/v1", { exclude: ["health", "ready", "metrics"] });
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new ErrorEnvelopeFilter());

  // Only the two first-party surfaces, with credentials. A wildcard origin plus
  // credentials is rejected by browsers anyway, and would be wrong here.
  app.enableCors({
    origin: [config.COMPANY_WEB_URL, config.PLATFORM_ADMIN_URL],
    credentials: true,
    allowedHeaders: ["content-type", "authorization", "idempotency-key", "if-match", "x-correlation-id", "x-locale"],
    exposedHeaders: ["x-request-id", "x-correlation-id", "etag"],
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Nesto API")
      .setDescription("NESTO-ARCH-PRD-001 §19. Envelopes per §19.2/§19.3; error codes per §19.8.")
      .setVersion("1.0")
      .addCookieAuth("nesto_refresh")
      .addBearerAuth()
      .build()
  );
  SwaggerModule.setup("api/docs", app, document, { jsonDocumentUrl: "api/openapi.json" });

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info("api.started", { port: config.PORT, env: config.NODE_ENV });
}

void bootstrap().catch((error: unknown) => {
  // writeSync, not the logger: process.exit() discards buffered writes to a
  // pipe, so an async log line here is lost exactly when it is most needed —
  // a container that dies on boot with no output is undebuggable.
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  writeSync(2, `api.bootstrap_failed\n${detail}\n`);
  process.exit(1);
});
