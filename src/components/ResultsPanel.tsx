import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowUpToLine,
  Clapperboard,
  Copy,
  Download,
  Heart,
  Lock,
  Maximize2,
  RefreshCw,
  Shuffle,
  Sparkles,
  Unlock,
  UserRound,
  MapPin,
  Shirt,
  SmilePlus,
} from "lucide-react";
import { useState } from "react";
import type { Generation } from "../types";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { useGenerate } from "../hooks/useGenerate";
import { ENGINES, SCENE_STARTERS } from "../lib/presets";
import { copyText, downloadImage, timeAgo, cn } from "../lib/utils";

function ratioStyle(ratio: string) {
  return { aspectRatio: ratio.replace(":", " / ") } as const;
}

function engineLabel(id: string) {
  return ENGINES.find((e) => e.id === id)?.label ?? id;
}

/* --------------------------------- Loading state --------------------------------- */

function DarkroomLoading() {
  const { progress, stage } = useGenerate();
  const ratio = useStudioStore((s) => s.form.ratio);
  return (
    <div className="relative overflow-hidden border border-ink/15 dark:border-paper/15" style={ratioStyle(ratio)}>
      <div className="absolute inset-0 skeleton-sheen" />
      <div className="absolute inset-x-0 h-16 animate-scan bg-gradient-to-b from-transparent via-gilt-400/15 to-transparent" aria-hidden />
      <div className="absolute inset-0 grid place-items-center">
        <div className="w-64 text-center">
          <Clapperboard className="mx-auto h-6 w-6 text-wine-700 dark:text-gilt-400" strokeWidth={1.4} />
          <p className="mt-3 font-display text-lg italic">{stage || "Warming up the darkroom"}…</p>
          <div className="mx-auto mt-3 h-px w-full bg-ink/10 dark:bg-paper/10">
            <motion.div
              className="h-full bg-wine-700 dark:bg-gilt-400"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45 dark:text-paper/40">
            Plate developing · {progress}%
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Empty state ---------------------------------- */

function EmptyState() {
  const patchForm = useStudioStore((s) => s.patchForm);
  const { generate } = useGenerate();

  const start = (starter: (typeof SCENE_STARTERS)[number]) => {
    patchForm({ ...starter.form });
    void generate({ count: 1, overrides: starter.form });
  };

  return (
    <div className="grid min-h-[420px] place-items-center border border-dashed border-ink/20 px-6 py-14 dark:border-paper/20">
      <div className="w-full max-w-xl text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-wine-700 dark:text-gilt-400">The lightbox is empty</p>
        <h2 className="font-display wonk mt-3 text-4xl font-light italic leading-tight sm:text-5xl">
          The set is quiet.
          <br />
          <span className="font-semibold not-italic">Call action.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink/60 dark:text-paper/55">
          Cast a muse, scout a setting and strike the shutter — or open with one of the house looks below.
        </p>

        <div className="mt-8 border-t border-ink/15 text-left dark:border-paper/15">
          {SCENE_STARTERS.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.09 }}
              onClick={() => start(s)}
              className="group flex w-full items-center gap-4 border-b border-ink/15 px-3 py-4 text-left transition-colors hover:bg-ink/[0.04] dark:border-paper/15 dark:hover:bg-paper/[0.05]"
            >
              <span className="font-display wonk w-12 shrink-0 text-xl italic text-gilt-600 dark:text-gilt-400">{s.no}</span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-lg font-semibold leading-tight group-hover:text-wine-700 dark:group-hover:text-gilt-300">
                  {s.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink/55 dark:text-paper/50">{s.note}</span>
              </span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-ink/30 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-wine-700 dark:text-paper/30 dark:group-hover:text-gilt-300" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Plate view ----------------------------------- */

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-sm border border-ink/20 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/70 transition-all hover:-translate-y-px hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-500 dark:border-paper/20 dark:text-paper/65 dark:hover:border-gilt-400 dark:hover:text-gilt-300"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function PlateView({ gen }: { gen: Generation }) {
  const baseId = useStudioStore((s) => s.baseId);
  const toggleBase = useStudioStore((s) => s.toggleBase);
  const duplicateAsUpscale = useStudioStore((s) => s.duplicateAsUpscale);
  const toast = useUIStore((s) => s.toast);
  const openQuickAction = useUIStore((s) => s.openQuickAction);
  const { generate } = useGenerate();
  const [imgLoaded, setImgLoaded] = useState(false);

  const isBase = baseId === gen.id;

  return (
    <motion.div
      key={gen.id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* The plate */}
      <div className="group/plate relative overflow-hidden border border-ink/15 bg-ink/5 dark:border-paper/15 dark:bg-paper/5" style={ratioStyle(gen.ratio)}>
        {!imgLoaded && <div className="absolute inset-0 skeleton-sheen" aria-hidden />}
        <img
          src={gen.url}
          alt={gen.prompt.slice(0, 120)}
          onLoad={() => setImgLoaded(true)}
          className={cn("h-full w-full object-cover transition-all duration-700", imgLoaded ? "opacity-100" : "opacity-0")}
          style={{ filter: gen.filter && gen.filter !== "none" ? gen.filter : undefined, objectPosition: gen.focus ?? "50% 40%" }}
        />
        {/* Corner marks like a contact sheet */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-paper/90 mix-blend-difference">
          Plate · seed {gen.seed}
        </div>
        {gen.upscaled ? (
          <div className="absolute right-2.5 top-2.5 rounded-sm bg-gilt-500 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink">
            4K
          </div>
        ) : null}
        {gen.tag ? (
          <div className="absolute bottom-2.5 left-2.5 rounded-sm bg-ink/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper backdrop-blur-sm">
            {gen.tag}
          </div>
        ) : null}
        {isBase ? (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-sm bg-wine-700 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wine-50">
            <Lock className="h-2.5 w-2.5" /> Base plate
          </div>
        ) : null}
      </div>

      {/* Meta + downloads */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50 dark:text-paper/45">
          {engineLabel(gen.engine)} · {gen.ratio} · {timeAgo(gen.createdAt)}
          {gen.baseId ? " · from locked plate" : ""}
        </p>
        <button
          onClick={() => {
            void copyText(gen.prompt).then((ok) => ok && toast("Prompt copied", { tone: "success" }));
          }}
          aria-label="Copy prompt"
          className="grid h-9 w-9 place-items-center rounded-sm border border-ink/20 text-ink/70 transition-colors hover:border-ink hover:bg-ink hover:text-paper dark:border-paper/20 dark:text-paper/70 dark:hover:border-paper dark:hover:bg-paper dark:hover:text-ink"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            void downloadImage(gen.url, `editorialai-${gen.seed}.png`);
            toast("Plate downloading", { description: `editorialai-${gen.seed}.png`, tone: "success" });
          }}
          aria-label="Download PNG"
          className="grid h-9 w-9 place-items-center rounded-sm border border-ink/20 text-ink/70 transition-colors hover:border-ink hover:bg-ink hover:text-paper dark:border-paper/20 dark:text-paper/70 dark:hover:border-paper dark:hover:bg-paper dark:hover:text-ink"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            void downloadImage(gen.url, `editorialai-${gen.seed}-hires.png`);
            toast("High-res plate downloading", { description: "Full-resolution master file.", tone: "success" });
          }}
          className="flex h-9 items-center gap-1.5 rounded-sm bg-ink px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper transition-colors hover:bg-wine-800 dark:bg-paper dark:text-ink dark:hover:bg-gilt-300"
        >
          <ArrowUpToLine className="h-3.5 w-3.5" /> High-res
        </button>
        <button
          onClick={() => {
            toggleBase(gen.id);
            toast(isBase ? "Reference unlocked" : "Reference plate locked", {
              description: isBase ? undefined : "New generations will continue from this plate.",
              tone: isBase ? "info" : "success",
            });
          }}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-sm border px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
            isBase
              ? "border-wine-700 bg-wine-700 text-wine-50 dark:border-gilt-500 dark:bg-gilt-500 dark:text-ink"
              : "border-ink/20 text-ink/70 hover:border-wine-700 hover:text-wine-700 dark:border-paper/20 dark:text-paper/70 dark:hover:border-gilt-400 dark:hover:text-gilt-300"
          )}
        >
          {isBase ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {isBase ? "Unset base" : "Use as base"}
        </button>
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <QuickActionButton icon={UserRound} label="Pose" onClick={() => openQuickAction("pose", gen.id)} />
        <QuickActionButton icon={Shirt} label="Outfit" onClick={() => openQuickAction("outfit", gen.id)} />
        <QuickActionButton icon={MapPin} label="Location" onClick={() => openQuickAction("location", gen.id)} />
        <QuickActionButton icon={SmilePlus} label="Expression" onClick={() => openQuickAction("expression", gen.id)} />
        <QuickActionButton
          icon={RefreshCw}
          label="Regenerate"
          onClick={() => void generate({ settings: gen.settings, count: 1 })}
        />
        <QuickActionButton
          icon={ArrowUpToLine}
          label="Upscale"
          onClick={() => {
            if (gen.upscaled) {
              toast("Already at master resolution", { tone: "info" });
              return;
            }
            duplicateAsUpscale(gen.id);
            toast("Upscaled to 4K", { description: "A master-resolution plate was added to the lightbox.", tone: "success" });
          }}
        />
        <QuickActionButton
          icon={Shuffle}
          label="Vary subtly"
          onClick={() => void generate({ settings: gen.settings, sourceSeed: gen.seed, strength: "subtle", count: 1 })}
        />
        <QuickActionButton
          icon={Sparkles}
          label="Vary strongly"
          onClick={() => void generate({ settings: gen.settings, sourceSeed: gen.seed, strength: "strong", count: 1 })}
        />
      </div>

      {/* Full prompt */}
      <details className="group mt-3 rounded-sm border border-ink/10 dark:border-paper/10">
        <summary className="cursor-pointer select-none px-3.5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50 transition-colors hover:text-ink dark:text-paper/45 dark:hover:text-paper">
          Full prompt ↓
        </summary>
        <p className="border-t border-ink/10 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-ink/70 dark:border-paper/10 dark:text-paper/65">
          {gen.prompt}
          {gen.negative ? (
            <span className="mt-2 block text-wine-700 dark:text-wine-300">Avoid — {gen.negative}</span>
          ) : null}
        </p>
      </details>
    </motion.div>
  );
}

