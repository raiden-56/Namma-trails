import { randomUUID } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Principal } from "@kt/domain";
import { z } from "zod";
import { AuditService } from "../../common/audit/audit.service.js";
import { CurrentPrincipal } from "../../common/auth/principal.js";
import { PrincipalService } from "../../common/auth/principal.service.js";
import { s3Client } from "../../common/aws/clients.js";
import { ApiError } from "../../common/errors/api-error.js";
import { publicMediaUrl } from "../../common/media-url.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { ENV, type Env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";

/*
 * File uploads (photos and partner documents), kept in Amazon S3.
 *
 * The file itself never passes through the API. That keeps the API tasks small and cheap:
 *   1. The browser asks for an upload.  POST /media/uploads
 *      The API checks who is asking, the file type and the size, records the file, and
 *      answers with a link that allows exactly one upload for five minutes.
 *   2. The browser sends the file straight to S3 with that link.
 *   3. The browser says it is done.     POST /media/uploads/:id/complete
 *      The API looks at what really arrived. Only then can the file be used.
 *
 * Public files (photos) are read through the CDN. Private files (documents) can only be
 * read with a short-lived link, given to people who are allowed to see them.
 *
 * Deleting a file only marks it as deleted. The file stays in S3, and the buckets keep
 * old versions, so nothing is lost for good.
 */

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const DOCUMENT_TYPES = { ...IMAGE_TYPES, "application/pdf": "pdf" } as const;
const MB = 1024 * 1024;

const PURPOSES = {
  /** A photo of a listing. Public. */
  service_photo: { visibility: "public", types: IMAGE_TYPES, maxBytes: 8 * MB, needsProvider: true },
  /** A photo of a town. Public. */
  destination_photo: { visibility: "public", types: IMAGE_TYPES, maxBytes: 8 * MB, needsProvider: false },
  /** A partner's licence, permit or identity proof. Private. */
  provider_document: { visibility: "private", types: DOCUMENT_TYPES, maxBytes: 10 * MB, needsProvider: true },
} as const;
type Purpose = keyof typeof PURPOSES;

const uploadSchema = z.object({
  purpose: z.enum(["service_photo", "destination_photo", "provider_document"]),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().positive(),
  /** Needed for a listing photo or a partner document. */
  providerId: z.uuid().optional(),
  altText: z.string().trim().max(240).optional(),
});
type UploadInput = z.infer<typeof uploadSchema>;

