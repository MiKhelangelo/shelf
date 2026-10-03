# Shelf guide

[Open Shelf](https://mikhelangelo.github.io/shelf/) · [Project overview](../README.md)

Shelf is a static web app for keeping Instagram links and searching your own video library. The page is the product; an exported Bash script is optional when you want video files on your Mac. There is no Shelf backend, account, cloud storage, native installer, or automatic Instagram download in the browser.

## The workflow

1. Paste Instagram post or Reel links. Duplicate shortcodes are skipped. Add your own title, notes, and hashtags immediately.
2. Select the links you want and choose **Get save script**, next to **Add to library**. Review the generated source in **How Shelf works** before running it.
3. Install [yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/Installation). If you already use Homebrew: `brew install yt-dlp`.
4. Assuming your script is in Downloads, run:

   ```bash
   brew install yt-dlp
   cd ~/Downloads
   bash shelf-instagram.sh
   ```

5. Files and `.info.json` sidecars go into `~/Movies/Shelf/<shortcode>/`. Return to the page, choose **Open saved folder**, and select `Shelf`.
6. Search creators, captions, titles, notes, and hashtags. Play connected local videos. Reopen the folder after reloading; browsers do not retain access to those files.

You can use the link library without the script. Script batches support 1–500 selected items. The library holds 2,000 items; additions above capacity are rejected without deleting existing records.

## Honest statuses and limits

- **Not saved:** a link is in the library; no local media has been found in a folder you opened.
- **Found in folder:** you selected a nonempty local video in a recognized shortcode folder. This is evidence of a file, not proof that the entire post downloaded or that the file can be decoded.
- **Failed:** a `shelf-failed.txt` entry exists. Partial files can still be playable, but the post remains eligible for retry.
- A separate **connected** message means the file is accessible in the current tab. Captions can remain after a reload; file access does not. Reopen the folder to play the videos.
- Instagram may require login or block public requests. Private, removed, login-required, and some photo-only posts cannot be saved by this workflow. Shelf does not bypass those restrictions.
- Script creation does not change save status. The page cannot run the script, watch folders, or infer Terminal results.
- Playback depends on browser codecs. Supported file extensions are MP4, MOV, M4V, WebM, and MKV; unsupported codecs should be opened in a local player.
- Multiple videos per shortcode are available through the player selector. Videos without metadata create basic Reel records inferred from the folder; no creator/caption or authoritative post type can be inferred from media alone.
- Each metadata file is limited to 20 MB, with at most 5,000 metadata files read per folder selection. Captions are searchable up to 20,000 characters. Skips and capacity problems are reported.

## Privacy and recovery

Library data stays in `localStorage` on the current browser and origin. Selected files are read locally through browser APIs; no library or file data is uploaded. No analytics, third-party fonts, thumbnails, or Instagram embeds load. The host receives ordinary page requests. Opening an original link navigates to Instagram. The optional Terminal script makes network requests to Instagram and its media services through yt-dlp.

**Export library** creates a JSON backup of links and metadata, including notes. It does not include videos. **Import backup** merges validated new entries and preserves existing ones. Browser storage can be blocked, cleared, or exhausted; a persistent warning appears when saving fails. Corrupt or partly invalid stored data can be downloaded as a recovery copy before changes replace it.

The earlier GitHub Pages `shelf.v4` library is migrated on the same origin when no v5 library exists. Links and metadata are preserved, with notes, collections, and tags carried into searchable notes. Old manually assigned save statuses are reset until files are indexed. Unsupported search URLs are skipped visibly, and the original v4 key is retained for recovery. The ZIP's v5 array format remains supported. Browser libraries do not transfer automatically between browsers or hosting origins; use a backup.

## Script behavior

The audited template lives in [shelf-script.js](../shelf-script.js); URLs are validated again in Bash. It discovers yt-dlp on `PATH` or standard Mac locations, ignores user configuration and plugins, and imports no cookies or browser login. It processes one link at a time, verifies nonempty video and metadata output, skips completed pairs unless a prior failure requires a retry, and preserves unrelated failure history. New files use a private umask. There is no installer, quarantine override, shell evaluation of pasted text, or deletion of saved videos.

The script chooses a directly available format rather than requiring an audio/video merge. Quality and codec vary with availability; video-only fallback may have no audio. A nonzero exit reports failed downloads, invalid links, missing yt-dlp, or file-operation errors. A lock prevents simultaneous Shelf scripts from writing the same folder. After an abnormal termination, verify no script is running before removing an abandoned `.shelf-download-lock` directory.

Optional overrides use environment variables:

```bash
SHELF_OUT="$HOME/Movies/My Shelf" SHELF_PAUSE=3 bash shelf-instagram.sh
```

## Run and verify

No frontend build or package installation is needed. From the repository root, serve the project locally:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [localhost:4173](http://127.0.0.1:4173). A local server gives a stable storage origin; opening `index.html` directly may have browser-specific storage behavior.

Tests require Node.js 18+:

```bash
node --test tests/lib.test.js
```

[Tests](../tests/lib.test.js) cover URL/shell injection validation, metadata sanitization, legacy migration, browser module exports, and actual Bash execution against a fake yt-dlp for success, partial failure, empty output, retries, lock handling, and preserved failure history. These checks do not establish live Instagram download reliability.

## GitHub Pages deployment

The included [Pages workflow](../.github/workflows/pages.yml) checks the project, copies only the static app assets to `_site`, and publishes that artifact on a push to `main`. Select **GitHub Actions** as the repository's Pages source if necessary. Relative asset paths support the `/shelf/` subpath. No application server or Worker is deployed.

The public assets are `index.html`, `styles.css`, `app.js`, `lib.js`, `shelf-script.js`, and `assets/favicon.svg`. Tests, documentation, and review notes stay in the source repository.

See [the professional review](../REVIEW.md) for the assessment of the original attachment. Not affiliated with Instagram or Meta. Save only content you have permission to keep; keeping it does not grant permission to repost it. Questions: [GitHub issues](https://github.com/MiKhelangelo/shelf/issues).
