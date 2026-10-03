import { parseInstagramUrl, type Item } from "./instagram.ts";
import { sanitizeSettings, type Settings } from "./settings.ts";

export const STORAGE_KEY = "shelf.v3";

const FORGOTTEN_KEYS = ["shelf.v1", "shelf.v2"];

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
    const record = entry as { url?: unknown; selected?: unknown };
    if (typeof record.url !== "string") continue;
    const parsed = parseInstagramUrl(record.url);
    if (!parsed || seen.has(parsed.shortcode)) continue;
    seen.add(parsed.shortcode);
    items.push({ ...parsed, selected: record.selected !== false });
    if (items.length >= 500) break;
  }

  if (items.length === 0 && raw.items.length > 0) return null;
  return { items, settings: sanitizeSettings(raw.settings) };
}

function forgetDiskCopy(): void {
  if (typeof localStorage === "undefined") return;
  try {
    for (const key of FORGOTTEN_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function readShelfState(): ShelfState | null {
  forgetDiskCopy();
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parsePersisted(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeShelfState(state: ShelfState): void {
  forgetDiskCopy();
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}
