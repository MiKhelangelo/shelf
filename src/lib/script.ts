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

const CANONICAL =
  /^https:\/\/www\.instagram\.com\/(?:(?:p|reel|tv)\/[A-Za-z0-9_-]{5,20}|explore\/tags\/[a-z0-9_]{2,50})\/$/;
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
  if (binaryError) return { ok: false, error: `Downloader: ${binaryError}` };
  const folderError = pathError(safe.outputDir);
  if (folderError) return { ok: false, error: `Folder: ${folderError}` };

  const selected = items.filter((item) => item.selected);
  if (selected.length === 0) return { ok: false, error: "Choose at least one link." };
  if (selected.length > MAX_LINKS) {
    return { ok: false, error: `Keep it to ${MAX_LINKS} links or fewer.` };
  }

  const urls: string[] = [];
  for (const item of selected) {
    const parsed = parseInstagramUrl(item.url);
    if (!parsed || parsed.url !== item.url || !CANONICAL.test(item.url)) {
      return { ok: false, error: "One of these links is not a post, Reel, or word search." };
    }
    urls.push(parsed.url);
  }

  let script: string;
  try {
    script = render(urls, safe, selected);
  } catch {
    return { ok: false, error: "These settings could not make a safe file." };
  }

  const withoutArithmetic = script.replace(/\$\(\([a-z]+ \+ 1\)\)/g, "");
  if (withoutArithmetic.includes("`") || withoutArithmetic.includes("$(")) {
    return { ok: false, error: "These settings could not make a safe file." };
  }

  return { ok: true, script, urlCount: urls.length };
}

