import { sanitizeReel, type ReelRecord } from "./catalog.ts";

const KEY = "shelf.submissions.v1";
const LIMIT = 100;

export function readSubmissions(): ReelRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const reel = sanitizeReel(entry, "submission");
      return reel ? [reel] : [];
    }).slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function saveSubmission(reel: ReelRecord): ReelRecord[] {
  const next = [reel, ...readSubmissions().filter((item) => item.shortcode !== reel.shortcode)].slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}
