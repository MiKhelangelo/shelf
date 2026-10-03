import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { APP_SCRIPT, generateScript } from "./lib/script";

const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity duration-150 hover:opacity-90";

export function ShelfApp() {
  const result = useMemo(() => generateScript(), []);
  const [notice, setNotice] = useState<string | null>(null);
  const script = result.ok ? result.script : APP_SCRIPT;

  function saveToDownloads() {
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "shelf-instagram.sh";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setNotice("Saved to Downloads. Run ./shelf-instagram.sh. It downloads the app and does not download videos.");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 pt-8 pb-12 sm:pt-12">
      <header>
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink">Shelf</h1>
        <p className="mt-2 max-w-2xl text-base text-pretty text-ink">
          Download the Shelf app to your Mac. <span className="font-mono">./shelf-instagram.sh</span> saves the app into Downloads/shelf. It does not download videos.
        </p>
      </header>

      <section className="panel flex flex-col gap-4 p-4">
        <h2 className="font-display text-2xl font-medium text-ink">Run the file</h2>
        <ol className="list-decimal space-y-2 pl-5 text-base text-ink">
          <li>Press Save to Downloads, or replace the file already in Downloads with the command below.</li>
          <li>Open Terminal.</li>
          <li>Type <span className="font-mono">cd ~/Downloads</span></li>
          <li>Type <span className="font-mono">chmod +x shelf-instagram.sh</span></li>
          <li>Type <span className="font-mono">./shelf-instagram.sh</span></li>
        </ol>
        <pre className="script-scroll font-mono text-sm leading-relaxed">{`curl -fsSL -o ~/Downloads/shelf-instagram.sh https://raw.githubusercontent.com/MiKhelangelo/shelf/main/shelf-instagram.sh`}</pre>
        <button type="button" className={`${primaryButton} w-full sm:w-auto`} onClick={saveToDownloads}>
          <Download className="size-4" aria-hidden="true" />
          Save to Downloads
        </button>
        <p className="text-sm text-pretty text-muted" role="status">
          {notice ?? "The file downloads the app into Downloads/shelf. It does not download videos."}
        </p>
      </section>

      <section className="panel well flex flex-col p-4">
        <h2 className="font-display text-xl font-medium">Current file</h2>
        <pre className="script-scroll mt-3 font-mono text-sm leading-relaxed">{script}</pre>
      </section>
    </div>
  );
}