/* --------------------------------- Thumbnail rail --------------------------------- */

function ThumbRail() {
  const generations = useStudioStore((s) => s.generations);
  const activeId = useStudioStore((s) => s.activeId);
  const setActive = useStudioStore((s) => s.setActive);
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  const removeGeneration = useStudioStore((s) => s.removeGeneration);
  const compareIds = useUIStore((s) => s.compareIds);
  const toggleCompareId = useUIStore((s) => s.toggleCompareId);
  const toast = useUIStore((s) => s.toast);

  if (!generations.length) return null;

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold italic">Session contact sheet</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40 dark:text-paper/35">
          {generations.length} plate{generations.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2">
        {generations.slice(0, 30).map((g) => {
          const active = g.id === activeId;
          const inCompare = compareIds.includes(g.id);
          return (
            <div key={g.id} className="group relative w-24 shrink-0 sm:w-28">
              <button
                onClick={() => setActive(g.id)}
                aria-label={`Open plate seed ${g.seed}`}
                className={cn(
                  "block w-full overflow-hidden border transition-all duration-200",
                  active
                    ? "border-wine-700 ring-1 ring-wine-700 dark:border-gilt-400 dark:ring-gilt-400"
                    : "border-ink/15 opacity-75 hover:-translate-y-0.5 hover:opacity-100 dark:border-paper/15"
                )}
              >
                <div className="aspect-[4/5] w-full bg-ink/5 dark:bg-paper/5">
                  <img
                    src={g.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    style={{ filter: g.filter && g.filter !== "none" ? g.filter : undefined, objectPosition: g.focus ?? "50% 40%" }}
                  />
                </div>
              </button>
              {g.favorite ? (
                <span className="pointer-events-none absolute left-1 top-1 text-gilt-500">
                  <Heart className="h-3 w-3 fill-current" />
                </span>
              ) : null}
              {inCompare ? (
                <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-wine-700 font-mono text-[8px] font-bold text-wine-50 dark:bg-gilt-500 dark:text-ink">
                  {compareIds.indexOf(g.id) + 1}
                </span>
              ) : null}
              {/* Hover actions */}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleFavorite(g.id)}
                    aria-label={g.favorite ? "Remove from favorites" : "Add to favorites"}
                    className="grid h-6 w-6 place-items-center rounded-sm bg-ink/70 text-paper backdrop-blur-sm transition-colors hover:bg-gilt-500 hover:text-ink"
                  >
                    <Heart className={cn("h-3 w-3", g.favorite && "fill-current text-gilt-400")} />
                  </button>
                  <button
                    onClick={() => {
                      removeGeneration(g.id);
                      toast("Plate discarded", { tone: "info" });
                    }}
                    aria-label="Delete plate"
                    className="grid h-6 w-6 place-items-center rounded-sm bg-ink/70 text-paper backdrop-blur-sm transition-colors hover:bg-wine-700"
                  >
                    <X16 />
                  </button>
                </div>
                <button
                  onClick={() => {
                    toggleCompareId(g.id);
                    if (!inCompare && compareIds.length === 0)
                      toast("Comparison started", { description: "Pick one more plate to compare side-by-side.", tone: "info" });
                  }}
                  aria-label="Add to comparison"
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-sm backdrop-blur-sm transition-colors",
                    inCompare ? "bg-wine-700 text-wine-50 dark:bg-gilt-500 dark:text-ink" : "bg-ink/70 text-paper hover:bg-wine-700 dark:hover:bg-gilt-500 dark:hover:text-ink"
                  )}
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function X16() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------ Results ------------------------------------- */

export function ResultsPanel() {
  const generations = useStudioStore((s) => s.generations);
  const activeId = useStudioStore((s) => s.activeId);
  const generating = useStudioStore((s) => s.generating);
  const compareIds = useUIStore((s) => s.compareIds);
  const clearCompare = useUIStore((s) => s.clearCompare);
  const setCompareOpen = useUIStore((s) => s.setCompareOpen);
  const toast = useUIStore((s) => s.toast);

  const active = generations.find((g) => g.id === activeId) ?? generations[0] ?? null;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-wine-700 dark:text-gilt-400">02 — Output</p>
            <h2 className="font-display wonk text-2xl font-semibold italic leading-none sm:text-3xl">The Lightbox</h2>
          </div>
          {compareIds.length > 0 && compareIds.length < 2 && (
            <button
              onClick={clearCompare}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50 underline-offset-4 hover:underline dark:text-paper/50"
            >
              Pick 1 more · cancel
            </button>
          )}
          {compareIds.length === 2 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setCompareOpen(true)}
              className="flex items-center gap-2 rounded-sm bg-ink px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper transition-colors hover:bg-wine-800 dark:bg-paper dark:text-ink dark:hover:bg-gilt-300"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Open comparison
            </motion.button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {generating ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DarkroomLoading />
              {active ? <div className="mt-6 opacity-40"><PlateView gen={active} /></div> : null}
            </motion.div>
          ) : active ? (
            <PlateView key={active.id} gen={active} />
          ) : (
            <EmptyState key="empty" />
          )}
        </AnimatePresence>

        {!generating && <ThumbRail />}
      </div>
    </div>
  );
}
