import { LIBRARY_LIMIT, parseInstagramUrl, type Item } from "./instagram.ts";
import { sanitizeSettings, type Settings } from "./settings.ts";

export const STORAGE_KEY = "shelf.v4";

const RETIRED = ["shelf.v1", "shelf.v2", "shelf.v3"];

export type ShelfState = {
  items: Item[];
  settings: Settings;
};

export function parsePersisted(input: unknown): ShelfState | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { items?: unknown; settings?: unknown };
  if (!Array.isArray(raw.items)) return null;

  const items: Item[] = [];
  const seen = new Set<string>();
  for (const entry of raw.items) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as {
      url?: unknown;
      selected?: unknown;
      title?: unknown;
      description?: unknown;
      tags?: unknown;
    };
    if (typeof record.url !== "string") continue;
    const parsed = parseInstagramUrl(record.url);
    if (!parsed || seen.has(parsed.shortcode)) continue;
    seen.add(parsed.shortcode);
    const title = typeof record.title === "string" ? record.title.replace(/\s+/g, " ").trim().slice(0, 140) : "";
    const description =
      typeof record.description === "string" ? record.description.replace(/\s+/g, " ").trim().slice(0, 280) : "";
    const tags = Array.isArray(record.tags)
      ? [...new Set(record.tags.filter((tag): tag is string => typeof tag === "string"))]
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => /^[a-z0-9-]{2,30}$/.test(tag))
          .slice(0, 8)
      : [];
    items.push({
      ...parsed,
      selected: record.selected !== false,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(tags.length ? { tags } : {}),
    });
    if (items.length >= LIBRARY_LIMIT) break;
  }

  if (items.length === 0 && raw.items.length > 0) return null;
  return { items, settings: sanitizeSettings(raw.settings) };
}

function forgetRetired(): void {
  const stores = [globalThis.localStorage, globalThis.sessionStorage];
  for (const store of stores) {
    if (!store) continue;
    try {
      for (const key of RETIRED) store.removeItem(key);
    } catch {
      /* private mode */
    }
  }
}

export function readShelfState(): ShelfState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      forgetRetired();
      return parsePersisted(JSON.parse(current));
    }
    const legacy =
      sessionStorage.getItem("shelf.v3") ??
      localStorage.getItem("shelf.v3") ??
      sessionStorage.getItem("shelf.v2");
    forgetRetired();
    if (!legacy) return null;
    return parsePersisted(JSON.parse(legacy));
  } catch {
    return null;
  }
}

export function writeShelfState(state: ShelfState): void {
  forgetRetired();
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota */
  }
}