import { useCallback, useRef } from "react";
import type { FormState, Generation } from "../types";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { providerNotice, resolveProvider } from "../lib/api";
import { finalPrompt } from "../lib/promptBuilder";
import { randomSeed, uid } from "../lib/utils";

export interface GenerateOptions {
  /** Shoot from a snapshot (e.g. a history plate) instead of the live form. */
  settings?: FormState;
  /** Focused overrides applied on top — used by the Change-X modals. */
  overrides?: Partial<FormState>;
  count?: number;
  /** Variation strength relative to a source plate's seed. */
  strength?: "subtle" | "strong";
  sourceSeed?: number;
}

/**
 * The single orchestration point for generation. Swap the provider layer in
 * lib/api and everything downstream keeps working.
 */
export function useGenerate() {
  const mockWarned = useRef(false);

  const generate = useCallback(async (opts: GenerateOptions = {}) => {
    const studio = useStudioStore.getState();
    const ui = useUIStore.getState();

    if (studio.generating) {
      ui.toast("The darkroom is busy", { description: "One shoot at a time — your plates are developing.", tone: "info" });
      return;
    }

    const fromLiveForm = !opts.settings;
    const form: FormState = { ...(opts.settings ?? studio.form), ...(opts.overrides ?? {}) };

    // Seed logic: locked → fixed, variation → derived, otherwise → random.
    let seed: number;
    if (opts.strength === "subtle" && opts.sourceSeed != null) {
      // Same plate, different finish: offset by pool size (8).
      seed = (opts.sourceSeed + 8 * (1 + Math.floor(Math.random() * 40))) >>> 0;
    } else if (opts.strength === "strong") {
      seed = randomSeed();
    } else if (form.lockSeed && form.seed != null) {
      seed = form.seed;
    } else {
      seed = randomSeed();
    }

    const count = Math.min(8, Math.max(1, opts.count ?? 1));
    const prompt = finalPrompt(form, { baseLocked: !!studio.baseId });
    const provider = resolveProvider(form.engine);

    const notice = providerNotice(form.engine);
    if (notice && !mockWarned.current) {
      mockWarned.current = true;
      ui.toast("Mock darkroom engaged", { description: notice, tone: "info" });
    }

    studio.setGenerating(true);
    const startedAt = Date.now();
    try {
      const images = await provider.generate(
        {
          prompt,
          negative: form.negative.trim() || undefined,
          ratio: form.ratio,
          seed,
          count,
          engine: form.engine,
        },
        (stage, pct) => useStudioStore.getState().setProgress(pct, stage)
      );

      const now = Date.now();
      const gens: Generation[] = images.map((img, i) => ({
        id: uid(),
        prompt,
        negative: form.negative.trim() || undefined,
        url: img.url,
        seed: img.seed,
        settings: form,
        ratio: form.ratio,
        engine: form.engine,
        filter: img.filter,
        focus: img.focus,
        baseId: studio.baseId ?? undefined,
        tag:
          opts.strength === "subtle"
            ? "Variation · subtle"
            : opts.strength === "strong"
              ? "Variation · strong"
              : undefined,
        createdAt: now + i,
      }));

      const s = useStudioStore.getState();
      s.addGenerations(gens);
      s.setActive(gens[0].id);
      if (fromLiveForm && !form.lockSeed) {
        s.patchForm({ seed });
      }
      ui.toast(
        count === 1 ? "One plate developed" : `${count} plates developed`,
        {
          description: `Engine ${provider.label} · seed ${gens[0].seed} · ${(
            (Date.now() - startedAt) / 1000
          ).toFixed(1)}s`,
          tone: "success",
        }
      );
    } catch (err) {
      ui.toast("The shoot failed", {
        description: err instanceof Error ? err.message : "Unexpected error from the engine.",
        tone: "error",
      });
    } finally {
      useStudioStore.getState().setGenerating(false);
    }
  }, []);

  return {
    generate,
    generating: useStudioStore((s) => s.generating),
    progress: useStudioStore((s) => s.progress),
    stage: useStudioStore((s) => s.stage),
  };
}
