import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { APP_ARCHIVE_URL, APP_SCRIPT, generateScript } from "./script.ts";

test("the file downloads the app and never downloads videos", () => {
  const result = generateScript();
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
  assert.equal(bashOk(result.script), true);
});

function bashOk(script: string): boolean {
  const checked = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
  if (checked.status !== 0) {
    console.error(checked.stderr);
    return false;
  }
  return true;
}
