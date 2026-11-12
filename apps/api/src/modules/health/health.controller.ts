import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/auth/principal.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@ApiTags("health")
@Public()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. */
  @Get()
  live() {
    return { status: "ok", uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: dependencies reachable. Load balancers should route traffic only when this returns 200. */
  @Get("ready")
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks: Record<string, "up" | "down"> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "up";
    } catch {
      checks.database = "down";
    }
    const ok = Object.values(checks).every((v) => v === "up");
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? "ready" : "not_ready", checks };
  }
}
