/**
 * A small Markdown reader for the user manual (docs/FEATURES.md).
 *
 * It understands exactly what that file uses: headings (#, ##, ###), paragraphs,
 * **bold**, `code`, [links](url), images on their own line, <img> tags, pipe tables,
 * "-" and "1." lists, "> " quotes, fenced code blocks and "---" rules. Anything else is
 * shown as plain paragraph text. It is not a general Markdown engine and is used for
 * this one trusted file only.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export interface Picture {
  src: string;
  alt: string;
  /** Display width in CSS pixels, when the file asks for one (phone screenshots). */
  width?: number;
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string; id: string }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "pictures"; items: Picture[] }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; inlines: Inline[] }
  | { type: "code"; text: string }
  | { type: "rule" };

/** A marker line in the file: everything after it stays out of the public page. */
const PUBLIC_END = /^<!--\s*manual:public-end\b/;

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: text.slice(last, index) });
    if (match[1] !== undefined) out.push({ type: "strong", children: parseInline(match[1]) });
    else if (match[2] !== undefined) out.push({ type: "code", text: match[2] });
    else if (match[3] !== undefined && match[4] !== undefined) out.push({ type: "link", href: match[4], children: parseInline(match[3]) });
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Heading text to an anchor id, the way GitHub does it. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/ /g, "-");
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

const isBlockStart = (line: string) =>
  /^(#{1,3} |```|---+$|!\[|<img |<!--|\||> |- |\d+\. )/.test(line);

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (PUBLIC_END.test(line)) break;
    if (line.startsWith("<!--")) {
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) body.push(lines[i++] ?? "");
      i++;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      const text = (heading[2] ?? "").trim();
      blocks.push({ type: "heading", level: (heading[1] ?? "#").length as 1 | 2 | 3, text, id: slugify(text) });
      i++;
      continue;
    }

    if (/^---+$/.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    const image = /^!\[(.*?)\]\((.+?)\)$/.exec(line.trim());
    if (image) {
      blocks.push({ type: "pictures", items: [{ alt: image[1] ?? "", src: image[2] ?? "" }] });
      i++;
      continue;
    }

    if (line.trim().startsWith("<img ")) {
      const items: Picture[] = [];
      for (const tag of line.matchAll(/<img\s+([^>]*)>/g)) {
        const attrs = tag[1] ?? "";
        const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1];
        const src = attr("src");
        if (!src) continue;
        const width = Number(attr("width"));
        items.push({ src, alt: attr("alt") ?? "", ...(width > 0 ? { width } : {}) });
      }
      if (items.length > 0) blocks.push({ type: "pictures", items });
      i++;
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("|")) rows.push(cells(lines[i++] ?? ""));
      const [head = [], divider, ...body] = rows;
      const hasDivider = divider?.every((cell) => /^:?-+:?$/.test(cell)) ?? false;
      blocks.push({
        type: "table",
        head: head.map(parseInline),
        rows: (hasDivider ? body : [divider ?? [], ...body]).map((row) => row.map(parseInline)),
      });
      continue;
    }

    if (line.startsWith("> ")) {
      const parts: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith(">")) parts.push((lines[i++] ?? "").replace(/^>\s?/, ""));
      blocks.push({ type: "quote", inlines: parseInline(parts.join(" ")) });
      continue;
    }

    const ordered = /^\d+\. /.test(line);
    if (ordered || line.startsWith("- ")) {
      const items: Inline[][] = [];
      const marker = ordered ? /^\d+\. / : /^- /;
      while (i < lines.length && marker.test(lines[i] ?? "")) items.push(parseInline((lines[i++] ?? "").replace(marker, "")));
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const parts: string[] = [line.trim()];
    i++;
    while (i < lines.length && (lines[i] ?? "").trim() !== "" && !isBlockStart(lines[i] ?? "")) parts.push((lines[i++] ?? "").trim());
    blocks.push({ type: "paragraph", inlines: parseInline(parts.join(" ")) });
  }

  return blocks;
}
