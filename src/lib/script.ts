import { parseInstagramUrl, type Item } from "./instagram.ts";
import {
  bashPath,
  FORMAT_ARG,
  NAME_ARG,
  pathError,
  sanitizeSettings,
  type Settings,
} from "./settings.ts";

export type GenerateResult =
  | { ok: true; script: string; urlCount: number }
  | { ok: false; error: string };

const CANONICAL = /^https:\/\/www\.instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]{5,20}\/$/;
const MAX_LINKS = 500;

const QUOTABLE = /^[A-Za-z0-9._:/+=%*()\[\] -]+$/;

function shSingle(value: string): string {
  if (value.length === 0 || value.length > 200 || !QUOTABLE.test(value)) {
    throw new Error("Refusing to quote an unexpected value.");
  }
  return `'${value}'`;
}

function flag(name: string): string {
  if (!/^--[a-z0-9-]+$/.test(name) && !/^-[A-Za-z]$/.test(name)) {
    throw new Error(`Unsafe flag: ${name}`);
  }
  return name;
}

export function generateScript(items: readonly Item[], settings: Settings): GenerateResult {
  const safe = sanitizeSettings(settings);
  const binaryError = pathError(safe.binary);
  if (binaryError) return { ok: false, error: `yt-dlp: ${binaryError}` };
  const folderError = pathError(safe.outputDir);
  if (folderError) return { ok: false, error: `Folder: ${folderError}` };

  const selected = items.filter((item) => item.selected);
  if (selected.length === 0) return { ok: false, error: "Select at least one link." };
  if (selected.length > MAX_LINKS) {
    return { ok: false, error: `Keep a script to ${MAX_LINKS} links or fewer.` };
  }

  const urls: string[] = [];
  for (const item of selected) {
    const parsed = parseInstagramUrl(item.url);
    if (!parsed || parsed.url !== item.url || !CANONICAL.test(item.url)) {
      return { ok: false, error: "A link in the queue is not a valid Instagram post or reel." };
    }
    urls.push(parsed.url);
  }

  let script: string;
  try {
    script = render(urls, safe);
  } catch {
    return { ok: false, error: "Could not build a safe script from these settings." };
  }

  const withoutArithmetic = script.replace(/\$\(\((?:ok|fail) \+ 1\)\)/g, "");
  if (withoutArithmetic.includes("`") || withoutArithmetic.includes("$(")) {
    return { ok: false, error: "Could not build a safe script from these settings." };
  }

  return { ok: true, script, urlCount: urls.length };
}