function render(urls: readonly string[], settings: Settings, items: readonly Item[]): string {
  const bin = bashPath(settings.binary);
  const out = bashPath(settings.outputDir);
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# Shelf. Paste a link. Keep the video.",
    "# How to run this file:",
    "# 1. Put yt-dlp_macos in your Downloads folder.",
    "# 2. Open Terminal.",
    "# 3. Type: cd ~/Downloads",
    "# 4. Type: chmod +x shelf-instagram.sh",
    "# 5. Type: ./shelf-instagram.sh",
    "# 6. The videos are saved in Downloads/Instagram-Reels.",
    `# ${urls.length} ${urls.length === 1 ? "link" : "links"}. Nothing here is sent away.`,
  ];

  lines.push("# Does not read browser cookies. Private posts will not download.");

  if (settings.mode === "batch") {
    lines.push("# The whole list goes in one run.");
  } else if (settings.concurrency > 1) {
    lines.push(`# ${settings.concurrency} videos at a time. If one fails, the rest continue.`);
  } else {
    lines.push("# One video at a time. If one fails, the rest continue.");
  }

  if (settings.onDuplicate === "skip") {
    lines.push("# Videos you already saved are skipped.");
  } else {
    lines.push("# Videos you already saved are downloaded again.");
  }

  if (settings.fullCarousel) {
    lines.push("# A post with many photos saves every photo.");
  }
  if (urls.some((url) => url.includes("/explore/tags/"))) {
    lines.push("# A word search saves up to 15 recent reels for that word.");
  }

  lines.push("# What this file does:");
  lines.push("# 1. Finds yt-dlp in Downloads.");
  lines.push("# 2. Makes the Instagram-Reels folder, private to your user.");
  lines.push("# 3. Rejects any link that is not an Instagram post or Reel.");
  lines.push("# 4. Saves the videos you chose.");
  lines.push("# 5. Writes shelf-index.json next to the videos.");
  lines.push("# 6. If one video fails, the rest continue.");
  lines.push("# New files stay private. The downloader will not update itself.");
  lines.push("set -u");
  lines.push("set -o pipefail");
  lines.push("umask 077");
  lines.push("");
  lines.push(`bin=${bin}`);
  lines.push(`out=${out}`);
  if (settings.onDuplicate === "skip") lines.push('archive="$out/.shelf-archive.txt"');
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
  lines.push("cat > \"$out/shelf-index.json\" << 'ENDSHELF'");
  lines.push(indexJson(items));
  lines.push("ENDSHELF");
  lines.push("");
  lines.push("urls=(");
  for (const url of urls) lines.push(`  ${shSingle(url)}`);
  lines.push(")");
  lines.push("");
  lines.push('for url in "${urls[@]}"; do');
  lines.push(
    "  if [[ ! \"$url\" =~ ^https://www\\.instagram\\.com/((p|reel|tv)/[A-Za-z0-9_-]{5,20}|explore/tags/[a-z0-9_]{2,50})/$ ]]; then",
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
  if (urls.some((url) => url.includes("/explore/tags/"))) {
    lines.push("args+=(--playlist-end 15 --yes-playlist)");
    lines.push("");
  }

  if (settings.mode === "batch") {
    lines.push("printf 'Downloading %s links into %s\\n' \"${#urls[@]}\" \"$out\"");
    lines.push('"$bin" "${args[@]}" -- "${urls[@]}"');
    lines.push("status=$?");
    lines.push('if [ "$status" -ne 0 ]; then');
    lines.push("  printf 'yt-dlp exited %s\\n' \"$status\" >&2");
    lines.push('  exit "$status"');
    lines.push("fi");
    lines.push("printf 'Finished.\\n'");
  } else if (settings.concurrency > 1) {
    lines.push(...parallelLoop(settings.concurrency));
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
    lines.push("    printf 'Could not save this one. It may be private, deleted, or Instagram changed.\\n' >&2");
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

function indexJson(items: readonly Item[]): string {
  const plain = (value: string, max: number) =>
    value.replace(/[`$\\\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  const records = items.map((item) => ({
    url: item.url,
    shortcode: item.shortcode,
    kind: item.kind,
    title: plain(item.title ?? "", 140),
    description: plain(item.description ?? "", 280),
    author: plain(item.author ?? "", 80),
    collection: plain(item.collection ?? "", 40),
    tags: (item.tags ?? []).filter((tag) => /^[a-z0-9-]{2,30}$/.test(tag)).slice(0, 8),
    savedAt: plain(item.savedAt ?? "", 40),
  }));
  return JSON.stringify(records, null, 2).replaceAll("ENDSHELF", "END");
}

function parallelLoop(limit: number): string[] {
  if (!/^[1-4]$/.test(String(limit))) throw new Error("Unexpected concurrency.");
  return [
    "ok=0",
    "fail=0",
    'failed_list="$out/shelf-failed.txt"',
    ': > "$failed_list"',
    'status_dir="$out/.shelf-status"',
    'rm -rf -- "$status_dir"',
    'mkdir -p -- "$status_dir"',
    "running=0",
    `limit=${limit}`,
    "index=0",
    "",
    'for url in "${urls[@]}"; do',
    "  index=$((index + 1))",
    "  (",
    '    "$bin" "${args[@]}" -- "$url"',
    "    status=$?",
    '    if [ "$status" -eq 0 ]; then',
    '      printf \'ok\\n\' > "$status_dir/$index"',
    "    else",
    '      printf \'fail\\n%s\\n\' "$url" > "$status_dir/$index"',
    '      printf \'failed (exit %s): %s\\n\' "$status" "$url" >&2',
    "      printf 'Could not save this one. It may be private, deleted, or Instagram changed.\\n' >&2",
    "    fi",
    "  ) &",
    "  running=$((running + 1))",
    '  if [ "$running" -ge "$limit" ]; then',
    "    wait",
    "    running=0",
    "  fi",
    "done",
    "wait",
    "",
    'for stamp in "$status_dir"/*; do',
    '  if [ ! -f "$stamp" ]; then',
    "    continue",
    "  fi",
    "  {",
    "    read -r mark",
    '    if [ "$mark" = "fail" ]; then',
    "      read -r bad",
    '      printf \'%s\\n\' "$bad" >> "$failed_list"',
    "      fail=$((fail + 1))",
    "    else",
    "      ok=$((ok + 1))",
    "    fi",
    '  } < "$stamp"',
    "done",
    'rm -rf -- "$status_dir"',
    "",
    "printf '\\nFinished. %s saved, %s failed, %s total.\\n' \"$ok\" \"$fail\" \"${#urls[@]}\"",
    'if [ "$fail" -gt 0 ]; then',
    "  printf 'Failed links were written to %s\\n' \"$failed_list\" >&2",
    "  exit 1",
    "fi",
    'rm -f -- "$failed_list"',
  ];
}

function argLines(settings: Settings): string[] {
  const lines: string[] = [];
  const add = (line: string) => lines.push(line);

  add(flag("--no-update"));
  add(flag("--no-mtime"));
  if (settings.ignoreConfig) add(flag("--ignore-config"));
  add(flag("--no-cookies"));
  add(flag(settings.onDuplicate === "redownload" ? "--force-overwrites" : "--no-overwrites"));
  add(`${flag("-f")} ${shSingle(FORMAT_ARG[settings.format])}`);
  add(flag(settings.fullCarousel ? "--yes-playlist" : "--no-playlist"));
  if (!/^(5|10|20)$/.test(String(settings.retries))) throw new Error("Unexpected retries.");
  add(`${flag("--retries")} ${settings.retries}`);
  add(`${flag("--fragment-retries")} ${settings.retries}`);
  add(`${flag("--socket-timeout")} 30`);
  if (settings.restrictFilenames) add(flag("--restrict-filenames"));
  if (settings.embedMetadata) add(flag("--embed-metadata"));
  if (settings.format === "merge") add(`${flag("--merge-output-format")} mp4`);
  if (settings.onDuplicate === "skip") add(`${flag("--download-archive")} "$archive"`);
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
