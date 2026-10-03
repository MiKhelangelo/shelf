import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Copy, Download, Plus, Upload, X } from "lucide-react";
import {
  extractInstagramUrls,
  isPlainTextList,
  kindLabel,
  mergeLinks,
  tally,
  type Item,
} from "./lib/instagram";
import { generateScript } from "./lib/script";
import {
  BROWSER_LABEL,
  COOKIE_BROWSERS,
  defaultSettings,
  FORMAT_LABEL,
  FORMATS,
  NAME_LABEL,
  NAME_STYLES,
  PAUSES,
  pathError,
  RETRIES,
  type Settings,
} from "./lib/settings";
import { readShelfState, writeShelfState } from "./lib/storage";

const fieldClass =
  "h-12 w-full rounded-lg border border-line bg-bg px-3 text-base text-ink placeholder:text-muted";
const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-chip disabled:cursor-not-allowed disabled:opacity-40";
const textButton =
  "inline-flex h-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

function describeAdd(added: number, duplicates: number, rejected: number): string {
  const bits: string[] = [];
  if (added > 0) bits.push(`Added ${added} ${added === 1 ? "link" : "links"}`);
  if (duplicates > 0) {
    bits.push(`${duplicates} ${duplicates === 1 ? "duplicate" : "duplicates"} skipped`);
  }
  if (rejected > 0) {
    bits.push(
      rejected === 1 ? "1 ignored — not a post or reel" : `${rejected} ignored — not posts or reels`,
    );
  }
  if (bits.length === 0) return "Add a link first.";
  return `${bits.join(" · ")}.`;
}

