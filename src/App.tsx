import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Copy, Download, Plus, Search, Upload, X } from "lucide-react";
import {
  capIncoming,
  extractInstagramUrls,
  isPlainTextList,
  kindLabel,
  LIBRARY_LIMIT,
  matchesQuery,
  mergeLinks,
  tally,
  itemTitle,
  type Item,
  type Kind,
} from "./lib/instagram";
import { pickRandom, REEL_INDEX, sanitizeReel, searchCatalog, wordsOf, type ReelRecord } from "./lib/catalog";
import { generateScript } from "./lib/script";
import { readSubmissions, saveSubmission } from "./lib/submissions";
import {
  BROWSER_LABEL,
  CONCURRENCY,
  defaultSettings,
  FORMAT_LABEL,
  FORMATS,
  NAME_LABEL,
  NAME_STYLES,
  PAUSES,
  pathError,
  RETRIES,
  SESSION_LABEL,
  SESSIONS,
  type Session,
  type Settings,
} from "./lib/settings";
import { readShelfState, writeShelfState } from "./lib/storage";

const fieldClass =
  "h-12 w-full rounded-lg border border-line bg-field px-3 text-base text-ink placeholder:text-muted";
const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-chip disabled:cursor-not-allowed disabled:opacity-40";
const textButton =
  "inline-flex h-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

type KindFilter = "all" | Kind;

function describeAdd(
  added: number,
  duplicates: number,
  rejected: number,
  overflow: number,
  libraryFull: number,
): string {
  const bits: string[] = [];
  if (added > 0) bits.push(added === 1 ? "Added 1 link" : `Added ${added} links`);
  if (duplicates > 0) bits.push(duplicates === 1 ? "Skipped 1 duplicate" : `Skipped ${duplicates} duplicates`);
  if (rejected > 0) bits.push(rejected === 1 ? "1 line was not a post or Reel" : `${rejected} lines were not posts or Reels`);
  if (overflow > 0) bits.push(`${overflow} not added. The limit is 200 at a time`);
  if (libraryFull > 0) bits.push("The library is full");
  if (bits.length === 0) return "Paste a link first.";
  return `${bits.join(". ")}.`;
}

function sessionOf(cookies: Settings["cookies"]): Session {
  if (cookies === "firefox" || cookies === "none") return cookies;
  return "safari";
}

