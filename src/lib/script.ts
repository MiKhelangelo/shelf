import type { Item } from "./instagram.ts";
import type { Settings } from "./settings.ts";

export type GenerateResult =
  | { ok: true; script: string; urlCount: number }
  | { ok: false; error: string };

export const APP_ARCHIVE_URL = "https://github.com/MiKhelangelo/shelf/archive/refs/heads/main.zip";

export const APP_SCRIPT = `#!/usr/bin/env bash
# Shelf. This file downloads the Shelf app. It does not download videos.
# How to run this file:
# 1. Open Terminal.
# 2. Type: cd ~/Downloads
# 3. Type: chmod +x shelf-instagram.sh
# 4. Type: ./shelf-instagram.sh
# 5. The app is saved in Downloads/shelf.
set -u
set -o pipefail
umask 077

downloads="$HOME/Downloads"
dest="$downloads/shelf"
archive="$downloads/shelf-app.zip"
unpack="$downloads/.shelf-unpack"
url="https://github.com/MiKhelangelo/shelf/archive/refs/heads/main.zip"

printf 'Downloading the Shelf app. No videos will be downloaded.\\n'

if ! command -v curl >/dev/null 2>&1; then
  printf 'curl was not found.\\n' >&2
  exit 127
fi
if ! command -v unzip >/dev/null 2>&1; then
  printf 'unzip was not found.\\n' >&2
  exit 127
fi

mkdir -p -- "$downloads"
if ! curl -fsSL --retry 3 --retry-delay 2 -o "$archive" "$url"; then
  printf 'Could not download the app.\\n' >&2
  exit 1
fi

rm -rf -- "$unpack"
mkdir -p -- "$unpack"
if ! unzip -q "$archive" -d "$unpack"; then
  printf 'Could not unpack the app.\\n' >&2
  rm -f -- "$archive"
  exit 1
fi

src="$unpack/shelf-main"
if [ ! -d "$src" ]; then
  printf 'The download did not contain the app.\\n' >&2
  rm -rf -- "$unpack"
  rm -f -- "$archive"
  exit 1
fi

rm -rf -- "$dest"
if ! mv -- "$src" "$dest"; then
  printf 'Could not save the app to %s\\n' "$dest" >&2
  exit 1
fi
rm -rf -- "$unpack"
rm -f -- "$archive"

printf 'Finished. The app is in %s\\n' "$dest"
printf 'No videos were downloaded.\\n'
printf 'To open it later: cd %s\\n' "$dest"
`;

export function generateScript(items: readonly Item[], settings: Settings): GenerateResult {
  void items;
  void settings;
  if (APP_SCRIPT.includes("yt-dlp") || APP_SCRIPT.includes("instagram.com")) {
    return { ok: false, error: "The app download file is not safe." };
  }
  return { ok: true, script: APP_SCRIPT, urlCount: 0 };
}
