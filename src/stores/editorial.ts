import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormState, Generation } from "../types";
import { NEGATIVE_DEFAULT } from "../lib/presets";
import { randomSeed } from "../lib/utils";

export const DEFAULT_FORM: FormState = {
  model: "",
  expression: "",
  outfit: "",
  pose: "",
  location: "",
  lighting: "golden",
  lightingCustom: "",
  camera: "hasselblad",
  ratio: "4:5",
  engine: "flux-pro",
  reference: "Vogue Italia",
  negative: NEGATIVE_DEFAULT,
  seed: null,
  lockSeed: false,
  promptMode: "auto",
  customPrompt: "",
};

interface StudioState {
  form: FormState;
  generations: Generation[];
  activeId: string | null;
  baseId: string | null;
  batchCount: number;
  generating: boolean;
  progress: number;
  stage: string;

  patchForm: (patch: Partial<FormState>) => void;
  randomizeSeed: () => void;
  setGenerating: (value: boolean) => void;
  setProgress: (pct: number, stage: string) => void;
  addGenerations: (gens: Generation[]) => void;
  removeGeneration: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setActive: (id: string | null) => void;
  toggleBase: (id: string) => void;
  setBatchCount: (n: number) => void;
  loadGeneration: (id: string) => void;
  clearArchive: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      form: DEFAULT_FORM,
      generations: [],
      activeId: null,
      baseId: null,
      batchCount: 4,
      generating: false,
      progress: 0,
      stage: "",

      patchForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),

      randomizeSeed: () => set((s) => ({ form: { ...s.form, seed: randomSeed() } })),

      setGenerating: (value) =>
        set(value ? { generating: true, progress: 4, stage: "Warming up the darkroom" } : { generating: false, progress: 0, stage: "" }),

      setProgress: (pct, stage) => set({ progress: pct, stage }),

      addGenerations: (gens) =>
        set((s) => ({
          generations: [...gens, ...s.generations].slice(0, 80),
        })),

      removeGeneration: (id) =>
        set((s) => ({
          generations: s.generations.filter((g) => g.id !== id),
          activeId: s.activeId === id ? (s.generations.find((g) => g.id !== id)?.id ?? null) : s.activeId,
          baseId: s.baseId === id ? null : s.baseId,
        })),

      toggleFavorite: (id) =>
        set((s) => ({
          generations: s.generations.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)),
        })),

      setActive: (id) => set({ activeId: id }),

      toggleBase: (id) => set((s) => ({ baseId: s.baseId === id ? null : id })),

      setBatchCount: (n) => set({ batchCount: n }),

      loadGeneration: (id) => {
        const gen = get().generations.find((g) => g.id === id);
        if (!gen) return;
        set({ form: { ...gen.settings }, activeId: id });
      },

      clearArchive: () => set({ generations: [], activeId: null, baseId: null }),
    }),
    {
      name: "editorial-ai:v1",
      // Bumped on engine changes — old persisted archives (stale plates) are
      // discarded so the studio always boots from a clean darkroom.
      version: 2,
      partialize: (s) => ({
        form: s.form,
        generations: s.generations,
        activeId: s.activeId,
        baseId: s.baseId,
        batchCount: s.batchCount,
      }),
    }
  )
);
