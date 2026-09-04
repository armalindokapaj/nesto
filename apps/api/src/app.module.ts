import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ContextMiddleware } from "./common/context.middleware";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [HealthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // "{*path}" rather than "*": path-to-regexp v8 requires a named wildcard, and
    // the bare form is auto-converted with a deprecation warning.
    consumer.apply(ContextMiddleware).forRoutes("{*path}");
  }
}
