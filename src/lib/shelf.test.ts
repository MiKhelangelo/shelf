import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { capIncoming, extractInstagramUrls, mergeLinks, parseInstagramUrl, reelsForKeyword } from "./instagram.ts";
import { APP_ARCHIVE_URL, APP_SCRIPT, generateScript } from "./script.ts";
import { defaultSettings, type Settings } from "./settings.ts";
import { parsePersisted } from "./storage.ts";

test("parses posts, reels, share links, and query strings", () => {
  assert.equal(
    parseInstagramUrl("https://www.instagram.com/p/Dd3tsoHmHuH/?img_index=1")?.url,
    "https://www.instagram.com/p/Dd3tsoHmHuH/",
  );
  assert.equal(
    parseInstagramUrl("https://www.instagram.com/share/reel/DaiB5OdoqWX")?.kind,
    "reel",
  );
  assert.equal(parseInstagramUrl("https://instagram.com/someuser/reel/DaiB5OdoqWX/")?.shortcode, "DaiB5OdoqWX");
  assert.equal(parseInstagramUrl("https://www.instagram.com/stories/someone/123/"), null);
  assert.equal(parseInstagramUrl("https://www.instagram.com/someone/"), null);
  assert.equal(parseInstagramUrl("https://evil.example/instagram.com/p/Dd3tsoHmHuH/"), null);
  assert.equal(parseInstagramUrl("https://user:pass@www.instagram.com/p/Dd3tsoHmHuH/"), null);
  assert.equal(parseInstagramUrl("javascript:alert(1)"), null);
  assert.equal(
    parseInstagramUrl("https://www.instagram.com/reel/DaiB5OdoqWX/\u200b\u202e")?.url,
    "https://www.instagram.com/reel/DaiB5OdoqWX/",
  );
  assert.equal(
    parseInstagramUrl("ｈｔｔｐｓ：／／ｗｗｗ．ｉｎｓｔａｇｒａｍ．ｃｏｍ／ｐ／Dd3tsoHmHuH／")?.shortcode,
    "Dd3tsoHmHuH",
  );
  assert.equal(parseInstagramUrl("https://www.\u0456nstagram.com/p/Dd3tsoHmHuH/"), null);
});

test("pulls links out of a pasted shell command", () => {
  const command = [
    '"$HOME/Downloads/yt-dlp_macos" \\',
    "  --cookies-from-browser safari \\",
    '  "https://www.instagram.com/p/Dd3tsoHmHuH/" \\',
    '  "https://www.instagram.com/p/Ddqg_NAmSJ1/"',
    "not a link",
  ].join("\n");
  const extracted = extractInstagramUrls(command);
  assert.equal(extracted.links.length, 2);
  assert.equal(extracted.links[0]?.shortcode, "Dd3tsoHmHuH");
  assert.equal(extracted.rejected, 0);
});

test("the saved file downloads the app and never downloads videos", () => {
  const result = generateScript([], defaultSettings);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.urlCount, 0);
  assert.equal(result.script, APP_SCRIPT);
  assert.match(result.script, /Downloading the Shelf app/);
  assert.match(result.script, /No videos were downloaded/);
  assert.match(result.script, new RegExp(APP_ARCHIVE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result.script, /Downloads\/shelf/);
  assert.doesNotMatch(result.script, /yt-dlp/);
  assert.doesNotMatch(result.script, /instagram\.com/);
  assert.doesNotMatch(result.script, /cookies-from-browser/);
  assert.doesNotMatch(result.script, /DcJDWQhuc0P/);
  assert.equal(bashOk(result.script), true);
});

test("selected links and downloader settings never reach the file", () => {
  const settings: Settings = {
    ...defaultSettings,
    mode: "batch",
    cookies: "none",
    format: "mp4",
    filename: "title-id",
    binary: "$HOME/Downloads/yt-dlp;reboot",
    outputDir: "$HOME/Instagram-Reels;rm",
  };
  const result = generateScript([], settings);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.script.includes("DcJDWQhuc0P"), false);
  assert.doesNotMatch(result.script, /yt-dlp/);
  assert.doesNotMatch(result.script, /Instagram-Reels/);
  assert.doesNotMatch(result.script, /reboot/);
  assert.equal(bashOk(result.script), true);
});

test("a keyword search still parses, but the file does not download those reels", () => {
  const found = reelsForKeyword("Travel, travel! pasta");
  assert.deepEqual(
    found.map((item) => item.shortcode),
    ["tag:travel", "tag:pasta"],
  );
  assert.deepEqual(
    reelsForKeyword("a ../etc").map((item) => item.shortcode),
    ["tag:etc"],
  );
  assert.equal(reelsForKeyword("..").length, 0);
  assert.equal(parseInstagramUrl(found[0]!.url)?.url, found[0]!.url);

  const result = generateScript(
    found.map((item) => ({ ...item, selected: true })),
    { ...defaultSettings, concurrency: 1, pauseSeconds: 0 },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.doesNotMatch(result.script, /explore\/tags\/travel/);
  assert.doesNotMatch(result.script, /DcJDWQhuc0P/);
  assert.doesNotMatch(result.script, /yt-dlp/);
  assert.equal(bashOk(result.script), true);
});

test("storage drops tampered links and illegal enums", () => {
  const parsed = parsePersisted({
    items: [
      { url: "https://www.instagram.com/reel/DaiB5OdoqWX/?utm=1", selected: false },
      { url: "https://example.com/p/Dd3tsoHmHuH/", selected: true },
      { url: "https://www.instagram.com/reel/DaiB5OdoqWX/", selected: true },
    ],
    settings: { cookies: "safari;rm", pauseSeconds: 99, mode: "batch", binary: 12 },
  });
  assert.ok(parsed);
  assert.equal(parsed?.items.length, 1);
  assert.equal(parsed?.items[0]?.selected, false);
  assert.equal(parsed?.items[0]?.url, "https://www.instagram.com/reel/DaiB5OdoqWX/");
  assert.equal(parsed?.settings.cookies, "safari");
  assert.equal(parsed?.settings.pauseSeconds, 1);
  assert.equal(parsed?.settings.mode, "batch");
  assert.equal(parsed?.settings.binary, defaultSettings.binary);
});

test("merge reports duplicates already queued", () => {
  const existing = extractInstagramUrls("https://www.instagram.com/p/Dd3tsoHmHuH/").links.map((link) => ({
    ...link,
    selected: true,
  }));
  const incoming = extractInstagramUrls(
    "https://www.instagram.com/p/Dd3tsoHmHuH/\nhttps://www.instagram.com/p/Ddqg_NAmSJ1/",
  ).links;
  const merged = mergeLinks(existing, incoming);
  assert.equal(merged.added, 1);
  assert.equal(merged.duplicates, 1);
  assert.equal(merged.items.length, 2);
});

test("a paste keeps the first 200 links and reports the rest", () => {
  const lines = Array.from({ length: 210 }, (_, index) => {
    const code = `Abcde${String(index).padStart(4, "0")}`.slice(0, 11);
    return `https://www.instagram.com/reel/${code}/`;
  });
  const extracted = extractInstagramUrls(lines.join("\n"));
  assert.equal(extracted.links.length, 210);
  const capped = capIncoming(extracted.links);
  assert.equal(capped.links.length, 200);
  assert.equal(capped.overflow, 10);
});

function bashOk(script: string): boolean {
  const checked = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
  if (checked.status !== 0) {
    console.error(checked.stderr);
    return false;
  }
  return true;
}
