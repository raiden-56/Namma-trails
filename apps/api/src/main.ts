import "reflect-metadata";
import { VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { ENV, type Env } from "./config/env.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const env = app.get<Env>(ENV);
  app.useLogger(app.get(Logger));

  app.set("trust proxy", 1); // behind one load balancer: req.ip is the client IP
  app.use(helmet());
  app.useBodyParser("json", { limit: "1mb" });
  app.enableCors({
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"],
  });
  app.setGlobalPrefix("api", { exclude: ["health", "health/ready"] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableShutdownHooks();

  if (env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Karnataka Tourism Marketplace API")
      .setDescription("Versioned REST API. Errors use { error: { code, message, details, requestId } }.")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, () => SwaggerModule.createDocument(app, config));
  }

  await app.listen(env.PORT);
}

void bootstrap();
