import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuickActionKind, ToastItem, ToastTone } from "../types";
import { uid } from "../lib/utils";

interface UIState {
  theme: "dark" | "light";
  toasts: ToastItem[];
  historyOpen: boolean;
  compareIds: string[];
  compareOpen: boolean;
  quickAction: { kind: QuickActionKind; genId: string } | null;

  toggleTheme: () => void;
  toast: (title: string, opts?: { description?: string; tone?: ToastTone }) => void;
  dismissToast: (id: string) => void;
  setHistoryOpen: (open: boolean) => void;
  toggleCompareId: (id: string) => void;
  clearCompare: () => void;
  setCompareOpen: (open: boolean) => void;
  openQuickAction: (kind: QuickActionKind, genId: string) => void;
  closeQuickAction: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toasts: [],
      historyOpen: false,
      compareIds: [],
      compareOpen: false,
      quickAction: null,

      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      toast: (title, opts) => {
        const item: ToastItem = {
          id: uid(),
          title,
          description: opts?.description,
          tone: opts?.tone ?? "info",
        };
        set((s) => ({ toasts: [...s.toasts.slice(-3), item] }));
        setTimeout(() => get().dismissToast(item.id), 4200);
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      setHistoryOpen: (open) => set({ historyOpen: open }),

      toggleCompareId: (id) =>
        set((s) => {
          if (s.compareIds.includes(id)) return { compareIds: s.compareIds.filter((x) => x !== id) };
          const next = [...s.compareIds, id].slice(-2);
          return { compareIds: next, compareOpen: next.length === 2 ? true : s.compareOpen };
        }),

      clearCompare: () => set({ compareIds: [], compareOpen: false }),
      setCompareOpen: (open) => set({ compareOpen: open }),

      openQuickAction: (kind, genId) => set({ quickAction: { kind, genId } }),
      closeQuickAction: () => set({ quickAction: null }),
    }),
    {
      name: "editorial-ai-ui:v1",
      partialize: (s) => ({ theme: s.theme }),
    }
  )
);
