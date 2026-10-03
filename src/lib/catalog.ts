import raw from "../data/reels.json" with { type: "json" };
import { parseInstagramUrl } from "./instagram.ts";

export type ReelRecord = {
  url: string;
  shortcode: string;
  title: string;
  description: string;
  tags: string[];
  source: "reddit" | "submission";
};

const SKIP = new Set(["reel", "reels", "the", "and", "for", "with", "this", "that", "from", "your", "you"]);

export function wordsOf(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((word) => word.length >= 2 && !SKIP.has(word));
}

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeReel(input: unknown, fallback: ReelRecord["source"]): ReelRecord | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.url !== "string") return null;
  const parsed = parseInstagramUrl(record.url);
  if (!parsed || parsed.kind !== "reel") return null;
  const title = clip(typeof record.title === "string" ? record.title : parsed.shortcode, 140);
  const description = clip(typeof record.description === "string" ? record.description : title, 280);
  const tags = Array.isArray(record.tags)
    ? [...new Set(record.tags.filter((tag): tag is string => typeof tag === "string"))]
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter((tag) => /^[a-z0-9-]{2,30}$/.test(tag))
        .slice(0, 8)
    : [];
  return {
    url: parsed.url,
    shortcode: parsed.shortcode,
    title: title || parsed.shortcode,
    description: description || title || parsed.shortcode,
    tags,
    source: record.source === "submission" || fallback === "submission" ? "submission" : "reddit",
  };
}

export function loadIndex(entries: readonly unknown[]): ReelRecord[] {
  const seen = new Set<string>();
  const reels: ReelRecord[] = [];
  for (const entry of entries) {
    const reel = sanitizeReel(entry, "reddit");
    if (!reel || seen.has(reel.shortcode)) continue;
    seen.add(reel.shortcode);
    reels.push(reel);
  }
  return reels;
}

export const REEL_INDEX = loadIndex(Array.isArray(raw.reels) ? raw.reels : []);

export function searchCatalog(records: readonly ReelRecord[], query: string, limit = 12): ReelRecord[] {
  const words = wordsOf(query);
  if (words.length === 0 || limit < 1) return [];
  const scored: { reel: ReelRecord; score: number }[] = [];
  for (const reel of records) {
    const title = reel.title.toLowerCase();
    const description = reel.description.toLowerCase();
    const tags = reel.tags.join(" ");
    const code = reel.shortcode.toLowerCase();
    let score = 0;
    let matched = 0;
    for (const word of words) {
      if (title.includes(word)) {
        score += 3;
        matched += 1;
      } else if (tags.includes(word) || code.includes(word)) {
        score += 2;
        matched += 1;
      } else if (description.includes(word)) {
        score += 1;
        matched += 1;
      }
    }
    if (matched === words.length) scored.push({ reel, score });
  }
  scored.sort((a, b) => b.score - a.score || a.reel.title.localeCompare(b.reel.title));
  return scored.slice(0, limit).map((row) => row.reel);
}

export function pickRandom(records: readonly ReelRecord[], count: number, random: () => number = Math.random): ReelRecord[] {
  const copy = [...records];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy.slice(0, Math.max(0, count));
}
