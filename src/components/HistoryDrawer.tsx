import { AnimatePresence, motion } from "framer-motion";
import { ArchiveX, FolderOpen, Heart, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { ENGINES } from "../lib/presets";
import { promptSummary } from "../lib/promptBuilder";
import { timeAgo, cn } from "../lib/utils";
import { Button } from "./ui";

type Tab = "all" | "favorites";

export function HistoryDrawer() {
  const open = useUIStore((s) => s.historyOpen);
  const setOpen = useUIStore((s) => s.setHistoryOpen);
  const toast = useUIStore((s) => s.toast);
  const generations = useStudioStore((s) => s.generations);
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  const removeGeneration = useStudioStore((s) => s.removeGeneration);
  const loadGeneration = useStudioStore((s) => s.loadGeneration);
  const clearArchive = useStudioStore((s) => s.clearArchive);

  const [tab, setTab] = useState<Tab>("all");
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setArmed(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const list = tab === "favorites" ? generations.filter((g) => g.favorite) : generations;

  const engineLabel = (id: string) => ENGINES.find((e) => e.id === id)?.label ?? id;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/50 dark:bg-ink/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Generation archive"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink/15 bg-paper dark:border-paper/15 dark:bg-[#161419]"
          >
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4 dark:border-paper/10">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-wine-700 dark:text-gilt-400">The Archive</p>
                <h2 className="font-display text-2xl font-semibold italic leading-tight">Every plate, kept.</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close archive">
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="flex items-center gap-2 border-b border-ink/10 px-5 py-2.5 dark:border-paper/10">
              {(["all", "favorites"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-sm px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-colors",
                    tab === t
                      ? "bg-ink text-paper dark:bg-paper dark:text-ink"
                      : "text-ink/50 hover:text-ink dark:text-paper/45 dark:hover:text-paper"
                  )}
                >
                  {t === "all" ? `All · ${generations.length}` : `Favorites · ${generations.filter((g) => g.favorite).length}`}
                </button>
              ))}
              {generations.length > 0 && (
                <button
                  onClick={() => {
                    if (!armed) {
                      setArmed(true);
                      setTimeout(() => setArmed(false), 2600);
                      return;
                    }
                    clearArchive();
                    setArmed(false);
                    toast("Archive cleared", { description: "Every plate was discarded.", tone: "info" });
                  }}
                  className={cn(
                    "ml-auto flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                    armed
                      ? "border-wine-700 bg-wine-700 text-wine-50"
                      : "border-ink/20 text-ink/50 hover:border-wine-700 hover:text-wine-700 dark:border-paper/20 dark:text-paper/45 dark:hover:border-wine-400 dark:hover:text-wine-300"
                  )}
                >
                  <Trash2 className="h-3 w-3" />
                  {armed ? "Confirm?" : "Clear"}
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {list.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <ArchiveX className="mx-auto h-7 w-7 text-ink/25 dark:text-paper/25" strokeWidth={1.4} />
                    <p className="font-display mt-3 text-lg italic text-ink/60 dark:text-paper/55">
                      {tab === "favorites" ? "No favorites yet — star a plate." : "Nothing archived yet."}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/35 dark:text-paper/30">
                      Generations persist in this browser
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3">
                  {list.map((g) => (
                    <motion.li
                      key={g.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group overflow-hidden rounded-sm border border-ink/15 dark:border-paper/15"
                    >
                      <button
                        onClick={() => {
                          loadGeneration(g.id);
                          setOpen(false);
                          toast("Plate reopened", { description: "Its settings are back on the form.", tone: "success" });
                        }}
                        className="relative block aspect-[4/5] w-full overflow-hidden bg-ink/5 dark:bg-paper/5"
                        aria-label={`Reopen plate seed ${g.seed}`}
                      >
                        <img
                          src={g.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          style={{ filter: g.filter && g.filter !== "none" ? g.filter : undefined, objectPosition: g.focus ?? "50% 40%" }}
                        />
                        {g.upscaled ? (
                          <span className="absolute left-1.5 top-1.5 rounded-sm bg-gilt-500 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-ink">
                            4K
                          </span>
                        ) : null}
                        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-ink/80 to-transparent px-2 pb-1.5 pt-5 text-left">
                          <FolderOpen className="h-3 w-3 shrink-0 text-gilt-300" />
                          <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-paper/90">Reopen</span>
                        </span>
                      </button>
                      <div className="flex items-start justify-between gap-1 px-2 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-ink/60 dark:text-paper/55">
                            {engineLabel(g.engine)} · {g.ratio} · {timeAgo(g.createdAt)}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink/75 dark:text-paper/70">
                            {promptSummary(g.prompt, 80)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => toggleFavorite(g.id)}
                            aria-label={g.favorite ? "Remove favorite" : "Add favorite"}
                            className={cn(
                              "grid h-6 w-6 place-items-center rounded-sm border transition-colors",
                              g.favorite
                                ? "border-gilt-500 bg-gilt-500/15 text-gilt-500"
                                : "border-ink/15 text-ink/40 hover:border-gilt-500 hover:text-gilt-500 dark:border-paper/15 dark:text-paper/40"
                            )}
                          >
                            <Heart className={cn("h-3 w-3", g.favorite && "fill-current")} />
                          </button>
                          <button
                            onClick={() => {
                              removeGeneration(g.id);
                              toast("Plate discarded", { tone: "info" });
                            }}
                            aria-label="Delete plate"
                            className="grid h-6 w-6 place-items-center rounded-sm border border-ink/15 text-ink/40 transition-colors hover:border-wine-700 hover:text-wine-700 dark:border-paper/15 dark:text-paper/40 dark:hover:border-wine-400 dark:hover:text-wine-300"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
