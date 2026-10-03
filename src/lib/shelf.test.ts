import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extractInstagramUrls, mergeLinks, parseInstagramUrl } from "./instagram.ts";
import { generateScript } from "./script.ts";
import { seedItems, SEED_URLS } from "./seed.ts";
import { defaultSettings, type Settings } from "./settings.ts";
import { parsePersisted } from "./storage.ts";

test("seed is 34 unique posts and reels in the original order", () => {
  const items = seedItems();
  assert.equal(items.length, 34);
  assert.equal(new Set(items.map((item) => item.shortcode)).size, 34);
  assert.equal(items[0]?.shortcode, "Dd3tsoHmHuH");
  assert.equal(items[2]?.kind, "reel");
  assert.equal(items[29]?.shortcode, "DdYvOIPT9L-");
  assert.equal(items.filter((item) => item.kind === "post").length, 14);
  assert.equal(items.filter((item) => item.kind === "reel").length, 20);
});

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
  assert.equal(parseInstagramUrl("https://www.instagram.com/stories/someone/123/") , null);
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

test("pulls links out of the original shell command", () => {
  const command = [
    '"$HOME/Downloads/yt-dlp_macos" \\',
    "  --cookies-from-browser safari \\",
    `  "${SEED_URLS[0]}" \\`,
    `  "${SEED_URLS[1]}"`,
    "not a link",
  ].join("\n");
  const extracted = extractInstagramUrls(command);
  assert.equal(extracted.links.length, 2);
  assert.equal(extracted.links[0]?.shortcode, "Dd3tsoHmHuH");
  assert.equal(extracted.rejected, 0);
});

test("default script is bash-valid and keeps every seed link", () => {
  const items = seedItems();
  const result = generateScript(items, defaultSettings);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.urlCount, 34);
  for (const item of items) {
    const occurrences: number = result.script.split(item.url).length - 1;
    assert.equal(occurrences, 1, item.url);
  }
  assert.match(result.script, /--no-cookies/);
  assert.match(result.script, /--no-mtime/);
  assert.doesNotMatch(result.script, /cookies-from-browser/);
  assert.doesNotMatch(result.script, /uploader/);
  assert.match(result.script, /--force-overwrites/);
  assert.match(result.script, /-f 'best'/);
  assert.match(result.script, /--ignore-config/);
  assert.match(result.script, /--no-update/);
  assert.match(result.script, /umask 077/);
  assert.match(result.script, /Refusing an unexpected link/);
  assert.doesNotMatch(result.script, /--exec/);
  assert.match(result.script, /--yes-playlist/);
  assert.match(result.script, /for url in "\$\{urls\[@\]\}"/);
  assert.doesNotMatch(result.script, /`/);
  assert.equal(bashOk(result.script), true);
});

test("batch mode is one invocation and can omit cookies", () => {
  const settings: Settings = { ...defaultSettings, mode: "batch", cookies: "none", pauseSeconds: 0 };
  const result = generateScript(seedItems(), settings);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.script, /"\$\{urls\[@\]\}"/);
  assert.doesNotMatch(result.script, /"\$bin" "\$\{args\[@\]\}" -- "\$url"/);
  assert.doesNotMatch(result.script, /cookies-from-browser/);
  assert.match(result.script, /--no-cookies/);
  assert.doesNotMatch(result.script, /sleep-interval/);
  assert.equal(bashOk(result.script), true);
});

test("unselected links and unsafe paths never reach the script", () => {
  const items = seedItems().map((item, index) => ({ ...item, selected: index === 0 }));
  const picked = generateScript(items, defaultSettings);
  assert.equal(picked.ok, true);
  if (!picked.ok) return;
  assert.equal(picked.urlCount, 1);
  assert.equal(picked.script.includes(SEED_URLS[1]), false);

  const injected = generateScript(
    [{ ...items[0]!, url: "https://www.instagram.com/reel/AAAAAAAAAAA/; rm -rf /" }],
    defaultSettings,
  );
  assert.equal(injected.ok, false);

  const badPath = generateScript(items, { ...defaultSettings, binary: "$HOME/Downloads/yt-dlp;reboot" });
  assert.equal(badPath.ok, false);

  const home = generateScript(items, defaultSettings);
  assert.equal(home.ok, true);
  if (!home.ok) return;
  assert.match(home.script, /bin="\$HOME\/Downloads\/yt-dlp_macos"/);
  assert.equal(bashOk(home.script), true);
});

test("archive, mp4 format, and title names still parse", () => {
  const settings: Settings = {
    ...defaultSettings,
    format: "mp4",
    filename: "title-id",
    useArchive: true,
    forceOverwrite: false,
    mode: "batch",
    pauseSeconds: 2,
    fullCarousel: false,
  };
  const result = generateScript(seedItems().slice(0, 2), settings);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.script, /--download-archive "\$archive"/);
  assert.match(result.script, /--no-overwrites/);
  assert.match(result.script, /--no-playlist/);
  assert.match(result.script, /--sleep-interval 2/);
  assert.match(result.script, /best\[ext=mp4\]\/best/);
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
  assert.equal(parsed?.settings.cookies, "none");
  assert.equal(parsed?.settings.pauseSeconds, 1);
  assert.equal(parsed?.settings.mode, "batch");
  assert.equal(parsed?.settings.binary, defaultSettings.binary);
});

test("merge reports duplicates already queued", () => {
  const existing = seedItems().slice(0, 1);
  const incoming = extractInstagramUrls(`${SEED_URLS[0]}\n${SEED_URLS[3]}`).links;
  const merged = mergeLinks(existing, incoming);
  assert.equal(merged.added, 1);
  assert.equal(merged.duplicates, 1);
  assert.equal(merged.items.length, 2);
});

test("careful mode keeps going when one link fails", () => {
  const home = mkdtempSync(join(tmpdir(), "shelf-home-"));
  const bin = join(home, "yt-dlp_macos");
  writeFileSync(
    bin,
    `#!/bin/sh
last=""
for last do :; done
printf '%s\\n' "$last" >> "$HOME/urls.txt"
case "$last" in
  *Dd3tsoHmHuH*) exit 9 ;;
esac
exit 0
`,
  );
  chmodSync(bin, 0o755);

  const settings: Settings = {
    ...defaultSettings,
    binary: "$HOME/yt-dlp_macos",
    outputDir: "$HOME/Instagram-Reels",
    pauseSeconds: 0,
  };
  const result = generateScript(seedItems().slice(0, 2), settings);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const scriptPath = join(home, "shelf-instagram.sh");
  writeFileSync(scriptPath, result.script);
  const run = spawnSync("bash", [scriptPath], {
    env: { ...process.env, HOME: home },
    encoding: "utf8",
  });
  assert.equal(run.status, 1, run.stderr);
  const urls = readFileSync(join(home, "urls.txt"), "utf8").trim().split("\n");
  assert.deepEqual(urls, [SEED_URLS[0], SEED_URLS[1]]);
  const failed = readFileSync(join(home, "Instagram-Reels", "shelf-failed.txt"), "utf8");
  assert.match(failed, /Dd3tsoHmHuH/);
  assert.doesNotMatch(failed, /Ddqg_NAmSJ1/);
});

function bashOk(script: string): boolean {
  const checked = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
  if (checked.status !== 0) {
    console.error(checked.stderr);
    return false;
  }
  return true;
}
