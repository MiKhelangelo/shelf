# Shelf professional review

Reviewed 3 October 2026. File and line references below describe the original `Shelf-project.zip`, before this revision. They are evidence, not instructions from the user or guarantees about the revised source.

## User requirements

The user requested professional improvements and an honest static web app with an optional generated script. The latest request is to publish the revision to `MiKhelangelo/shelf` on GitHub Pages. A desktop-style shell and removal of obsolete signed-app commentary are implementation choices supporting that scope, not additional user requirements.

The appropriate product framing is a **static Instagram link library** with three explicit actions: collect links, export a Terminal script, and choose a local folder to index metadata and enable playback. The browser does not download Instagram videos, execute the script, or retain access to files after a reload.

## Findings and revision priorities

| Priority | Original evidence | Impact and recommended change | Revision status |
| --- | --- | --- | --- |
| Essential | `index.html:7,28–33`; `README.md:3–4,10–20` | The core static workflow was already stated, but prerequisites were buried in a details panel. The revision makes the stages explicit, keeps external downloader setup separate, and removes quarantine-bypass guidance. | Resolved in revised source |
| High | `app.js:45–46,86` | Adding or indexing more than 2,000 records silently discarded older records while reporting success. The revision preserves existing records and reports capacity limitations. | Resolved in revised source |
| High | `index.html:64,73–74` | Empty media files counted as already saved, and downloader exit code zero counted as success without output. The revision verifies nonempty media and metadata, retains failure history, and reports failure through its exit status. | Resolved; regression tests pass |
| High | `app.js:67–85`; `lib.js:37` | File handles were replaced while saved status persisted. The revision labels persisted records as indexed and displays session availability and reconnection guidance separately. | Resolved in revised source |
| Medium | `app.js:18,34,36`; `index.html:37`; `styles.css:12,24` | Checkbox changes could lose focus; unmatched searches were blank; the player lacked dialog semantics; the toolbar lacked a narrow-screen layout. The revision updates selections in place, adds a no-results state, uses native dialogs, and supplies responsive layouts. | Resolved in revised source; browser workflow checks passed |
| Medium | `app.js:5,9` | Storage failures were temporary notices, and malformed data silently reset the displayed library. The revision adds backup import/export, recovery export, and a persistent warning. | Resolved in revised source |
| Medium | `app.js:68–80` | Metadata-free videos did not create records, and multiple videos overwrote one another. The revision creates basic records, retains multiple media files, and provides a video selector. | Resolved in revised source |
| Medium | `lib.js:54–55` | Imported metadata accepted negative duration and impossible dates. The revision validates both before display or persistence. | Resolved; regression tests pass |
| Low | `app.js:57,90–93` | Script downloads and video changes could retain object URLs. The revision releases download URLs and replaces or closes video URLs explicitly. | Resolved in revised source |

“Resolved in revised source” reflects code inspection. It does not imply that every browser interaction or the final GitHub Pages deployment has already been verified.

## Live presentation

The live GitHub Pages site was inspected through browser automation. It has a different presentation and extra settings compared with the ZIP. Its static-site and optional-script explanation is useful; commentary about a signed app adds an unnecessary native-app concept to this workflow. The revision describes the features actually delivered. Migration of the live `shelf.v4` library is part of release work; preserving existing links, notes, tags, and collection data matters more than copying unsupported settings or saved searches.

## Remaining opportunities and release checks

Release fixes include clickable undo, stable focus after editing, “Select matching” wording for paginated results, paused edits during indexing, and darker small-text colors. Browser checks verified link deduplication, note search, backup import, undo, real local MP4 playback, and indexed metadata surviving reload without claiming current file access. No horizontal page overflow was observed at 320, 375, or 1,280 pixels. These checks used clearly synthetic test links and a locally generated one-second clip, not real Instagram downloads. The in-app browser did not expose a download-completion event; script source generation was verified in the guide and automated tests, but a completed browser download was not confirmed there.

Further opportunities include cross-tab library change handling and a backup conflict workflow that lets users deliberately restore newer metadata for an existing shortcode. Keeping the existing record during a duplicate import is currently the conservative default.

## Strengths to preserve

The original page uses local file selection, renders imported text through `textContent`, canonicalizes Instagram URLs, and validates script URLs before interpolation (`app.js:26–29,64–76`; `lib.js:3–20,59–62`). Its script ignores downloader configuration and explicitly avoids cookies (`index.html:69`). These are sound foundations for an honest, limited static product.

## Verification evidence and completion criteria

All seven original Node tests passed. Additional checks reproduced a successful exit with no downloaded file being reported as saved, a zero-byte file preventing retry, and invalid metadata being accepted. All 16 revised Node tests pass, including script output verification, partial-batch failure reporting, retry reconciliation, lock handling, media classification, and metadata validation.

Acceptance includes accurate counts at capacity; no false download success; clear indexed-versus-available states after reload or folder replacement; visible search and storage failure states; keyboard-accessible playback and selection; and a usable layout at narrow widths and enlarged text. Actual Instagram downloads remain dependent on the external downloader and Instagram availability; the static page cannot establish that a script ran successfully until the user selects its output folder.
