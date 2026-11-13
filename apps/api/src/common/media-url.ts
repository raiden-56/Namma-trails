/**
 * The public address of a stored file.
 *
 * Two kinds of file exist:
 *   - bucket "static": a file that ships with the website itself (the licensed photos
 *     under /images). The key already is its address.
 *   - any other bucket: a file uploaded to Amazon S3. Its key starts with "media/".
 *     Visitors never talk to S3 directly; they get the file through the CDN at
 *     MEDIA_BASE_URL + "/" + key. On AWS, MEDIA_BASE_URL is the site address, so a file is
 *     at "https://<site>/media/..." and CloudFront fetches it from the bucket. Locally it
 *     is the address of the S3 stand-in, for example "http://localhost:9090/kt-public".
 */
export function publicMediaUrl(media: { bucket: string; objectKey: string }): string {
  if (media.bucket === "static") return media.objectKey;
  const base = (process.env.MEDIA_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/${media.objectKey}`;
}
