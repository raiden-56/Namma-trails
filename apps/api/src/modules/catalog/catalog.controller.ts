import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { slug } from "@kt/domain";
import { Public } from "../../common/auth/principal.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { CatalogService } from "./catalog.service.js";

@ApiTags("catalog")
@Public()
@Controller({ version: "1" })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  async categories() {
    return { data: await this.catalog.listCategories() };
  }

  @Get("destinations")
  async destinations() {
    return { data: await this.catalog.listDestinations() };
  }

  @Get("destinations/:slug")
  async destination(@Param("slug", new ZodPipe(slug)) destinationSlug: string) {
    return { data: await this.catalog.getDestination(destinationSlug) };
  }
}
