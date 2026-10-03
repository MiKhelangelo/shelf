export type Kind = "post" | "reel" | "tv" | "search";

export type ParsedLink = {
  url: string;
  shortcode: string;
  kind: Kind;
};

export type Item = ParsedLink & {
  selected: boolean;
  title?: string;
  description?: string;
  tags?: string[];
};

function kindFromSegment(segment: string): Kind | null {
  if (segment === "p") return "post";
  if (segment === "reel" || segment === "reels") return "reel";
  if (segment === "tv") return "tv";
  return null;
}

function pathKind(kind: Kind): string {
  if (kind === "post") return "p";
  if (kind === "tv") return "tv";
  return "reel";
}

const SHORTCODE = /^[A-Za-z0-9_-]{5,20}$/;
const CANDIDATE = /(?:https?:\/\/)?(?:[\w.-]+\.)?instagram\.com\/[^\s<>"'`]+/gi;
const FORMAT_CHARS = /\p{Cf}/gu;

/** NFKC plus a strip of hidden format characters (bidi overrides, zero-width, BOM). */
export function scrubText(value: string): string {
  return value.normalize("NFKC").replace(FORMAT_CHARS, "");
}

export function isPlainTextList(value: string): boolean {
  return !value.includes("\0") && value.length <= 500_000;
}

export function parseInstagramUrl(raw: string): ParsedLink | null {
  let text = scrubText(raw).trim().replace(/^<+|>+$/g, "");
  if (!text || /[\s"'`\\]/.test(text)) return null;
  if (/^(?:www\.|m\.)?instagram\.com\//i.test(text)) text = `https://${text}`;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  if (host !== "instagram.com" && host !== "www.instagram.com" && host !== "m.instagram.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  let kind: Kind | null = null;
  let shortcode: string | null = null;

  if (parts.length >= 2) {
    const direct = kindFromSegment(parts[0] ?? "");
    const code = parts[1] ?? "";
    if (direct && SHORTCODE.test(code)) {
      kind = direct;
      shortcode = code;
    }
  }

  if (!kind && parts.length >= 3) {
    const nested = kindFromSegment(parts[1] ?? "");
    const code = parts[2] ?? "";
    if (nested && SHORTCODE.test(code)) {
      kind = nested;
      shortcode = code;
    }
  }

  if (!kind || !shortcode) {
    if (parts[0] === "explore" && parts[1] === "tags") {
      const tag = (parts[2] ?? "").toLowerCase();
      if (/^[a-z0-9_]{2,50}$/.test(tag)) {
        return {
          kind: "search",
          shortcode: `tag:${tag}`,
          url: `https://www.instagram.com/explore/tags/${tag}/`,
        };
      }
    }
    return null;
  }

  return {
    kind,
    shortcode,
    url: `https://www.instagram.com/${pathKind(kind)}/${shortcode}/`,
  };
}

export type ExtractResult = {
  links: ParsedLink[];
  rejected: number;
  duplicates: number;
};

export function extractInstagramUrls(text: string): ExtractResult {
  const clean = scrubText(text);
  const matches = clean.match(CANDIDATE) ?? [];
  const links: ParsedLink[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  let duplicates = 0;

  const consider = (raw: string) => {
    const cleaned = raw.replace(/[),.;!?]+$/g, "");
    const parsed = parseInstagramUrl(cleaned);
    if (!parsed) {
      rejected += 1;
      return;
    }
    if (seen.has(parsed.shortcode)) {
      duplicates += 1;
      return;
    }
    seen.add(parsed.shortcode);
    links.push(parsed);
  };

  if (matches.length === 0) {
    if (clean.trim()) consider(clean.trim());
    return { links, rejected, duplicates };
  }

  for (const match of matches) consider(match);
  return { links, rejected, duplicates };
}

export const PASTE_LIMIT = 200;
export const LIBRARY_LIMIT = 2000;

export function capIncoming(links: readonly ParsedLink[]): { links: ParsedLink[]; overflow: number } {
  if (links.length <= PASTE_LIMIT) return { links: [...links], overflow: 0 };
  return { links: links.slice(0, PASTE_LIMIT), overflow: links.length - PASTE_LIMIT };
}

export function reelsForKeyword(raw: string): ParsedLink[] {
  const words = scrubText(raw)
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((word) => /^[a-z0-9_]{2,50}$/.test(word));
  return [...new Set(words)].slice(0, 5).map((word) => ({
    kind: "search" as const,
    shortcode: `tag:${word}`,
    url: `https://www.instagram.com/explore/tags/${word}/`,
  }));
}

export function itemTitle(item: Pick<Item, "kind" | "shortcode">): string {
  return item.kind === "search" ? item.shortcode.slice(4) : item.shortcode;
}

const SEARCH_SKIP = new Set(["reel", "reels", "post", "posts", "video", "videos", "instagram", "ig"]);

export function matchesQuery(item: Item, query: string): boolean {
  const words = query
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((word) => word.length >= 2 && !SEARCH_SKIP.has(word));
  if (words.length === 0) return true;
  const title = itemTitle(item).toLowerCase();
  const code = item.shortcode.toLowerCase();
  const label = kindLabel(item.kind).toLowerCase();
  const extra = `${item.title ?? ""} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
  return words.every((word) => title.includes(word) || code.includes(word) || label === word || extra.includes(word));
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim().slice(0, max);
  return text || undefined;
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === "string"))]
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => /^[a-z0-9-]{2,30}$/.test(tag))
    .slice(0, 8);
}

export function mergeLinks(
  existing: readonly Item[],
  incoming: readonly (ParsedLink & { title?: string; description?: string; tags?: string[] })[],
): { items: Item[]; added: number; duplicates: number } {
  const seen = new Set(existing.map((item) => item.shortcode));
  const items = [...existing];
  let added = 0;
  let duplicates = 0;

  for (const link of incoming) {
    if (seen.has(link.shortcode)) {
      duplicates += 1;
      continue;
    }
    seen.add(link.shortcode);
    const title = cleanText(link.title, 140);
    const description = cleanText(link.description, 280);
    const tags = cleanTags(link.tags);
    items.push({
      url: link.url,
      shortcode: link.shortcode,
      kind: link.kind,
      selected: true,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(tags.length ? { tags } : {}),
    });
    added += 1;
  }

  return { items, added, duplicates };
}

export function tally(items: readonly Item[]): {
  posts: number;
  reels: number;
  tvs: number;
  searches: number;
  selected: number;
} {
  let posts = 0;
  let reels = 0;
  let tvs = 0;
  let searches = 0;
  let selected = 0;
  for (const item of items) {
    if (item.kind === "post") posts += 1;
    else if (item.kind === "reel") reels += 1;
    else if (item.kind === "tv") tvs += 1;
    else searches += 1;
    if (item.selected) selected += 1;
  }
  return { posts, reels, tvs, searches, selected };
}

export function kindLabel(kind: Kind): string {
  if (kind === "post") return "Post";
  if (kind === "reel") return "Reel";
  if (kind === "search") return "Search";
  return "IGTV";
}
