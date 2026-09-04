import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import { db } from "@nesto/database";
import { renderPrometheus } from "@nesto/observability";
import { enveloped, SkipEnvelope } from "../../common/envelope.interceptor";

@ApiTags("system")
@Controller()
export class HealthController {
  /**
   * Liveness only. Deliberately touches nothing: a liveness probe that queries
   * the database restarts a healthy process during a database blip, which turns
   * a brief outage into a long one.
   */
  @Get("health")
  @ApiOperation({ summary: "Liveness probe" })
  health() {
    return enveloped({ status: "ok" });
  }

  /** Readiness: is this instance able to serve? Here the database check belongs. */
  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  async ready() {
    const started = Date.now();
    await db.$queryRaw`SELECT 1`;
    return enveloped({ status: "ready", databaseMs: Date.now() - started });
  }

  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4")
  @SkipEnvelope()
  @ApiExcludeEndpoint()
  metrics(): string {
    return renderPrometheus();
  }
}