function render(urls: readonly string[], settings: Settings): string {
  const bin = bashPath(settings.binary);
  const out = bashPath(settings.outputDir);
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# Shelf — download Instagram posts and reels with yt-dlp.",
    "# On your Mac: chmod +x shelf-instagram.sh && ./shelf-instagram.sh",
    `# ${urls.length} ${urls.length === 1 ? "link" : "links"}. Nothing here is uploaded.`,
  ];

  if (settings.cookies === "none") {
    lines.push("# No browser cookies. Login-only posts will fail.");
  } else {
    lines.push(`# Reads the Instagram session already logged in to ${settings.cookies}.`);
  }

  if (settings.mode === "careful") {
    lines.push("# One link at a time. A failure is written down and the rest continue.");
  } else {
    lines.push("# One yt-dlp run for the whole list, same shape as a single command.");
  }

  if (settings.fullCarousel) {
    lines.push("# Carousel posts save every slide, not only the first.");
  }

  if (settings.useArchive && settings.forceOverwrite) {
    lines.push("# The archive is checked first, so finished links are skipped even with overwrite on.");
  }

  lines.push("# Written for the bash that ships with macOS (3.2).");
  lines.push("# New files are private to your user. yt-dlp is not allowed to update itself.");
  lines.push("set -u");
  lines.push("set -o pipefail");
  lines.push("umask 077");
  lines.push("");
  lines.push(`bin=${bin}`);
  lines.push(`out=${out}`);
  if (settings.useArchive) lines.push('archive="$out/.shelf-archive.txt"');
  lines.push("");
  lines.push('if [ ! -e "$bin" ]; then');
  lines.push("  printf 'yt-dlp was not found at: %s\\n' \"$bin\" >&2");
  lines.push("  exit 127");
  lines.push("fi");
  lines.push('if [ ! -x "$bin" ]; then');
  lines.push("  printf 'yt-dlp is not executable: %s\\n' \"$bin\" >&2");
  lines.push("  printf 'Fix it with: chmod +x %s\\n' \"$bin\" >&2");
  lines.push("  exit 126");
  lines.push("fi");
  lines.push('if ! mkdir -p -- "$out"; then');
  lines.push("  printf 'Could not create folder: %s\\n' \"$out\" >&2");
  lines.push("  exit 1");
  lines.push("fi");
  lines.push("");
  lines.push("urls=(");
  for (const url of urls) lines.push(`  ${shSingle(url)}`);
  lines.push(")");
  lines.push("");
  lines.push('for url in "${urls[@]}"; do');
  lines.push(
    "  if [[ ! \"$url\" =~ ^https://www\\.instagram\\.com/(p|reel|tv)/[A-Za-z0-9_-]{5,20}/$ ]]; then",
  );
  lines.push("    printf 'Refusing an unexpected link: %s\\n' \"$url\" >&2");
  lines.push("    exit 2");
  lines.push("  fi");
  lines.push("done");
  lines.push("");
  lines.push("args=(");
  for (const line of argLines(settings)) lines.push(`  ${line}`);
  lines.push(")");
  lines.push("");

  if (settings.mode === "batch") {
    lines.push("printf 'Downloading %s links into %s\\n' \"${#urls[@]}\" \"$out\"");
    lines.push('"$bin" "${args[@]}" -- "${urls[@]}"');
    lines.push("status=$?");
    lines.push('if [ "$status" -ne 0 ]; then');
    lines.push("  printf 'yt-dlp exited %s\\n' \"$status\" >&2");
    lines.push('  exit "$status"');
    lines.push("fi");
    lines.push("printf 'Finished.\\n'");
  } else {
    lines.push("ok=0");
    lines.push("fail=0");
    lines.push('failed_list="$out/shelf-failed.txt"');
    lines.push(': > "$failed_list"');
    lines.push("");
    lines.push('for url in "${urls[@]}"; do');
    lines.push("  printf '\\n→ %s\\n' \"$url\"");
    lines.push('  "$bin" "${args[@]}" -- "$url"');
    lines.push("  status=$?");
    lines.push('  if [ "$status" -eq 0 ]; then');
    lines.push("    ok=$((ok + 1))");
    lines.push("  else");
    lines.push("    fail=$((fail + 1))");
    lines.push("    printf '%s\\n' \"$url\" >> \"$failed_list\"");
    lines.push("    printf 'failed (exit %s): %s\\n' \"$status\" \"$url\" >&2");
    lines.push("  fi");
    if (settings.pauseSeconds > 0) {
      lines.push('  if [ "$url" != "${urls[${#urls[@]}-1]}" ]; then');
      lines.push(`    sleep ${settings.pauseSeconds}`);
      lines.push("  fi");
    }
    lines.push("done");
    lines.push("");
    lines.push("printf '\\nFinished. %s saved, %s failed, %s total.\\n' \"$ok\" \"$fail\" \"${#urls[@]}\"");
    lines.push('if [ "$fail" -gt 0 ]; then');
    lines.push("  printf 'Failed links were written to %s\\n' \"$failed_list\" >&2");
    lines.push("  exit 1");
    lines.push("fi");
    lines.push('rm -f -- "$failed_list"');
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function argLines(settings: Settings): string[] {
  const lines: string[] = [];
  const add = (line: string) => lines.push(line);

  add(flag("--no-update"));
  add(flag("--no-mtime"));
  if (settings.ignoreConfig) add(flag("--ignore-config"));
  if (settings.cookies !== "none") {
    if (!/^(safari|chrome|firefox|brave|edge)$/.test(settings.cookies)) {
      throw new Error("Unexpected browser.");
    }
    add(`${flag("--cookies-from-browser")} ${settings.cookies}`);
  } else {
    add(flag("--no-cookies"));
  }
  add(flag(settings.forceOverwrite ? "--force-overwrites" : "--no-overwrites"));
  add(`${flag("-f")} ${shSingle(FORMAT_ARG[settings.format])}`);
  add(flag(settings.fullCarousel ? "--yes-playlist" : "--no-playlist"));
  if (!/^(5|10|20)$/.test(String(settings.retries))) throw new Error("Unexpected retries.");
  add(`${flag("--retries")} ${settings.retries}`);
  add(`${flag("--fragment-retries")} ${settings.retries}`);
  add(`${flag("--socket-timeout")} 30`);
  if (settings.restrictFilenames) add(flag("--restrict-filenames"));
  if (settings.embedMetadata) add(flag("--embed-metadata"));
  if (settings.format === "merge") add(`${flag("--merge-output-format")} mp4`);
  if (settings.useArchive) add(`${flag("--download-archive")} "$archive"`);
  if (settings.mode === "batch" && settings.pauseSeconds > 0) {
    if (!/^(1|2|3|5)$/.test(String(settings.pauseSeconds))) throw new Error("Unexpected pause.");
    add(`${flag("--sleep-interval")} ${settings.pauseSeconds}`);
  }
  if (settings.mode === "careful" && settings.pauseSeconds > 0) {
    if (!/^(1|2|3|5)$/.test(String(settings.pauseSeconds))) throw new Error("Unexpected pause.");
  }
  add(`${flag("-P")} "$out"`);
  add(`${flag("-o")} ${shSingle(NAME_ARG[settings.filename])}`);
  add(flag("--newline"));
  return lines;
}
