import { Controller, Get, NotFoundException, Query } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../../common/auth/principal.js";
import { ConsoleMessageSender, MessageSender } from "./messaging.js";

/**
 * DEVELOPMENT ONLY. Lets local QA and Playwright read messages (OTP codes)
 * that would otherwise go to a phone or inbox. AppModule registers this
 * controller only when devOutboxEnabled(env) is true, which env validation
 * makes impossible in staging and production.
 */
@ApiExcludeController()
@Public()
@Controller({ path: "dev/outbox", version: "1" })
export class DevOutboxController {
  constructor(private readonly sender: MessageSender) {}

  @Get()
  list(@Query("to") to?: string) {
    if (!(this.sender instanceof ConsoleMessageSender)) throw new NotFoundException();
    const messages = to ? this.sender.outbox.filter((m) => m.to === to) : this.sender.outbox;
    return { data: [...messages].reverse() };
  }
}
