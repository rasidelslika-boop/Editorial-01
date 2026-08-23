import { useCallback } from "react";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { resolveProvider, type ProviderImage } from "../lib/api";
import { finalPrompt } from "../lib/promptBuilder";
import { randomSeed, uid } from "../lib/utils";
import type { FormState, Generation } from "../types";

const STAGES = [
  "Casting the muse",
  "Scouting the setting",
  "Steaming the garments",
  "Metering the light",
  "Exposing the frame",
  "Developing the plate",
  "Retouching skin texture",
  "Grading the colour",
  "Mounting the print",
];

interface GenerateOptions {
  count?: number;
  settings?: FormState;
  /** Send this exact prompt instead of recomposing (regenerations, upscales). */
  prompt?: string;
  overrides?: Partial<FormState>;
  seed?: number;
  quality?: "standard" | "hq";
}

export function useGenerate() {
  const store = useStudioStore();
  const toast = useUIStore((s) => s.toast);

  const generate = useCallback(
    async (opts: GenerateOptions = {}) => {
      const s = useStudioStore.getState();
      if (s.generating) return;

      const settings: FormState = { ...s.form, ...(opts.settings ?? {}), ...(opts.overrides ?? {}) };
      const base = s.baseId ? s.generations.find((g) => g.id === s.baseId) : undefined;
      const prompt = opts.prompt?.trim() || finalPrompt(settings, { baseLocked: !!base });
      const count = Math.min(8, Math.max(1, opts.count ?? 1));
      const seed = opts.seed ?? (base && settings.lockSeed ? base.seed : settings.seed ?? randomSeed());

      s.setGenerating(true);

      // Asymptotic progress — live renders can run 15–60s, so the bar approaches
      // 92% without ever lying, while stages rotate on a slow tick.
      let tick = 0;
      const timer = window.setInterval(() => {
        tick += 1;
        const cur = useStudioStore.getState().progress;
        const next = Math.min(92, cur + (92 - cur) * 0.13 + 0.3);
        const stage = STAGES[Math.min(Math.floor(tick / 2), STAGES.length - 1)];
        useStudioStore.getState().setProgress(next, stage);
      }, 1200);

      try {
        const provider = resolveProvider(settings.engine);
        const images: ProviderImage[] = await provider.generate(
          {
            prompt,
            negative: settings.negative.trim() || undefined,
            seed,
            count,
            ratio: settings.ratio,
            engine: settings.engine,
            quality: opts.quality,
          },
          (stage, pct) => {
            const cur = useStudioStore.getState().progress;
            useStudioStore.getState().setProgress(Math.max(cur, Math.min(96, pct)), stage);
          }
        );

        const now = Date.now();
        const gens: Generation[] = images.map((img, i) => ({
          id: uid(),
          prompt,
          negative: settings.negative.trim() || undefined,
          url: img.url,
          seed: img.seed,
          settings,
          ratio: settings.ratio,
          engine: settings.engine,
          filter: img.filter,
          focus: img.focus,
          upscaled: opts.quality === "hq" ? true : undefined,
          tag: opts.quality === "hq" ? "High-res render" : img.fallback ? "Curated stand-in" : undefined,
          standIn: img.fallback || undefined,
          baseId: base?.id,
          createdAt: now + i,
        }));

        useStudioStore.getState().setProgress(100, "Mounting the print");
        await new Promise((r) => setTimeout(r, 500));
        useStudioStore.getState().addGenerations(gens);
        useStudioStore.getState().setActive(gens[0].id);
        if (settings.lockSeed && !opts.seed) useStudioStore.getState().patchForm({ seed });

        if (images.some((i) => i.fallback)) {
          toast("Curated stand-in served", {
            description:
              "The configured engine couldn't be reached from the browser, so a curated plate holds the slot. Deploy the relay worker (README) and set VITE_DASHSCOPE_RELAY to shoot with your key.",
            tone: "info",
          });
        } else {
          toast(count > 1 ? `${count} plates developed` : "Plate developed", {
            tone: "success",
            description: provider.mock ? "Rendered live by the free studio engine" : undefined,
          });
        }
        return gens;
      } catch (err) {
        toast("The shoot failed", {
          description: err instanceof Error ? err.message : "Something went wrong in the darkroom.",
          tone: "error",
        });
        // Rescue — never leave the lightbox empty. Serve a curated stand-in
        // plate while the engine issue is being sorted out.
        try {
          const { mockProvider } = await import("../lib/api");
          const rescue = await mockProvider.generate(
            {
              prompt,
              negative: settings.negative.trim() || undefined,
              seed,
              count,
              ratio: settings.ratio,
              engine: settings.engine,
              curatedOnly: true,
            },
            (stage, pct) =>
              useStudioStore.getState().setProgress(Math.max(50, Math.min(96, pct)), `Stand-in · ${stage}`)
          );
          const now = Date.now();
          const gens: Generation[] = rescue.map((img, i) => ({
            id: uid(),
            prompt,
            url: img.url,
            seed: img.seed,
            settings,
            ratio: settings.ratio,
            engine: settings.engine,
            filter: img.filter,
            focus: img.focus,
            standIn: true,
            tag: "Curated stand-in",
            createdAt: now + i,
          }));
          useStudioStore.getState().addGenerations(gens);
          useStudioStore.getState().setActive(gens[0].id);
          toast("Stand-in plate served", {
            description: "A curated plate holds the slot while the engine issue is resolved.",
            tone: "info",
          });
          return gens;
        } catch {
          return [];
        }
      } finally {
        clearInterval(timer);
        useStudioStore.getState().setGenerating(false);
      }
    },
    [toast]
  );

  return {
    generate,
    generating: store.generating,
    progress: store.progress,
    stage: store.stage,
    batchCount: store.batchCount,
  };
}
