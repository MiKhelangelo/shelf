export const COOKIE_BROWSERS = ["safari", "chrome", "firefox", "brave", "edge", "none"] as const;
export type CookieBrowser = (typeof COOKIE_BROWSERS)[number];

export const SESSIONS = ["safari", "firefox", "none"] as const;
export type Session = (typeof SESSIONS)[number];

export const FORMATS = ["best", "mp4", "merge"] as const;
export type FormatId = (typeof FORMATS)[number];

export const NAME_STYLES = ["uploader-id", "id", "title-id"] as const;
export type NameStyle = (typeof NAME_STYLES)[number];

export const PAUSES = [0, 1, 2, 3, 5] as const;
export type Pause = (typeof PAUSES)[number];

export const RETRIES = [5, 10, 20] as const;
export type Retries = (typeof RETRIES)[number];

export const CONCURRENCY = [1, 2, 3, 4] as const;
export type Concurrency = (typeof CONCURRENCY)[number];

export type RunMode = "careful" | "batch";
export type OnDuplicate = "skip" | "redownload";

export type Settings = {
  binary: string;
  outputDir: string;
  cookies: CookieBrowser;
  format: FormatId;
  filename: NameStyle;
  forceOverwrite: boolean;
  ignoreConfig: boolean;
  useArchive: boolean;
  restrictFilenames: boolean;
  embedMetadata: boolean;
  fullCarousel: boolean;
  mode: RunMode;
  pauseSeconds: Pause;
  retries: Retries;
  concurrency: Concurrency;
  onDuplicate: OnDuplicate;
  showThumbnails: boolean;
};

export const defaultSettings: Settings = {
  binary: "$HOME/Downloads/yt-dlp_macos",
  outputDir: "$HOME/Downloads/Instagram-Reels",
  cookies: "safari",
  format: "best",
  filename: "id",
  forceOverwrite: false,
  ignoreConfig: true,
  useArchive: true,
  restrictFilenames: true,
  embedMetadata: false,
  fullCarousel: true,
  mode: "careful",
  pauseSeconds: 1,
  retries: 10,
  concurrency: 3,
  onDuplicate: "skip",
  showThumbnails: false,
};

const PATH_RE = /^(?:\$HOME|~|\/)(?:\/[A-Za-z0-9._+-]+)+$/;

export function pathError(path: string): string | null {
  const value = path.trim();
  if (!value) return "Add a folder.";
  if (value.length > 240) return "That folder path is too long.";
  if (!PATH_RE.test(value)) {
    return "Use a simple path, like $HOME/Downloads/Instagram-Reels. No spaces or quotes.";
  }
  return null;
}

/** Double-quoted path with `$HOME` expansion. `~` is rewritten because it does not expand inside quotes. */
export function bashPath(path: string): string {
  const value = path.trim();
  if (pathError(value)) throw new Error("Refusing to quote an unsafe path.");
  const expanded = value.startsWith("~/") ? `$HOME/${value.slice(2)}` : value;
  return `"${expanded}"`;
}

export const FORMAT_ARG: Record<FormatId, string> = {
  best: "best",
  mp4: "best[ext=mp4]/best",
  merge: "bv*+ba/b",
};

export const FORMAT_LABEL: Record<FormatId, string> = {
  best: "Best picture",
  mp4: "A video that plays anywhere",
  merge: "Best picture and sound",
};

export const NAME_ARG: Record<NameStyle, string> = {
  "uploader-id": "%(uploader)s_%(id)s.%(ext)s",
  id: "%(id)s.%(ext)s",
  "title-id": "%(title).80s [%(id)s].%(ext)s",
};

export const NAME_LABEL: Record<NameStyle, string> = {
  "uploader-id": "Name and code",
  id: "Just the code",
  "title-id": "Title and code",
};

export const BROWSER_LABEL: Record<CookieBrowser, string> = {
  safari: "Safari",
  chrome: "Chrome",
  firefox: "Firefox",
  brave: "Brave",
  edge: "Edge",
  none: "No login",
};

export const SESSION_LABEL: Record<Session, string> = {
  safari: "Safari",
  firefox: "Firefox",
  none: "No login",
};

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function isOneOfNumber<T extends number>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "number" && (options as readonly number[]).includes(value);
}

export function sanitizeSettings(input: unknown): Settings {
  const raw = input && typeof input === "object" ? (input as Partial<Settings>) : {};
  return {
    binary: typeof raw.binary === "string" ? raw.binary : defaultSettings.binary,
    outputDir: typeof raw.outputDir === "string" ? raw.outputDir : defaultSettings.outputDir,
    cookies: isOneOf(raw.cookies, COOKIE_BROWSERS) ? raw.cookies : defaultSettings.cookies,
    format: isOneOf(raw.format, FORMATS) ? raw.format : defaultSettings.format,
    filename: isOneOf(raw.filename, NAME_STYLES) ? raw.filename : defaultSettings.filename,
    forceOverwrite:
      typeof raw.forceOverwrite === "boolean" ? raw.forceOverwrite : defaultSettings.forceOverwrite,
    ignoreConfig:
      typeof raw.ignoreConfig === "boolean" ? raw.ignoreConfig : defaultSettings.ignoreConfig,
    useArchive: typeof raw.useArchive === "boolean" ? raw.useArchive : defaultSettings.useArchive,
    restrictFilenames:
      typeof raw.restrictFilenames === "boolean"
        ? raw.restrictFilenames
        : defaultSettings.restrictFilenames,
    embedMetadata:
      typeof raw.embedMetadata === "boolean" ? raw.embedMetadata : defaultSettings.embedMetadata,
    fullCarousel:
      typeof raw.fullCarousel === "boolean" ? raw.fullCarousel : defaultSettings.fullCarousel,
    mode: raw.mode === "batch" || raw.mode === "careful" ? raw.mode : defaultSettings.mode,
    pauseSeconds: isOneOfNumber(raw.pauseSeconds, PAUSES)
      ? raw.pauseSeconds
      : defaultSettings.pauseSeconds,
    retries: isOneOfNumber(raw.retries, RETRIES) ? raw.retries : defaultSettings.retries,
    concurrency: isOneOfNumber(raw.concurrency, CONCURRENCY)
      ? raw.concurrency
      : defaultSettings.concurrency,
    onDuplicate: raw.onDuplicate === "redownload" ? "redownload" : "skip",
    showThumbnails: raw.showThumbnails === true,
  };
}