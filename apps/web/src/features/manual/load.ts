import fs from "node:fs";
import path from "node:path";
import { parseMarkdown, type Block, type Picture } from "./markdown";

/**
 * Loads the user manual for the public /user-manual page.
 *
 * One source of truth: the manual is docs/FEATURES.md at the repository root, and its
 * screenshots are apps/web/public/manual/*. The page is static, so the file is read when
 * the site is built (and on each request in development). Server-side only.
 */

export interface ManualPicture extends Picture {
  /** Pixel size of the image file, so the page can reserve its space. */
  fileWidth: number;
  fileHeight: number;
}

export type ManualBlock = Exclude<Block, { type: "pictures" }> | { type: "pictures"; items: ManualPicture[] };

export interface Manual {
  title: string;
  /** Blocks between the title and the first numbered section (the short introduction). */
  intro: ManualBlock[];
  /** The numbered sections, in order. */
  sections: Array<{ id: string; title: string; blocks: ManualBlock[] }>;
}

function firstExisting(candidates: string[]): string | null {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** Width and height of a PNG or JPEG file, read from its header. */
function imageSize(file: string): { width: number; height: number } {
  const fallback = { width: 1440, height: 900 };
  try {
    const bytes = fs.readFileSync(file);
    if (bytes.subarray(1, 4).toString("ascii") === "PNG") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return fallback;
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1] ?? 0;
      const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrameHeader) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/** The manual links its pictures by file path; the site serves the same files at /manual/<name>. */
export function manualImageUrl(src: string): string | null {
  const match = /(?:^|\/)manual\/([^/]+\.(?:png|jpe?g))$/i.exec(src);
  return match ? `/manual/${match[1]}` : null;
}

export function loadManual(): Manual | null {
  const cwd = process.cwd();
  const file = firstExisting([path.join(cwd, "..", "..", "docs", "FEATURES.md"), path.join(cwd, "docs", "FEATURES.md")]);
  const publicDir = firstExisting([path.join(cwd, "public"), path.join(cwd, "apps", "web", "public")]);
  if (!file || !publicDir) return null;

  // The page is made once, at build time, so these files are not needed by the running
  // server. The "turbopackIgnore" comments tell the build not to copy the whole project
  // into the server output because of these two reads.
  const blocks: ManualBlock[] = parseMarkdown(fs.readFileSync(/* turbopackIgnore: true */ file, "utf8")).map((block) => {
    if (block.type !== "pictures") return block;
    return {
      type: "pictures" as const,
      items: block.items.flatMap((item) => {
        const url = manualImageUrl(item.src);
        if (!url) return [];
        const size = imageSize(path.join(/* turbopackIgnore: true */ publicDir, url));
        return [{ ...item, src: url, fileWidth: size.width, fileHeight: size.height }];
      }),
    };
  });

  const manual: Manual = { title: "User manual", intro: [], sections: [] };
  let seenSection = false;
  for (const block of blocks) {
    if (block.type === "heading" && block.level === 1) {
      manual.title = block.text;
      continue;
    }
    if (block.type === "heading" && block.level === 2) {
      manual.sections.push({ id: block.id, title: block.text, blocks: [] });
      seenSection = true;
      continue;
    }
    // The file's own table of contents (a list of #anchor links) is replaced by the page's.
    if (!seenSection && block.type === "list") continue;
    if (block.type === "rule") continue;
    (seenSection ? manual.sections[manual.sections.length - 1]!.blocks : manual.intro).push(block);
  }
  return manual;
}
