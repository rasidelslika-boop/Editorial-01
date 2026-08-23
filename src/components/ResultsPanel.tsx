import { AnimatePresence, motion } from "framer-motion";
import {
  Aperture,
  Archive,
  ArrowDownToLine,
  ArrowUpRight,
  Clapperboard,
  Copy,
  Download,
  ImageDown,
  Loader2,
  Lock,
  MapPin,
  Move,
  RefreshCw,
  Shirt,
  Smile,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useGenerate } from "../hooks/useGenerate";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { promptSummary } from "../lib/promptBuilder";
import { SCENE_STARTERS } from "../lib/presets";
import {
  applyGrade,
  buildZipArchive,
  cn,
  copyText,
  extFor,
  fetchBlob,
  highResUrl,
  openDeliveryPopup,
  populateDeliveryPopup,
  triggerDownload,
  type ArchiveResult,
} from "../lib/utils";
import type { Generation } from "../types";
import { Button } from "./ui";

const QUICK_ACTIONS: {
  key: "pose" | "outfit" | "location" | "expression";
  label: string;
  icon: typeof Move;
}[] = [
  { key: "pose", label: "Pose", icon: Move },
  { key: "outfit", label: "Outfit", icon: Shirt },
  { key: "location", label: "Location", icon: MapPin },
  { key: "expression", label: "Expression", icon: Smile },
];

const RATIO_BOX: Record<string, string> = {
  "1:1": "aspect-square w-8",
  "5:4": "aspect-[5/4] w-9",
  "4:3": "aspect-[4/3] w-10",
  "3:2": "aspect-[3/2] w-11",
  "4:5": "aspect-[4/5] w-7",
  "3:4": "aspect-[3/4] w-7",
  "2:3": "aspect-[2/3] w-6",
  "16:9": "aspect-video w-10",
  "9:16": "aspect-[9/16] w-5",
  "21:9": "aspect-[21/9] w-12",
};

const RATIO_WRAP: Record<string, string> = {
  "1:1": "aspect-square w-full max-w-[540px]",
  "5:4": "aspect-[5/4] w-full max-w-[560px]",
  "4:3": "aspect-[4/3] w-full max-w-[600px]",
  "3:2": "aspect-[3/2] w-full max-w-[640px]",
  "4:5": "aspect-[4/5] w-full max-w-[470px]",
  "3:4": "aspect-[3/4] w-full max-w-[480px]",
  "2:3": "aspect-[2/3] w-full max-w-[430px]",
  "16:9": "aspect-video w-full max-w-[680px]",
  "9:16": "aspect-[9/16] w-full max-w-[330px]",
  "21:9": "aspect-[21/9] w-full max-w-[720px]",
};

function ActionBtn({
  onClick,
  disabled,
  label,
  children,
  accent,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-150",
        "hover:-translate-y-px disabled:pointer-events-none disabled:opacity-35",
        accent
          ? "border-gilt-500/70 bg-gilt-500/10 text-gilt-600 hover:bg-gilt-500/25 dark:text-gilt-300"
          : "border-ink/15 text-ink/70 hover:border-ink/50 hover:text-ink dark:border-paper/15 dark:text-paper/65 dark:hover:border-paper/50 dark:hover:text-paper"
      )}
    >
      {children}
    </button>
  );
}

