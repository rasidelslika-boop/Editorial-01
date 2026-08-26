import { AnimatePresence, motion } from "framer-motion";
import { Aperture, Archive, Download, History, Loader2, Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { buildExportZip, type ExportArchive } from "../lib/exportZip";
import { Button } from "./ui";
import { cn } from "../lib/utils";

const TICKER_ITEMS = [
  "Vogue Italia",
  "Tim Walker",
  "Peter Lindbergh",
  "Helmut Newton",
  "i-D",
  "Harper's Bazaar",
  "Dazed",
  "W Magazine",
  "Mert & Marcus",
  "Corinne Day",
  "Steven Meisel",
  "Juergen Teller",
];

function TickerRow() {
  return (
    <div className="flex shrink-0 items-center">
      {TICKER_ITEMS.map((item) => (
        <span key={item} className="flex items-center">
          <span className="px-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45 dark:text-paper/40">{item}</span>
          <span className="text-gilt-500" aria-hidden>✦</span>
        </span>
      ))}
    </div>
  );
}

export function Header() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const toast = useUIStore((s) => s.toast);
  const setHistoryOpen = useUIStore((s) => s.setHistoryOpen);
  const generations = useStudioStore((s) => s.generations);
  const form = useStudioStore((s) => s.form);
  const baseId = useStudioStore((s) => s.baseId);

  const [packing, setPacking] = useState(false);
  const [archive, setArchive] = useState<(ExportArchive & { href: string }) | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Retire the previous blob URL whenever a new archive replaces it.
  useEffect(() => {
    return () => {
      if (archive) URL.revokeObjectURL(archive.href);
    };
  }, [archive]);

  // Click-away closes the export panel.
  useEffect(() => {
    if (!archive) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setArchive(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [archive]);

  /**
   * Pack the project into a ZIP, then surface a REAL anchor — left-click
   * saves instantly, right-click → "Save link as…" always works, even where
   * the preview pane strips programmatic downloads.
   */
  const exportProject = async () => {
    if (packing) return;
    setPacking(true);
    try {
      const result = await buildExportZip({ form, generations, baseId });
      setArchive((prev) => {
        if (prev) URL.revokeObjectURL(prev.href);
        return { ...result, href: URL.createObjectURL(result.blob) };
      });
      toast("Export ready", {
        description: `${result.plates} plate${result.plates === 1 ? "" : "s"} zipped — click Download ZIP (or right-click it).`,
        tone: "success",
      });
    } catch (err) {
      console.warn("[Editorial-RSF] Export failed", err);
      toast("Export failed", {
        description: err instanceof Error ? err.message : "Something went wrong while zipping the project.",
        tone: "error",
      });
    } finally {
      setPacking(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/15 bg-paper/95 backdrop-blur-sm dark:border-paper/15 dark:bg-ink/95">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center bg-wine-800 text-gilt-300 dark:bg-wine-950">
              <Aperture className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <div className="min-w-0 leading-none">
              <p className="font-display wonk truncate text-lg font-semibold italic tracking-tight sm:text-xl md:text-2xl">
                Editorial<span className="text-wine-700 dark:text-gilt-400">-RSF</span>
              </p>
              <p className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.28em] text-ink/45 dark:text-paper/40 sm:block">
                Vol. 01 — The Lightbox Issue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative" ref={panelRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void exportProject()}
                disabled={packing}
                aria-label="Export project as a ZIP archive"
              >
                {packing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                <span className="hidden md:inline">{packing ? "Packing…" : "Export ZIP"}</span>
              </Button>

              <AnimatePresence>
                {archive ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className="absolute right-0 top-full z-50 mt-2 w-[300px] border border-ink/15 bg-paper p-3.5 shadow-[0_24px_60px_-24px_rgba(18,17,20,0.5)] dark:border-paper/15 dark:bg-[#1b181e]"
                    role="dialog"
                    aria-label="Project export ready"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-wine-700 dark:text-gilt-400">
                        Export ready
                      </p>
                      <button
                        onClick={() => setArchive(null)}
                        aria-label="Close export panel"
                        className="text-ink/40 transition-colors hover:text-ink dark:text-paper/40 dark:hover:text-paper"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1.5 truncate font-mono text-[11px] font-bold" title={archive.filename}>
                      {archive.filename}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink/50 dark:text-paper/45">
                      {archive.plates} plate{archive.plates === 1 ? "" : "s"} · settings · prompts ·{" "}
                      {Math.max(1, Math.round(archive.blob.size / 1024))} KB
                    </p>

                    {/* A genuine anchor — the one save control no browser strips. */}
                    <motion.a
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      href={archive.href}
                      download={archive.filename}
                      className={cn(
                        "mt-3 flex h-10 items-center justify-center gap-2 bg-ink font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-paper",
                        "transition-colors hover:bg-wine-800 dark:bg-paper dark:text-ink dark:hover:bg-gilt-300"
                      )}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download ZIP
                    </motion.a>
                    <p className="mt-2 text-center font-mono text-[9px] leading-relaxed text-ink/40 dark:text-paper/35">
                      Nothing happens on click? Right-click the button → “Save link as…”
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} aria-label="Open archive">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Archive</span>
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-wine-700 px-1 font-mono text-[9px] font-bold text-wine-50 dark:bg-gilt-500 dark:text-ink">
                {generations.length}
              </span>
            </Button>
            <Button variant="outline" size="sm" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Editorial ticker — a living strip of references */}
        <div className="overflow-hidden border-t border-ink/10 py-1.5 dark:border-paper/10" aria-hidden>
          <motion.div
            className="flex w-max animate-marquee"
            initial={{ x: 0 }}
          >
            <TickerRow />
            <TickerRow />
          </motion.div>
        </div>
        <div className="border-t-2 border-double border-ink/20 dark:border-paper/20" />
      </header>
    </>
  );
}