export function ShelfApp() {
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [list, setList] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [armClear, setArmClear] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readShelfState();
    if (saved) {
      setItems(saved.items);
      setSettings(saved.settings);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeShelfState({ items, settings });
  }, [hydrated, items, settings]);

  useEffect(() => {
    if (!armClear) return;
    const timer = window.setTimeout(() => setArmClear(false), 2800);
    return () => window.clearTimeout(timer);
  }, [armClear]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const result = useMemo(() => generateScript(items, settings), [items, settings]);
  const counts = tally(items);
  const binaryError = pathError(settings.binary);
  const folderError = pathError(settings.outputDir);

  useEffect(() => {
    if (!result.ok) {
      setDownloadUrl(null);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([result.script], { type: "text/plain;charset=utf-8" }),
    );
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    if (!result.ok) {
      setDigest(null);
      return;
    }
    let cancelled = false;
    const bytes = new TextEncoder().encode(result.script);
    crypto.subtle
      .digest("SHA-256", bytes)
      .then((buffer) => {
        if (cancelled) return;
        const hex = [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
        setDigest(hex);
      })
      .catch(() => {
        if (!cancelled) setDigest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  function patch(partial: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  function ingest(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) {
      setNotice("Add a link first.");
      return false;
    }
    const extracted = extractInstagramUrls(trimmed);
    const merged = mergeLinks(items, extracted.links);
    const room = 500 - items.length;
    const accepted = Math.min(merged.added, Math.max(room, 0));
    setItems(merged.items.slice(0, 500));
    if (accepted === 0 && merged.added > 0) {
      setNotice("The queue stops at 500.");
      return true;
    }
    const summary = describeAdd(
      accepted,
      extracted.duplicates + merged.duplicates,
      extracted.rejected,
    );
    setNotice(merged.added > accepted ? `${summary} The queue stops at 500.` : summary);
    return true;
  }

  async function copyScript() {
    if (!result.ok) return;
    const text = result.script;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
  }

  function toggle(shortcode: string) {
    setItems((current) =>
      current.map((item) =>
        item.shortcode === shortcode ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function remove(shortcode: string) {
    setItems((current) => current.filter((item) => item.shortcode !== shortcode));
  }

  function selectAll(selected: boolean) {
    setItems((current) => current.map((item) => ({ ...item, selected })));
  }

  function clearQueue() {
    if (items.length === 0) return;
    if (!armClear) {
      setArmClear(true);
      return;
    }
    setItems([]);
    setArmClear(false);
    setNotice("Queue cleared.");
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 500_000) {
      setNotice("That file is too large. Use a text list under 500 KB.");
      return;
    }
    const text = await file.text();
    if (!isPlainTextList(text)) {
      setNotice("That file is not a plain-text list.");
      return;
    }
    ingest(text);
  }

  const cookieLine =
    settings.cookies === "none"
      ? "No cookies are read, so login-only posts will fail."
      : `Uses the ${BROWSER_LABEL[settings.cookies]} login already on your Mac. Cookies never leave that browser.`;

  const summary =
    items.length === 0
      ? "Nothing saved in this tab yet."
      : `${counts.selected} of ${items.length} ready.`;

  const downloadButton = downloadUrl ? (
    <a href={downloadUrl} download="shelf-instagram.sh" className={`${primaryButton} w-full`}>
      <Download className="size-4" aria-hidden="true" />
      Download
    </a>
  ) : (
    <button type="button" className={`${primaryButton} w-full`} disabled>
      <Download className="size-4" aria-hidden="true" />
      Download
    </button>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 pt-8 pb-10 sm:pt-14">
      <header>
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink">Shelf</h1>
        <p className="mt-2 text-base text-pretty text-muted">
          Paste one link or a list. The list stays in this tab only, and the script does not read your browser unless you turn that on.
        </p>
      </header>

      <section className="panel flex flex-col gap-3 p-4">
        <label className="block">
          <span className="sr-only">Links</span>
          <textarea
            value={list}
            onChange={(event) => setList(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (ingest(list)) setList("");
              }
            }}
            rows={3}
            spellCheck={false}
            placeholder="One Instagram link, or several, one per line"
            className="h-24 w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-base text-ink placeholder:text-muted"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              if (ingest(list)) setList("");
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </button>
          <button type="button" className={secondaryButton} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.md,text/plain"
            className="hidden"
            onChange={(event) => void onFile(event)}
          />
        </div>
        {downloadButton}
        <p className="text-sm text-pretty text-muted">
          {result.ok
            ? `Saves shelf-instagram.sh. ${settings.cookies === "none" ? "No cookies." : `${BROWSER_LABEL[settings.cookies]} login, on your Mac only.`}${digest ? ` sha256 ${digest.slice(0, 12)}` : ""}`
            : "Add a link to enable download."}
        </p>
      </section>

      <section className="panel flex min-h-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 px-2">
          <p className="min-h-11 flex-1 px-2 py-2 text-sm text-pretty text-muted tabular-nums" role="status">
            {notice ?? summary}
          </p>
            <div className="flex items-center">
              <button type="button" className={textButton} onClick={() => selectAll(true)} disabled={items.length === 0}>
                All
              </button>
              <button type="button" className={textButton} onClick={() => selectAll(false)} disabled={items.length === 0}>
                None
              </button>
              <button type="button" className={textButton} onClick={clearQueue} disabled={items.length === 0}>
                {armClear ? "Clear?" : "Clear"}
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="px-5 py-10 text-sm text-pretty text-muted">
              Nothing queued. Add one link above, paste several, or upload a text file. Profile, story, and highlight links are left out.
            </p>
          ) : (
            <ul className="queue-scroll min-h-0">
              {items.map((item) => (
                <li key={item.shortcode} className="border-t border-line">
                  <div
                    className={
                      item.selected
                        ? "flex min-h-11 items-center gap-2 border-l-2 border-l-accent pr-1 pl-3"
                        : "flex min-h-11 items-center gap-2 border-l-2 border-l-transparent pr-1 pl-3"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggle(item.shortcode)}
                      aria-label={`${kindLabel(item.kind)} ${item.shortcode}`}
                      className="size-4 shrink-0 accent-accent"
                    />
                    <span className="w-12 shrink-0 text-xs font-medium tracking-widest text-muted uppercase">
                      {kindLabel(item.kind)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{item.shortcode}</span>
                    <button
                      type="button"
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-ink"
                      onClick={() => remove(item.shortcode)}
                      aria-label={`Remove ${item.shortcode}`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="panel well flex min-h-0 flex-col p-4">
            <div className="mb-3 shrink-0">
              <h2 className="font-display text-xl font-medium">shelf-instagram.sh</h2>
              <p className="text-sm text-pretty text-well-muted">
                {result.ok ? cookieLine : "Add at least one link to download the script."}
              </p>
              {digest ? (
                <p className="mt-1 font-mono text-xs text-well-muted" title={digest}>
                  sha256 {digest.slice(0, 16)} — check with shasum -a 256 after you save it
                </p>
              ) : null}
            </div>
            <pre className="script-scroll min-h-0 font-mono text-sm leading-relaxed whitespace-pre">
              {result.ok
                ? result.script
                : items.length === 0
                  ? "The script appears here after you add a link."
                  : result.error}
            </pre>
            <div className="mt-4">
              <button type="button" className={secondaryButton} onClick={() => void copyScript()} disabled={!result.ok}>
                <Copy className="size-4" aria-hidden="true" />
                {copied ? "Copied" : "Copy script"}
              </button>
            </div>
          </div>

          <div className="panel p-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-chip p-1">
              <button
                type="button"
                aria-pressed={settings.mode === "careful"}
                onClick={() => patch({ mode: "careful" })}
                className={
                  settings.mode === "careful"
                    ? "h-11 rounded-md bg-surface text-sm font-medium text-ink"
                    : "h-11 rounded-md text-sm font-medium text-muted"
                }
              >
                Careful
              </button>
              <button
                type="button"
                aria-pressed={settings.mode === "batch"}
                onClick={() => patch({ mode: "batch" })}
                className={
                  settings.mode === "batch"
                    ? "h-11 rounded-md bg-surface text-sm font-medium text-ink"
                    : "h-11 rounded-md text-sm font-medium text-muted"
                }
              >
                One shot
              </button>
            </div>
            <p className="mt-2 text-sm text-pretty text-muted">
              {settings.mode === "careful"
                ? "One link at a time. A failure is saved to shelf-failed.txt and the rest continue."
                : "Every selected link in a single yt-dlp run."}
            </p>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">yt-dlp</span>
                <input
                  value={settings.binary}
                  onChange={(event) => patch({ binary: event.target.value })}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className={`${fieldClass} font-mono`}
                />
                {binaryError ? <span className="mt-1 block text-sm text-pretty text-accent">{binaryError}</span> : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Save to</span>
                <input
                  value={settings.outputDir}
                  onChange={(event) => patch({ outputDir: event.target.value })}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className={`${fieldClass} font-mono`}
                />
                {folderError ? (
                  <span className="mt-1 block text-sm text-pretty text-accent">{folderError}</span>
                ) : (
                  <span className="mt-1 block text-sm text-muted">Created if it isn’t there yet.</span>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Cookies</span>
                <select
                  value={settings.cookies}
                  onChange={(event) => patch({ cookies: event.target.value as Settings["cookies"] })}
                  className={fieldClass}
                >
                  {COOKIE_BROWSERS.map((browser) => (
                    <option key={browser} value={browser}>
                      {BROWSER_LABEL[browser]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={settings.forceOverwrite}
                  onChange={(event) => patch({ forceOverwrite: event.target.checked })}
                  className="size-4 accent-accent"
                />
                Overwrite files already in the folder
              </label>
            </div>

            <details className="mt-3 border-t border-line pt-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink">
                More options
              </summary>
              <div className="grid gap-3 pb-1">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Quality</span>
                  <select
                    value={settings.format}
                    onChange={(event) => patch({ format: event.target.value as Settings["format"] })}
                    className={fieldClass}
                  >
                    {FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {FORMAT_LABEL[format]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">File names</span>
                  <select
                    value={settings.filename}
                    onChange={(event) => patch({ filename: event.target.value as Settings["filename"] })}
                    className={fieldClass}
                  >
                    {NAME_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {NAME_LABEL[style]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-ink">Pause</span>
                    <select
                      value={settings.pauseSeconds}
                      onChange={(event) =>
                        patch({ pauseSeconds: Number(event.target.value) as Settings["pauseSeconds"] })
                      }
                      className={fieldClass}
                    >
                      {PAUSES.map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds === 0 ? "None" : `${seconds}s`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-ink">Retries</span>
                    <select
                      value={settings.retries}
                      onChange={(event) => patch({ retries: Number(event.target.value) as Settings["retries"] })}
                      className={fieldClass}
                    >
                      {RETRIES.map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Check
                  checked={settings.fullCarousel}
                  onChange={(checked) => patch({ fullCarousel: checked })}
                  label="Save every slide of a carousel"
                />
                <Check
                  checked={settings.useArchive}
                  onChange={(checked) => patch({ useArchive: checked })}
                  label="Skip links already recorded in the archive"
                />
                <Check
                  checked={settings.ignoreConfig}
                  onChange={(checked) => patch({ ignoreConfig: checked })}
                  label="Ignore yt-dlp config files"
                />
                <Check
                  checked={settings.restrictFilenames}
                  onChange={(checked) => patch({ restrictFilenames: checked })}
                  label="Keep file names to safe characters"
                />
                <Check
                  checked={settings.embedMetadata}
                  onChange={(checked) => patch({ embedMetadata: checked })}
                  label="Embed metadata (needs ffmpeg)"
                />
                {settings.useArchive && settings.forceOverwrite ? (
                  <p className="rounded-lg bg-chip px-3 py-2 text-sm text-pretty text-ink">
                    Finished links in the archive are skipped, even with overwrite on.
                  </p>
                ) : null}
              </div>
            </details>
          </div>
        </section>
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-accent"
      />
      {label}
    </label>
  );
}
