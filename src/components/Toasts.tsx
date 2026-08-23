import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useUIStore } from "../stores/ui";
import { cn } from "../lib/utils";

const TONE_STYLES = {
  success: { border: "border-gilt-500/60", icon: CheckCircle2, iconCls: "text-gilt-500" },
  error: { border: "border-wine-600/70", icon: AlertTriangle, iconCls: "text-wine-500 dark:text-wine-300" },
  info: { border: "border-ink/25 dark:border-paper/25", icon: Info, iconCls: "text-ink/60 dark:text-paper/60" },
} as const;

export function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const tone = TONE_STYLES[t.tone];
          const Icon = tone.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "pointer-events-auto flex items-start gap-3 border bg-paper/95 px-4 py-3 shadow-xl backdrop-blur-sm dark:bg-[#1b181e]/95",
                tone.border
              )}
              role="status"
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.iconCls)} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold italic leading-tight">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-xs leading-snug text-ink/60 dark:text-paper/55">{t.description}</p> : null}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 text-ink/40 transition-colors hover:text-ink dark:text-paper/40 dark:hover:text-paper"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