export function ShelfApp() {
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [list, setList] = useState("");
  const [query, setQuery] = useState("");
  const [randomHits, setRandomHits] = useState<ReelRecord[] | null>(null);
  const [submissions, setSubmissions] = useState<ReelRecord[]>([]);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [armClear, setArmClear] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readShelfState();
    if (saved) {
      setItems(saved.items);
      setSettings(saved.settings);
    }
    setSubmissions(readSubmissions());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeShelfState({ items, settings });
  }, [hydrated, items, settings]);

  useEffect(() => {
    if (!hydrated) return;
    if (settings.cookies === "safari" || settings.cookies === "firefox" || settings.cookies === "none") {
      return;
    }
    setSettings((current) => ({ ...current, cookies: "safari" }));
  }, [hydrated, settings.cookies]);

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
  const catalog = useMemo(() => {
    const seen = new Set(submissions.map((reel) => reel.shortcode));
    return [...submissions, ...REEL_INDEX.filter((reel) => !seen.has(reel.shortcode))];
  }, [submissions]);
  const hits = useMemo(
    () => (wordsOf(query).length === 0 ? [] : searchCatalog(catalog, query, 12)),
    [catalog, query],
  );
  const shown = wordsOf(query).length === 0 ? (randomHits ?? []) : hits;
  const filtered = useMemo(
    () => items.filter((item) => (kind === "all" || item.kind === kind) && matchesQuery(item, query)),
    [items, kind, query],
  );

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
      setNotice("Paste a link first.");
      return false;
    }
    const extracted = extractInstagramUrls(trimmed);
    const capped = capIncoming(extracted.links);
    const room = Math.max(LIBRARY_LIMIT - items.length, 0);
    const acceptedLinks = capped.links.slice(0, room);
    const merged = mergeLinks(items, acceptedLinks);
    setItems(merged.items.slice(0, LIBRARY_LIMIT));
    setNotice(
      describeAdd(
        merged.added,
        extracted.duplicates + merged.duplicates,
        extracted.rejected,
        capped.overflow,
        capped.links.length - acceptedLinks.length,
      ),
    );
    return true;
  }

  function addCatalog(reels: readonly ReelRecord[]) {
    if (reels.length === 0) {
      setNotice("No reels match that word.");
      return;
    }
    const room = Math.max(LIBRARY_LIMIT - items.length, 0);
    const accepted = reels.slice(0, room);
    const merged = mergeLinks(
      items,
      accepted.map((reel) => ({ ...reel, kind: "reel" as const })),
    );
    setItems(merged.items.slice(0, LIBRARY_LIMIT));
    setKind("all");
    if (merged.added === 0) {
      setNotice("Those reels are already in the library.");
      return;
    }
    setNotice(merged.added === 1 ? "Added 1 reel." : `Added ${merged.added} reels.`);
  }

  function findReels() {
    if (wordsOf(query).length === 0) {
      setRandomHits(pickRandom(catalog, 12));
      setNotice("12 reels picked at random from the index.");
      return;
    }
    setRandomHits(null);
    const found = searchCatalog(catalog, query, 12);
    setNotice(found.length === 0 ? "No reels match that word." : `${found.length} reels match that word.`);
  }

  function submitReel() {
    const reel = sanitizeReel(
      {
        url: draftUrl,
        title: draftTitle,
        description: draftDescription,
        tags: draftTags.split(","),
        source: "submission",
      },
      "submission",
    );
    if (!reel) {
      setNotice("Use one Instagram Reel link.");
      return;
    }
    setSubmissions(saveSubmission(reel));
    setDraftUrl("");
    setDraftTitle("");
    setDraftTags("");
    setDraftDescription("");
    setNotice("Saved your reel in this browser. It is included in search.");
  }

  function saveToDownloads() {
    if (!result.ok) return;
    const blob = new Blob([result.script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "shelf-instagram.sh";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setNotice("Saved to Downloads. Open the file to download the videos.");
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
      current.map((item) => (item.shortcode === shortcode ? { ...item, selected: !item.selected } : item)),
    );
  }

  function remove(shortcode: string) {
    setItems((current) => current.filter((item) => item.shortcode !== shortcode));
  }

  function selectVisible(selected: boolean) {
    const visible = new Set(filtered.map((item) => item.shortcode));
    setItems((current) => current.map((item) => (visible.has(item.shortcode) ? { ...item, selected } : item)));
  }

  function clearQueue() {
    if (items.length === 0) return;
    if (!armClear) {
      setArmClear(true);
      return;
    }
    setItems([]);
    setArmClear(false);
    setNotice("Library cleared.");
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 500_000) {
      setNotice("That file is too large. Use a plain-text list.");
      return;
    }
    const text = await file.text();
    if (!isPlainTextList(text)) {
      setNotice("Use a plain-text list of links.");
      return;
    }
    ingest(text);
  }

  const session = sessionOf(settings.cookies);
  const cookieLine =
    settings.cookies === "none"
      ? "No browser login. Private posts will not download."
      : `Uses the ${BROWSER_LABEL[settings.cookies]} session on this Mac. The login stays in that browser.`;

  const summary =
    items.length === 0
      ? "No items yet."
      : `${counts.selected} of ${items.length} selected. ${filtered.length} shown.`;

  const downloadButton = (
    <button type="button" className={`${primaryButton} w-full sm:w-auto`} onClick={saveToDownloads} disabled={!result.ok}>
      <Download className="size-4" aria-hidden="true" />
      Save to Downloads
    </button>
  );

  const filters: { id: KindFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "post", label: "Posts" },
    { id: "reel", label: "Reels" },
    { id: "tv", label: "TV" },
    { id: "search", label: "Searches" },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-12 sm:pt-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink">Shelf</h1>
          <p className="mt-2 max-w-2xl text-base text-pretty text-ink">
            Save Instagram posts and Reels to your Mac. Paste one link or up to 200. Duplicates are skipped, and the videos stay on this computer.
          </p>
        </div>
        <p className="text-sm text-muted tabular-nums">
          {counts.posts} posts · {counts.reels} reels
          {counts.searches > 0 ? ` · ${counts.searches} ${counts.searches === 1 ? "search" : "searches"}` : ""}
        </p>
      </header>

      <section className="panel flex flex-col gap-4 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Paste links</span>
          <textarea
            value={list}
            onChange={(event) => setList(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (ingest(list)) setList("");
              }
            }}
            rows={6}
            spellCheck={false}
            placeholder="Paste Instagram links, one per line"
            className="h-36 w-full resize-y rounded-lg border border-line bg-field px-3 py-2 text-base text-ink placeholder:text-muted"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Login</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-chip p-1">
              {SESSIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={session === value}
                  onClick={() => patch({ cookies: value })}
                  className={
                    session === value
                      ? "h-11 rounded-md bg-surface text-sm font-medium text-ink"
                      : "h-11 rounded-md text-sm font-medium text-muted"
                  }
                >
                  {SESSION_LABEL[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Duplicates</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-chip p-1">
              <button
                type="button"
                aria-pressed={settings.onDuplicate === "skip"}
                onClick={() => patch({ onDuplicate: "skip", useArchive: true, forceOverwrite: false })}
                className={
                  settings.onDuplicate === "skip"
                    ? "h-11 rounded-md bg-surface text-sm font-medium text-ink"
                    : "h-11 rounded-md text-sm font-medium text-muted"
                }
              >
                Skip
              </button>
              <button
                type="button"
                aria-pressed={settings.onDuplicate === "redownload"}
                onClick={() => patch({ onDuplicate: "redownload", useArchive: false, forceOverwrite: true })}
                className={
                  settings.onDuplicate === "redownload"
                    ? "h-11 rounded-md bg-surface text-sm font-medium text-ink"
                    : "h-11 rounded-md text-sm font-medium text-muted"
                }
              >
                Download again
              </button>
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">At a time</span>
            <select
              value={settings.concurrency}
              onChange={(event) => patch({ concurrency: Number(event.target.value) as Settings["concurrency"] })}
              className={fieldClass}
              disabled={settings.mode === "batch"}
            >
              {CONCURRENCY.map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? "1 at a time" : `${count} at a time`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex h-12 items-center gap-3 self-end text-sm text-ink">
            <input
              type="checkbox"
              checked={settings.showThumbnails}
              onChange={(event) => patch({ showThumbnails: event.target.checked })}
              className="size-4 accent-ink"
            />
            Thumbnails
          </label>
        </div>

        <p className="text-sm text-pretty text-muted">
          {settings.onDuplicate === "skip"
            ? "Items already saved are skipped."
            : "Items already saved are downloaded again."}{" "}
          {settings.mode === "batch"
            ? "The full list runs as one download."
            : settings.concurrency === 1
              ? "Downloads run one at a time."
              : `Downloads run ${settings.concurrency} at a time.`}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
          {downloadButton}
        </div>
        <p className="text-sm text-pretty text-muted">
          {result.ok
            ? `Saved as shelf-instagram.sh in Downloads. Open Terminal and follow the numbered steps at the top of that file. ${settings.cookies === "none" ? "No browser login." : `Uses ${BROWSER_LABEL[settings.cookies]} on this Mac.`}`
            : "Add a link before saving the file."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-medium text-ink">Library</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search reels by keyword</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  findReels();
                }
              }}
              placeholder="Search reels by keyword"
              className={`${fieldClass} pl-10`}
            />
          </label>
          <button type="button" className={secondaryButton} onClick={findReels}>
            <Search className="size-4" aria-hidden="true" />
            Find reels
          </button>
          <div className="flex flex-wrap gap-1 rounded-lg bg-chip p-1">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={kind === filter.id}
                onClick={() => setKind(filter.id)}
                className={
                  kind === filter.id
                    ? "h-11 rounded-md bg-surface px-3 text-sm font-medium text-ink"
                    : "h-11 rounded-md px-3 text-sm font-medium text-muted"
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {shown.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {shown.length} {shown.length === 1 ? "reel" : "reels"} from the index
              </p>
              <button type="button" className={secondaryButton} onClick={() => addCatalog(shown)}>
                <Plus className="size-4" aria-hidden="true" />
                Add matches
              </button>
            </div>
            <ul className="grid gap-2">
              {shown.map((reel) => (
                <li key={reel.shortcode} className="flex flex-col gap-2 rounded-lg border border-line bg-field p-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-pretty text-ink">{reel.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-pretty text-muted">{reel.description}</p>
                    {reel.tags.length > 0 ? (
                      <p className="mt-1 text-xs text-muted">{reel.tags.slice(0, 5).map((tag) => `#${tag}`).join(" ")}</p>
                    ) : null}
                  </div>
                  <button type="button" className={secondaryButton} onClick={() => addCatalog([reel])}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <details className="rounded-lg border border-line px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink">Submit a reel</summary>
          <div className="grid gap-3 pb-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Reel link</span>
              <input value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} placeholder="https://www.instagram.com/reel/…" spellCheck={false} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Title</span>
              <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Tags</span>
              <input value={draftTags} onChange={(event) => setDraftTags(event.target.value)} placeholder="travel, music" className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Description</span>
              <input value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} className={fieldClass} />
            </label>
            <button type="button" className={`${secondaryButton} w-full sm:w-auto`} onClick={submitReel}>
              Save to index
            </button>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="min-h-11 px-1 py-2 text-sm text-pretty text-muted tabular-nums" role="status">
            {notice ?? summary}
          </p>
          <div className="flex items-center">
            <button type="button" className={textButton} onClick={() => selectVisible(true)} disabled={filtered.length === 0}>
              All
            </button>
            <button type="button" className={textButton} onClick={() => selectVisible(false)} disabled={filtered.length === 0}>
              None
            </button>
            <button type="button" className={textButton} onClick={clearQueue} disabled={items.length === 0}>
              {armClear ? "Clear?" : "Clear"}
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="panel px-5 py-12 text-sm text-pretty text-muted">
            Nothing here yet. Paste a link, search the index, or submit a reel.
          </p>
        ) : filtered.length === 0 ? (
          <p className="panel px-5 py-12 text-sm text-pretty text-muted">No results for that search.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => (
              <li key={item.shortcode} className="panel overflow-hidden">
                <Cover key={`${item.shortcode}-${settings.showThumbnails}`} item={item} show={settings.showThumbnails} />
                <div className="flex items-center gap-1 pr-1 pl-3">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggle(item.shortcode)}
                    aria-label={`Include ${kindLabel(item.kind)} ${itemTitle(item)}`}
                    className="size-4 shrink-0 accent-ink"
                  />
                  <div className="min-w-0 flex-1 py-2">
                    <p className="text-xs font-medium tracking-widest text-muted uppercase">{kindLabel(item.kind)}</p>
                    <p className="truncate text-sm text-ink">{item.title || itemTitle(item)}</p>
                    {item.title ? <p className="truncate font-mono text-xs text-muted">{item.shortcode}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-ink"
                    onClick={() => remove(item.shortcode)}
                    aria-label={`Remove ${itemTitle(item)}`}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel well flex min-h-0 flex-col p-4">
          <div className="mb-3">
            <h2 className="font-display text-xl font-medium">Download file</h2>
            <p className="text-sm text-pretty text-well-muted">
              {result.ok ? cookieLine : "Add a link to prepare the file."}
            </p>
            {digest ? (
              <p className="mt-1 font-mono text-xs text-well-muted" title={digest}>
                SHA-256 {digest.slice(0, 16)}
              </p>
            ) : null}
          </div>
          <pre className="script-scroll min-w-0 font-mono text-sm leading-relaxed">
            {result.ok ? result.script : items.length === 0 ? "The file appears here after you add a link." : result.error}
          </pre>
          <div className="mt-4">
            <button type="button" className={secondaryButton} onClick={() => void copyScript()} disabled={!result.ok}>
              <Copy className="size-4" aria-hidden="true" />
              {copied ? "Copied" : "Copy file"}
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
              One at a time
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
              All at once
            </button>
          </div>
          <p className="mt-2 text-sm text-pretty text-muted">
            {settings.mode === "careful"
              ? "If one item fails, the rest continue. Failed links are written to shelf-failed.txt."
              : "Every selected link is sent in a single run."}
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
              {binaryError ? <span className="mt-1 block text-sm text-pretty text-danger">{binaryError}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Save folder</span>
              <input
                value={settings.outputDir}
                onChange={(event) => patch({ outputDir: event.target.value })}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className={`${fieldClass} font-mono`}
              />
              {folderError ? (
                <span className="mt-1 block text-sm text-pretty text-danger">{folderError}</span>
              ) : (
                <span className="mt-1 block text-sm text-muted">Created if it does not exist. The library stays in this browser.</span>
              )}
            </label>
          </div>

          <details className="mt-3 border-t border-line pt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink">
              More options
            </summary>
            <div className="grid gap-3 pb-1">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Format</span>
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
                <span className="mb-1 block text-sm font-medium text-ink">File name</span>
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
                    onChange={(event) => patch({ pauseSeconds: Number(event.target.value) as Settings["pauseSeconds"] })}
                    className={fieldClass}
                    disabled={settings.mode === "careful" && settings.concurrency > 1}
                  >
                    {PAUSES.map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds === 0 ? "None" : `${seconds} seconds`}
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
                label="Download every image in a carousel"
              />
              <Check
                checked={settings.ignoreConfig}
                onChange={(checked) => patch({ ignoreConfig: checked })}
                label="Ignore existing yt-dlp settings"
              />
              <Check
                checked={settings.restrictFilenames}
                onChange={(checked) => patch({ restrictFilenames: checked })}
                label="Use safe characters in file names"
              />
              <Check
                checked={settings.embedMetadata}
                onChange={(checked) => patch({ embedMetadata: checked })}
                label="Embed the title in the video file"
              />
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

function Cover({ item, show }: { item: Item; show: boolean }) {
  const [broken, setBroken] = useState(false);
  if (show && item.kind !== "search" && !broken) {
    return (
      <img
        src={`${item.url}media/?size=m`}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="aspect-3/4 w-full bg-well object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-3/4 w-full flex-col justify-between bg-well p-3">
      <span className="text-xs font-medium tracking-widest text-well-muted uppercase">{kindLabel(item.kind)}</span>
      <span className="font-display text-xl leading-tight break-all text-well-fg">{itemTitle(item)}</span>
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
        className="size-4 accent-ink"
      />
      {label}
    </label>
  );
}