/** Every public file's key starts with this. The CDN sends "/media/*" to the public bucket as it is. */
const PUBLIC_PREFIX = "media/";
const UPLOAD_LINK_SECONDS = 300;
const DOWNLOAD_LINK_SECONDS = 60;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly principals: PrincipalService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private bucket(visibility: "public" | "private"): string {
    const name = visibility === "public" ? this.env.S3_PUBLIC_BUCKET : this.env.S3_PRIVATE_BUCKET;
    if (!name) throw new ApiError(503, "STORAGE_NOT_CONFIGURED", "File storage is not set up on this server");
    return name;
  }

  /** Who may add or remove a file of this kind. */
  private authorize(principal: Principal | undefined, purpose: Purpose, providerId: string | undefined): void {
    if (purpose === "destination_photo") {
      this.principals.assert(principal, "destination.manage");
      return;
    }
    if (!providerId) throw ApiError.badRequest("PROVIDER_REQUIRED", "providerId is required for this kind of file");
    this.principals.assertOrg(principal, purpose === "service_photo" ? "org.listing.manage" : "org.documents.manage", providerId);
  }

  async createUpload(principal: Principal | undefined, input: UploadInput) {
    const rule = PURPOSES[input.purpose];
    this.authorize(principal, input.purpose, input.providerId);
    const extension = (rule.types as Record<string, string>)[input.mimeType];
    if (!extension) throw ApiError.badRequest("FILE_TYPE_NOT_ALLOWED", `Allowed file types: ${Object.keys(rule.types).join(", ")}`);
    if (input.sizeBytes > rule.maxBytes) throw ApiError.badRequest("FILE_TOO_LARGE", `The file may be at most ${rule.maxBytes / MB} MB`);

    const bucket = this.bucket(rule.visibility);
    const folder =
      input.purpose === "destination_photo" ? "destinations" : `providers/${input.providerId}/${input.purpose === "service_photo" ? "services" : "documents"}`;
    // Public files live under "media/", which is the one path the CDN serves from the bucket.
    const objectKey = `${rule.visibility === "public" ? PUBLIC_PREFIX : ""}${folder}/${randomUUID()}.${extension}`;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        bucket,
        objectKey,
        visibility: rule.visibility,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        // Filled in when the upload is checked (step 3).
        sha256: "0".repeat(64),
        altText: input.altText ?? null,
        uploadedBy: principal?.userId ?? null,
      },
      select: { id: true },
    });

    // The link only works for this key, this type and this exact size.
    const uploadUrl = await getSignedUrl(
      s3Client(this.env),
      new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: input.mimeType, ContentLength: input.sizeBytes }),
      { expiresIn: UPLOAD_LINK_SECONDS },
    );
    await this.audit.record({
      actorId: principal?.userId ?? null,
      actorType: "user",
      action: "media.upload.start",
      entityType: "media_asset",
      entityId: asset.id,
      providerId: input.providerId ?? null,
      after: { purpose: input.purpose, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
    });
    return { id: asset.id, uploadUrl, method: "PUT" as const, headers: { "Content-Type": input.mimeType }, expiresInSeconds: UPLOAD_LINK_SECONDS };
  }

  private async own(principal: Principal | undefined, id: string) {
    if (!principal) throw ApiError.unauthorized();
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (!asset) throw ApiError.notFound("File");
    return asset;
  }

  /** The provider a file belongs to, read from its key ("providers/<id>/..."). */
  private providerOf(objectKey: string): string | undefined {
    return /^(?:media\/)?providers\/([0-9a-f-]{36})\//.exec(objectKey)?.[1];
  }

  private purposeOf(asset: { objectKey: string; visibility: string }): Purpose {
    if (asset.objectKey.startsWith(`${PUBLIC_PREFIX}destinations/`)) return "destination_photo";
    return asset.visibility === "private" ? "provider_document" : "service_photo";
  }

  async completeUpload(principal: Principal | undefined, id: string) {
    const asset = await this.own(principal, id);
    if (asset.uploadedBy !== principal?.userId) throw ApiError.forbidden();
    let head;
    try {
      head = await s3Client(this.env).send(new HeadObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }));
    } catch {
      throw ApiError.conflict("UPLOAD_NOT_FOUND", "The file has not arrived yet. Upload it first, then try again.");
    }
    if (head.ContentLength !== asset.sizeBytes) throw ApiError.conflict("UPLOAD_SIZE_MISMATCH", "The uploaded file does not have the announced size");
    const verified = await this.prisma.mediaAsset.update({ where: { id }, data: { verifiedAt: new Date() } });
    return { id, url: verified.visibility === "public" ? publicMediaUrl(verified) : null, visibility: verified.visibility };
  }

  /** A short-lived link to read a private file (partner documents). */
  async downloadUrl(principal: Principal | undefined, id: string) {
    const asset = await this.own(principal, id);
    if (asset.visibility === "public") return { url: publicMediaUrl(asset), expiresInSeconds: null };
    const providerId = this.providerOf(asset.objectKey);
    const isReviewer = principal?.platformPermissions.has("provider.document.read_private") ?? false;
    if (!isReviewer) {
      if (!providerId) throw ApiError.forbidden();
      this.principals.assertOrg(principal, "org.documents.manage", providerId);
    }
    const url = await getSignedUrl(s3Client(this.env), new GetObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }), { expiresIn: DOWNLOAD_LINK_SECONDS });
    await this.audit.record({
      actorId: principal?.userId ?? null,
      actorType: isReviewer ? "admin" : "provider",
      action: "media.private.read",
      entityType: "media_asset",
      entityId: id,
      providerId: providerId ?? null,
    });
    return { url, expiresInSeconds: DOWNLOAD_LINK_SECONDS };
  }

  /** Soft delete: the file is hidden everywhere, but kept. */
  async remove(principal: Principal | undefined, id: string) {
    const asset = await this.own(principal, id);
    const providerId = this.providerOf(asset.objectKey);
    this.authorize(principal, this.purposeOf(asset), providerId);
    await this.prisma.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      actorId: principal?.userId ?? null,
      actorType: "user",
      action: "media.delete",
      entityType: "media_asset",
      entityId: id,
      providerId: providerId ?? null,
      before: { objectKey: asset.objectKey },
    });
  }
}

@ApiTags("media")
@ApiBearerAuth()
@Controller({ path: "media", version: "1" })
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("uploads")
  @ApiOperation({ summary: "Start an upload: returns a one-time link to send the file straight to storage" })
  async start(@CurrentPrincipal() principal: Principal | undefined, @Body(new ZodPipe(uploadSchema)) body: UploadInput) {
    return { data: await this.media.createUpload(principal, body) };
  }

  @Post("uploads/:id/complete")
  @HttpCode(200)
  @ApiOperation({ summary: "Finish an upload: the server checks the file that arrived" })
  async complete(@CurrentPrincipal() principal: Principal | undefined, @Param("id", ParseUUIDPipe) id: string) {
    return { data: await this.media.completeUpload(principal, id) };
  }

  @Get(":id/download-url")
  @ApiOperation({ summary: "A short-lived link to read a file (needed for private documents)" })
  async download(@CurrentPrincipal() principal: Principal | undefined, @Param("id", ParseUUIDPipe) id: string) {
    return { data: await this.media.downloadUrl(principal, id) };
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a file (soft delete: it is hidden, not destroyed)" })
  async remove(@CurrentPrincipal() principal: Principal | undefined, @Param("id", ParseUUIDPipe) id: string) {
    await this.media.remove(principal, id);
  }
}

@Module({ controllers: [MediaController], providers: [MediaService] })
export class MediaModule {}
