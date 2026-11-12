import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  type Principal,
  type ProviderBusinessInput,
  type ProviderCategoriesInput,
  providerBusinessSchema,
  providerCategoriesSchema,
} from "@kt/domain";
import { CurrentPrincipal } from "../../common/auth/principal.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { ProviderOnboardingService } from "./provider-onboarding.service.js";

@ApiTags("provider-onboarding")
@ApiBearerAuth()
@Controller({ path: "provider-onboarding/applications", version: "1" })
export class ProviderOnboardingController {
  constructor(private readonly onboarding: ProviderOnboardingService) {}

  @Post()
  @ApiOperation({ summary: "Start a partner application; the caller becomes the organisation owner" })
  async create(@CurrentPrincipal() principal: Principal, @Body(new ZodPipe(providerBusinessSchema)) body: ProviderBusinessInput) {
    return { data: await this.onboarding.create(principal, body) };
  }

  @Get(":providerId")
  async status(@CurrentPrincipal() principal: Principal, @Param("providerId", ParseUUIDPipe) providerId: string) {
    return { data: await this.onboarding.status(principal, providerId) };
  }

  @Put(":providerId/business")
  async business(
    @CurrentPrincipal() principal: Principal,
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Body(new ZodPipe(providerBusinessSchema)) body: ProviderBusinessInput,
  ) {
    return { data: await this.onboarding.updateBusiness(principal, providerId, body) };
  }

  @Put(":providerId/scope")
  @ApiOperation({ summary: "Set service categories and operating destinations" })
  async scope(
    @CurrentPrincipal() principal: Principal,
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Body(new ZodPipe(providerCategoriesSchema)) body: ProviderCategoriesInput,
  ) {
    return { data: await this.onboarding.setScope(principal, providerId, body) };
  }

  @Post(":providerId/submit")
  @ApiOperation({ summary: "Submit the application for verification (requires all mandatory documents)" })
  async submit(@CurrentPrincipal() principal: Principal, @Param("providerId", ParseUUIDPipe) providerId: string) {
    return { data: await this.onboarding.submit(principal, providerId) };
  }
}
