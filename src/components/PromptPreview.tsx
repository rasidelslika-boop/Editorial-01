import { Check, Copy, Film, Lock, PenLine, Sparkles, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FORM, useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { composePrompt } from "../lib/promptBuilder";
import { rollAnalogPrompt, rollMasterpiecePrompt } from "../lib/randomizers";
import { copyText, cn } from "../lib/utils";
import { Button, Section } from "./ui";

/**
 * 07 — The Brief. Shows the constructed prompt live. Auto mode is composed
 * from the form; Free-write mode is full prompt-engineering control.
 */
export function PromptPreview() {
  const form = useStudioStore((s) => s.form);
  const patchForm = useStudioStore((s) => s.patchForm);
  const baseId = useStudioStore((s) => s.baseId);
  const toast = useUIStore((s) => s.toast);
  const [copied, setCopied] = useState(false);

  const composed = useMemo(() => composePrompt(form, { baseLocked: !!baseId }), [form, baseId]);

  // Keep the free-write buffer seeded with the latest composition when switching modes.
  useEffect(() => {
    if (form.promptMode === "custom" && !form.customPrompt.trim()) {
      patchForm({ customPrompt: composed });
    }
  }, [form.promptMode, form.customPrompt, composed, patchForm]);

  const shown = form.promptMode === "custom" && form.customPrompt.trim() ? form.customPrompt : composed;

  const copy = async () => {
    const ok = await copyText(shown);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast("Prompt copied to clipboard", { tone: "success" });
    }
  };

  /**
   * One-click full briefs. Composes a complete, self-contained prompt from
   * scratch, fully clears every previous direction option, and drops the
   * result into Free-write mode so it's what gets sent.
   */
  const runOneClick = (kind: "masterpiece" | "analog") => {
    const prompt = kind === "masterpiece" ? rollMasterpiecePrompt() : rollAnalogPrompt();
    patchForm({ ...DEFAULT_FORM, promptMode: "custom", customPrompt: prompt });
    toast(kind === "masterpiece" ? "Masterpiece brief composed" : "Analog film brief composed", {
      description: "All previous direction was cleared — the full prompt is set and ready to develop.",
      tone: "success",
    });
  };

  return (
    <Section no="07" title="The Brief" hint="Final prompt · updates live">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-sm border border-ink/20 p-0.5 dark:border-paper/20" role="tablist" aria-label="Prompt mode">
          {(["auto", "custom"] as const).map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={form.promptMode === mode}
              onClick={() => patchForm({ promptMode: mode })}
              className={cn(
                "flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                form.promptMode === mode
                  ? "bg-ink text-paper dark:bg-paper dark:text-ink"
                  : "text-ink/50 hover:text-ink dark:text-paper/50 dark:hover:text-paper"
              )}
            >
              {mode === "auto" ? <Wand2 className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
              {mode === "auto" ? "Auto-compose" : "Free-write"}
            </button>
          ))}
        </div>
        {baseId ? (
          <span className="flex items-center gap-1 rounded-sm border border-gilt-500/50 bg-gilt-500/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gilt-600 dark:text-gilt-300">
            <Lock className="h-3 w-3" /> Reference plate locked
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-ink/40 dark:text-paper/35">{shown.length} chars</span>

          {/* Analog — full real-life film brief */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => runOneClick("analog")}
            aria-label="Compose a full analog film brief and clear all direction"
            title="Clears everything and writes a complete real-life analog film brief"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-150",
              "border-[#8a6f4d]/50 text-[#8a6f4d] hover:border-[#8a6f4d] hover:bg-[#8a6f4d]/10",
              "dark:border-[#c9a06a]/50 dark:text-[#c9a06a] dark:hover:border-[#c9a06a] dark:hover:bg-[#c9a06a]/10"
            )}
          >
            <Film className="h-3.5 w-3.5" />
            Analog
          </motion.button>

          {/* Masterpiece — absolute-best-possible brief */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => runOneClick("masterpiece")}
            aria-label="Compose a masterpiece brief and clear all direction"
            title="Clears everything and writes the absolute-best-possible fashion brief"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-150",
              "border-gilt-500/60 bg-gilt-500/10 text-gilt-600 hover:border-gilt-500 hover:bg-gilt-500/20",
              "dark:border-gilt-400/60 dark:bg-gilt-400/10 dark:text-gilt-300 dark:hover:border-gilt-400 dark:hover:bg-gilt-400/20"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Masterpiece
          </motion.button>

          <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy prompt">
            {copied ? <Check className="h-3.5 w-3.5 text-wine-700 dark:text-gilt-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {form.promptMode === "auto" ? (
        <div
          aria-label="Composed prompt preview"
          className="max-h-44 overflow-y-auto rounded-sm border border-ink/15 bg-ink/[0.035] px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-ink/80 dark:border-paper/15 dark:bg-paper/[0.04] dark:text-paper/80"
        >
          {composed}
        </div>
      ) : (
        <textarea
          aria-label="Custom prompt — prompt engineering mode"
          value={form.customPrompt}
          onChange={(e) => patchForm({ customPrompt: e.target.value })}
          rows={6}
          placeholder="Take full control — write the exact prompt sent to the engine…"
          className="w-full resize-y rounded-sm border border-wine-600/40 bg-ink/[0.035] px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-ink focus:outline-none focus:ring-1 focus:ring-wine-600 dark:border-gilt-400/40 dark:bg-paper/[0.04] dark:text-paper dark:focus:ring-gilt-400"
        />
      )}
      {form.promptMode === "custom" ? (
        <button
          onClick={() => patchForm({ promptMode: "auto", customPrompt: "" })}
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-wine-700 underline-offset-4 hover:underline dark:text-gilt-400"
        >
          ← Return to auto-compose
        </button>
      ) : null}
    </Section>
  );
}