export function ResultsPanel() {
  const generations = useStudioStore((s) => s.generations);
  const activeId = useStudioStore((s) => s.activeId);
  const baseId = useStudioStore((s) => s.baseId);
  const setActive = useStudioStore((s) => s.setActive);
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  const removeGeneration = useStudioStore((s) => s.removeGeneration);
  const toggleBase = useStudioStore((s) => s.toggleBase);
  const patchForm = useStudioStore((s) => s.patchForm);
  const form = useStudioStore((s) => s.form);
  const generating = useStudioStore((s) => s.generating);
  const clearArchive = useStudioStore((s) => s.clearArchive);

  const { generate, progress, stage } = useGenerate();
  const toast = useUIStore((s) => s.toast);
  const openQuickAction = useUIStore((s) => s.openQuickAction);
  const toggleCompareId = useUIStore((s) => s.toggleCompareId);
  const compareIds = useUIStore((s) => s.compareIds);
  const [showPrompt, setShowPrompt] = useState(false);
  const [packing, setPacking] = useState(false);
  const [packStep, setPackStep] = useState<{ done: number; total: number } | null>(null);
  const [archive, setArchive] = useState<ArchiveResult | null>(null);
  const [clearArm, setClearArm] = useState(false);

  /** Two-step clear — first click arms, second click wipes the contact sheet. */
  const handleClear = () => {
    if (!clearArm) {
      setClearArm(true);
      setTimeout(() => setClearArm(false), 2600);
      return;
    }
    clearArchive();
    setClearArm(false);
    toast("Contact sheet cleared", { description: "Every plate from this session has been discarded.", tone: "info" });
  };

  /**
   * Save the active plate. A delivery popup is opened synchronously inside the
   * click gesture, then the graded bytes are written straight into it as a
   * base64 data URI — no messaging, no origin coupling. The popup is a real
   * top-level tab, so its anchor download lands in the Downloads folder.
   */
  const savePlate = (kind: "png" | "hq") => {
    if (!gen) return;
    const target = kind === "hq" ? highResUrl(gen.url) ?? gen.url : gen.url;
    const baseName = `editorial-plate-${gen.seed}${kind === "hq" ? "-hires" : ""}`;
    const getBlob = async () => {
      const blob = await fetchBlob(target);
      return blob ? await applyGrade(blob, gen.filter) : null;
    };

    const tab = openDeliveryPopup(); // synchronous — gesture preserved
    if (tab) {
      toast(kind === "hq" ? "Preparing high-res plate" : "Preparing plate", {
        description: "A delivery tab opened — the save happens there.",
        tone: "info",
      });
      void populateDeliveryPopup(tab, getBlob, "image", baseName).then((ok) => {
        if (ok) toast("Plate delivered", { description: "Check the delivery tab — your file is on its way.", tone: "success" });
        else toast("Download failed", { description: "The plate couldn't be fetched — it may have expired.", tone: "error" });
      });
      return;
    }

    // Popups refused — in-page fallback.
    void (async () => {
      const graded = await getBlob();
      if (graded && triggerDownload(graded, `${baseName}.${extFor(graded)}`)) {
        toast("Plate saved", { description: `${baseName} is in your downloads.`, tone: "success" });
      } else {
        toast("Download failed", { description: "The browser refused every save route.", tone: "error" });
      }
    })();
  };

  /** One click — every plate in the contact sheet, zipped and delivered. */
  const archiveSession = () => {
    if (packing || !generations.length) return;
    const items = generations.map((g, i) => ({
      url: g.url,
      name: `plate-${String(generations.length - i).padStart(2, "0")}-seed-${g.seed}`,
      filter: g.filter,
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `editorial-ai-session-${stamp}`;

    setPacking(true);
    setPackStep({ done: 0, total: generations.length });
    toast("Packing the session", {
      description: `Archiving ${generations.length} plate${generations.length === 1 ? "" : "s"}…`,
      tone: "info",
    });

    const getBlob = async () => {
      const result = await buildZipArchive(items, (done, total) => setPackStep({ done, total }));
      if (result) setArchive(result);
      return result?.blob ?? null;
    };

    const tab = openDeliveryPopup(); // synchronous — gesture preserved
    if (tab) {
      void populateDeliveryPopup(tab, getBlob, "zip", baseName)
        .then((ok) => {
          if (ok) toast("Archive delivered", { description: "The delivery tab is saving your ZIP now.", tone: "success" });
          else
            toast("Archive failed", {
              description: "No plates could be fetched — DashScope URLs expire after 24h.",
              tone: "error",
            });
        })
        .finally(() => {
          setPacking(false);
          setPackStep(null);
        });
      return;
    }

    // Popup was blocked — build in-page and offer the ready-bar's Save ZIP.
    void getBlob()
      .then((blob) => {
        if (blob) toast("Archive ready", { description: "Tap Save ZIP below to download it.", tone: "info" });
        else toast("Archive failed", { description: "No plates could be fetched.", tone: "error" });
      })
      .finally(() => {
        setPacking(false);
        setPackStep(null);
      });
  };

  /** Save from the ready-bar — the blob is already in memory, so this is instant. */
  const saveZipNow = () => {
    if (!archive) return;
    const tab = openDeliveryPopup();
    if (tab) {
      void populateDeliveryPopup(tab, async () => archive.blob, "zip", archive.filename.replace(/\.zip$/, "")).then((ok) => {
        if (ok) {
          toast("Archive delivered", { description: `${archive.saved} plate${archive.saved === 1 ? "" : "s"} — check the delivery tab.`, tone: "success" });
          setArchive(null);
        } else {
          toast("Save failed", { description: "The delivery tab couldn't write the file.", tone: "error" });
        }
      });
      return;
    }
    // No popups allowed — fall back to a gesture-fresh anchor click.
    if (triggerDownload(archive.blob, archive.filename)) {
      toast("Archive download started", {
        description: `${archive.saved} plate${archive.saved === 1 ? "" : "s"} — check your downloads folder.`,
        tone: "success",
      });
      setArchive(null);
    } else {
      toast("Save failed", { description: "The browser refused the download entirely.", tone: "error" });
    }
  };

  const dismissArchive = () => setArchive(null);

  const gen = generations.find((g) => g.id === activeId) ?? generations[0] ?? null;

  const applyStarter = (starterId: string) => {
    const st = SCENE_STARTERS.find((s) => s.id === starterId);
    if (!st) return;
    patchForm({ ...st.form });
    toast(`${st.label} loaded`, { description: "Direction set — develop the plate when ready.", tone: "success" });
  };

  const run = (label: string, fn: () => Promise<unknown>) => {
    if (generating) {
      toast("Darkroom busy", { description: "A shoot is already in progress.", tone: "error" });
      return;
    }
    toast(label, { description: "New plate is developing…", tone: "info" });
    void fn();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Panel head */}
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-paper/10 sm:px-7">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-wine-700 dark:text-gilt-400">The Lightbox</p>
          <h2 className="font-display text-lg font-semibold italic leading-tight">Developed plates</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              generating ? "animate-pulse-dot bg-wine-600 dark:bg-gilt-400" : generations.length ? "bg-gilt-500" : "bg-ink/20 dark:bg-paper/20"
            )}
            aria-hidden
          />
          <span className="font-mono text-[11px] text-ink/50 dark:text-paper/45">
            {generations.length} plate{generations.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 dark:bg-paper/[0.015] sm:px-7">
        <AnimatePresence mode="wait">
          {/* ------------------------------- Empty state ------------------------------- */}
          {!gen && !generating && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex h-full flex-col items-center justify-center py-10 text-center"
            >
              <span className="relative grid h-20 w-20 place-items-center rounded-full border border-dashed border-ink/25 dark:border-paper/25">
                <Aperture className="h-8 w-8 text-ink/35 dark:text-paper/35" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-wine-700 dark:bg-gilt-500" aria-hidden />
              </span>
              <h3 className="mt-6 font-display wonk text-3xl font-semibold italic">The lightbox is empty</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/55 dark:text-paper/50">
                Direction lives on the left. Set your muse and setting, then develop your first plate — or open with a scene:
              </p>
              <div className="mt-7 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
                {SCENE_STARTERS.map((st, i) => (
                  <motion.button
                    key={st.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    onClick={() => applyStarter(st.id)}
                    className="group flex-1 border border-ink/15 px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-wine-700 hover:shadow-[0_10px_30px_-14px_rgba(116,32,51,0.45)] dark:border-paper/15 dark:hover:border-gilt-400"
                  >
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-wine-700 dark:text-gilt-400">{st.no}</p>
                    <p className="mt-1 font-display text-base font-semibold italic leading-snug">{st.label}</p>
                    <p className="mt-1 text-xs leading-snug text-ink/50 dark:text-paper/45">{st.note}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ------------------------------- Loading state ------------------------------ */}
          {generating && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center py-10"
            >
              <div className="relative w-full max-w-[440px]">
                <div className="skeleton-sheen relative aspect-[4/5] w-full overflow-hidden border border-ink/15 dark:border-paper/15">
                  <div className="absolute left-0 h-px w-full bg-gradient-to-r from-transparent via-gilt-400/80 to-transparent animate-scan" aria-hidden />
                  <span className="absolute left-4 top-3.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40 dark:text-paper/40">
                    EditorialAI · darkroom
                  </span>
                  <span className="absolute bottom-3.5 right-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40 dark:text-paper/40">
                    plate № {generations.length + 1}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="font-display wonk text-2xl italic tabular-nums text-wine-700 dark:text-gilt-400">
                    {String(Math.round(progress)).padStart(2, "0")}
                  </span>
                  <div className="h-px flex-1 bg-ink/10 dark:bg-paper/10">
                    <div
                      className="h-px bg-wine-700 transition-all duration-500 dark:bg-gilt-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-ink/50 dark:text-paper/45">{stage}</span>
                </div>
                <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/35 dark:text-paper/30">
                  Live render — a plate can take up to a minute
                </p>
              </div>
            </motion.div>
          )}

          {/* -------------------------------- Active plate ------------------------------ */}
          {gen && !generating && (
            <motion.div
              key={gen.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45 dark:text-paper/40">
                    Plate №{gen.seed} · {gen.ratio} · {gen.tag ?? "standard render"}
                    {gen.baseId ? " · from locked reference" : ""}
                  </p>
                  <h3 className="mt-1 max-w-xl font-display text-xl font-semibold italic leading-snug">
                    {promptSummary(gen.prompt, 72)}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <ActionBtn
                    label={gen.favorite ? "Remove from favorites" : "Add to favorites"}
                    onClick={() => {
                      toggleFavorite(gen.id);
                      toast(gen.favorite ? "Removed from favorites" : "Pinned to favorites", { tone: "success" });
                    }}
                    accent={!!gen.favorite}
                  >
                    <Star className={cn("h-3.5 w-3.5", gen.favorite && "fill-current")} />
                  </ActionBtn>
                  <ActionBtn
                    label="Open full plate"
                    onClick={() => window.open(gen.url, "_blank", "noopener")}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </ActionBtn>
                  <ActionBtn
                    label="Delete plate"
                    onClick={() => {
                      removeGeneration(gen.id);
                      toast("Plate discarded", { tone: "info" });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ActionBtn>
                </div>
              </div>

              {/* Frame */}
              <div className="mt-4 flex justify-center">
                <div className={cn("relative", RATIO_WRAP[gen.ratio] ?? "aspect-[4/5] w-full max-w-[470px]")}>
                  <motion.img
                    key={gen.id}
                    src={gen.url}
                    alt={`Editorial plate, seed ${gen.seed}`}
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="h-full w-full border border-ink/20 object-cover shadow-[0_24px_60px_-24px_rgba(18,17,20,0.55)] dark:border-paper/20"
                    style={{
                      filter: gen.filter && gen.filter !== "none" ? gen.filter : undefined,
                      objectPosition:
                        gen.focus === "top"
                          ? "50% 12%"
                          : gen.focus === "bottom"
                            ? "50% 88%"
                            : gen.focus?.includes("close")
                              ? "50% 20%"
                              : "center",
                      transform: gen.standIn ? `scale(${1 + (gen.seed % 7) * 0.014})` : undefined,
                    }}
                  />
                  <span className="absolute left-3 top-3 rounded-sm bg-ink/65 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-paper backdrop-blur-sm">
                    Plate №{gen.seed}
                  </span>
                  {baseId === gen.id && (
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-sm bg-gilt-500/90 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                      <Lock className="h-3 w-3" /> Base
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 rounded-sm bg-ink/65 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/90 backdrop-blur-sm">
                    {gen.ratio}
                  </span>
                </div>
              </div>

              {/* Prompt strip */}
              <div className="mx-auto mt-4 max-w-3xl">
                <div className="flex items-center gap-2 border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 dark:border-paper/12 dark:bg-paper/[0.04]">
                  <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink/60 dark:text-paper/55">{gen.prompt}</p>
                  <button
                    onClick={() => setShowPrompt((v) => !v)}
                    className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-wine-700 hover:underline dark:text-gilt-400"
                  >
                    {showPrompt ? "Less" : "Full"}
                  </button>
                  <button
                    aria-label="Copy prompt"
                    onClick={async () => {
                      if (await copyText(gen.prompt)) toast("Prompt copied", { tone: "success" });
                    }}
                    className="shrink-0 text-ink/50 transition-colors hover:text-ink dark:text-paper/50 dark:hover:text-paper"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <AnimatePresence>
                  {showPrompt && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-x border-b border-ink/12 bg-ink/[0.03] dark:border-paper/12 dark:bg-paper/[0.04]"
                    >
                      <p className="px-3.5 py-3 font-mono text-[11px] leading-relaxed text-ink/75 dark:text-paper/70">{gen.prompt}</p>
                      {gen.negative ? (
                        <p className="border-t border-ink/10 px-3.5 py-2 font-mono text-[10px] text-wine-700/80 dark:border-paper/10 dark:text-wine-300/80">
                          Avoid — {gen.negative}
                        </p>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Quick actions */}
              <div className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2">
                {QUICK_ACTIONS.map((qa) => (
                  <ActionBtn key={qa.key} label={`Change ${qa.label.toLowerCase()}`} onClick={() => openQuickAction(qa.key, gen.id)}>
                    <qa.icon className="h-3.5 w-3.5" />
                    {qa.label} ↻
                  </ActionBtn>
                ))}
                <span className="mx-1 hidden h-5 w-px bg-ink/15 dark:bg-paper/15 sm:block" aria-hidden />
                <ActionBtn
                  label="Regenerate the same prompt"
                  onClick={() =>
                    run("Reshooting the same brief", () =>
                      generate({ settings: gen.settings, prompt: gen.prompt, count: 1 })
                    )
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </ActionBtn>
                <ActionBtn
                  label="Upscale to a high-res render"
                  disabled={!!gen.upscaled}
                  onClick={() =>
                    run("Upscaling to high-res", () =>
                      generate({ settings: gen.settings, prompt: gen.prompt, count: 1, seed: gen.seed, quality: "hq" })
                    )
                  }
                >
                  <ImageDown className="h-3.5 w-3.5" /> Upscale
                </ActionBtn>
                <ActionBtn
                  label="Vary subtly — new take on the same brief"
                  onClick={() =>
                    run("Varying subtly", () => generate({ settings: gen.settings, prompt: gen.prompt, count: 1 }))
                  }
                >
                  <Sparkles className="h-3.5 w-3.5" /> Vary · Subtle
                </ActionBtn>
                <ActionBtn
                  label="Vary strongly — bold reinterpretation"
                  onClick={() =>
                    run("Varying strongly", () =>
                      generate({
                        settings: gen.settings,
                        prompt: `${gen.prompt}, bold reinterpretation, alternate composition, unexpected styling`,
                        count: 1,
                      })
                    )
                  }
                >
                  <Clapperboard className="h-3.5 w-3.5" /> Vary · Strong
                </ActionBtn>
              </div>

              {/* Utility row */}
              <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2">
                <Button variant="dark" size="sm" onClick={() => void savePlate("png")}>
                  <Download className="h-3.5 w-3.5" /> PNG
                </Button>
                <Button variant="outline" size="sm" onClick={() => void savePlate("hq")}>
                  <ArrowDownToLine className="h-3.5 w-3.5" /> High-res
                </Button>
                <Button
                  variant={baseId === gen.id ? "accent" : "outline"}
                  size="sm"
                  onClick={() => {
                    toggleBase(gen.id);
                    toast(baseId === gen.id ? "Reference unlocked" : "Locked as reference", {
                      description:
                        baseId === gen.id
                          ? "New shoots start from a clean slate."
                          : "Variations and reshoots now continue from this plate.",
                      tone: "success",
                    });
                  }}
                >
                  <Lock className="h-3.5 w-3.5" /> {baseId === gen.id ? "Unlock Base" : "Use as Base"}
                </Button>
                <Button
                  variant={compareIds.includes(gen.id) ? "accent" : "ghost"}
                  size="sm"
                  onClick={() => {
                    toggleCompareId(gen.id);
                    if (!compareIds.includes(gen.id))
                      toast("Marked for comparison", { description: "Pick one more plate to open the side-by-side view." });
                  }}
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full border border-current font-mono text-[9px]">
                    {compareIds.indexOf(gen.id) === 0 ? "A" : compareIds.includes(gen.id) ? "B" : "⇄"}
                  </span>
                  Compare
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Contact sheet */}
      {generations.length > 0 && (
        <div className="border-t border-ink/10 px-5 py-3 dark:border-paper/10 sm:px-7">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40 dark:text-paper/35">
              Contact sheet · {generations.length} plate{generations.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-1.5">
            <button
              onClick={handleClear}
              aria-label={clearArm ? "Confirm — clear every plate" : "Clear the contact sheet"}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-all duration-150",
                "hover:-translate-y-px",
                clearArm
                  ? "border-wine-600 bg-wine-600/10 text-wine-600 dark:border-wine-400 dark:text-wine-300"
                  : "border-ink/20 text-ink/65 hover:border-wine-700 hover:text-wine-700 dark:border-paper/20 dark:text-paper/60 dark:hover:border-wine-400 dark:hover:text-wine-300"
              )}
            >
              <Trash2 className="h-3 w-3" />
              {clearArm ? "Sure?" : "Clear"}
            </button>
            <button
              onClick={() => void archiveSession()}
              disabled={packing}
              aria-label="Download every plate in this session as a ZIP archive"
              className={cn(
                "group flex h-7 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-all duration-150",
                "hover:-translate-y-px disabled:pointer-events-none",
                packing
                  ? "border-gilt-500/60 bg-gilt-500/10 text-gilt-600 dark:text-gilt-300"
                  : "border-ink/20 text-ink/65 hover:border-gilt-500 hover:text-gilt-600 dark:border-paper/20 dark:text-paper/60 dark:hover:border-gilt-400 dark:hover:text-gilt-300"
              )}
            >
              {packing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
              {packing ? (packStep ? `Packing ${packStep.done}/${packStep.total}` : "Packing…") : "Archive ZIP"}
            </button>
            </div>
          </div>

          {/* Archive ready — Save ZIP runs inside a fresh click gesture. */}
          <AnimatePresence>
            {archive && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="mb-2.5 flex items-center gap-3 border border-gilt-500/50 bg-gilt-500/10 px-3 py-2"
              >
                <Archive className="h-4 w-4 shrink-0 text-gilt-600 dark:text-gilt-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] font-bold">{archive.filename}</p>
                  <p className="font-mono text-[10px] text-ink/50 dark:text-paper/45">
                    {archive.saved} plate{archive.saved === 1 ? "" : "s"} packed
                    {archive.failed ? ` · ${archive.failed} skipped` : ""} · ready to save
                  </p>
                </div>
                <button
                  onClick={() => void saveZipNow()}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm bg-ink px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper transition-transform duration-150 hover:-translate-y-px dark:bg-paper dark:text-ink"
                >
                  <Download className="h-3 w-3" /> Save ZIP
                </button>
                <button
                  onClick={dismissArchive}
                  aria-label="Dismiss archive"
                  className="shrink-0 text-ink/40 transition-colors hover:text-ink dark:text-paper/40 dark:hover:text-paper"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
            {generations.map((g) => (
              <Thumb
                key={g.id}
                gen={g}
                active={gen?.id === g.id}
                isBase={baseId === g.id}
                inCompare={compareIds.includes(g.id)}
                onOpen={() => setActive(g.id)}
                onFavorite={() => toggleFavorite(g.id)}
                onCompare={() => toggleCompareId(g.id)}
                onDelete={() => removeGeneration(g.id)}
              />
            ))}
            {generating && (
              <div className="skeleton-sheen aspect-[4/5] w-16 shrink-0 border border-ink/15 dark:border-paper/15 sm:w-20" aria-label="Developing new plate" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Thumb({
  gen,
  active,
  isBase,
  inCompare,
  onOpen,
  onFavorite,
  onCompare,
  onDelete,
}: {
  gen: Generation;
  active: boolean;
  isBase: boolean;
  inCompare: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onCompare: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative w-16 shrink-0 transition-transform duration-200 hover:-translate-y-0.5 sm:w-20",
        active && "-translate-y-0.5"
      )}
    >
      <button
        onClick={onOpen}
        aria-label={`Open plate seed ${gen.seed}`}
        className={cn(
          "block w-full overflow-hidden border transition-all",
          active
            ? "border-wine-700 ring-1 ring-wine-700 dark:border-gilt-400 dark:ring-gilt-400"
            : "border-ink/15 hover:border-ink/50 dark:border-paper/15 dark:hover:border-paper/50"
        )}
      >
        <img
          src={gen.url}
          alt=""
          loading="lazy"
          className="aspect-[4/5] w-full object-cover"
          style={{ filter: gen.filter && gen.filter !== "none" ? gen.filter : undefined }}
        />
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/80 to-transparent px-1 pb-0.5 pt-3">
        <span className="font-mono text-[8px] text-paper/90">№{String(gen.seed).slice(0, 5)}</span>
        {gen.favorite && <Star className="h-2.5 w-2.5 fill-gilt-400 text-gilt-400" />}
      </div>
      {isBase && (
        <span className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-gilt-500 text-ink" title="Locked base">
          <Lock className="h-2.5 w-2.5" />
        </span>
      )}
      <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          onClick={onFavorite}
          aria-label="Toggle favorite"
          className="grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-paper hover:bg-gilt-500 hover:text-ink"
        >
          <Star className={cn("h-2.5 w-2.5", gen.favorite && "fill-current")} />
        </button>
        <button
          onClick={onCompare}
          aria-label="Mark for comparison"
          className={cn(
            "grid h-5 w-5 place-items-center rounded-full text-paper hover:bg-gilt-500 hover:text-ink",
            inCompare ? "bg-gilt-500 text-ink" : "bg-ink/70"
          )}
        >
          <span className="font-mono text-[8px] font-bold">⇄</span>
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete plate"
          className="grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-paper hover:bg-wine-600"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}


