import { motion } from "framer-motion";
import { Aperture, Download, History, Moon, Sun } from "lucide-react";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { downloadJson } from "../lib/utils";
import { Button } from "./ui";

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

  const exportProject = () => {
    downloadJson(
      {
        app: "RSFASHIONPHOTO",
        version: 1,
        exportedAt: new Date().toISOString(),
        currentSettings: form,
        lockedReferenceId: baseId,
        archive: generations,
      },
      `rsfashionphoto-project-${new Date().toISOString().slice(0, 10)}.json`
    );
    toast("Project exported", { description: "Settings, prompts and the full archive as JSON.", tone: "success" });
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
                RS<span className="text-wine-700 dark:text-gilt-400">FASHIONPHOTO</span>
              </p>
              <p className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.28em] text-ink/45 dark:text-paper/40 sm:block">
                Vol. 01 — The Lightbox Issue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={exportProject} aria-label="Export project JSON">
              <Download className="h-4 w-4" />
              <span className="hidden md:inline">Export JSON</span>
            </Button>
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
