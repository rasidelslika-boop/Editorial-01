import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { cn } from "../lib/utils";

/* ------------------------------------ Button ------------------------------------ */

type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "dark";

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm font-sans font-semibold tracking-wide transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper dark:focus-visible:ring-offset-ink",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-sm",
        variant === "primary" &&
          "bg-ink text-paper hover:bg-wine-800 dark:bg-paper dark:text-ink dark:hover:bg-gilt-300",
        variant === "accent" && "bg-wine-700 text-wine-50 hover:bg-wine-600 shadow-[0_2px_16px_-4px_rgba(140,42,64,0.5)]",
        variant === "outline" &&
          "border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-paper dark:border-paper/25 dark:text-paper dark:hover:border-paper dark:hover:bg-paper dark:hover:text-ink",
        variant === "ghost" &&
          "text-ink/70 hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-paper/10 dark:hover:text-paper",
        variant === "dark" && "bg-ink/90 text-paper hover:bg-ink dark:bg-paper/90 dark:text-ink",
        className
      )}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------ Chip -------------------------------------- */

export function Chip({
  active,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-sm border px-2.5 py-1.5 font-mono text-[11px] leading-none transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-500",
        active
          ? "border-wine-700 bg-wine-700 text-wine-50 dark:border-wine-400 dark:bg-wine-500 dark:text-wine-950"
          : "border-ink/20 text-ink/70 hover:-translate-y-px hover:border-ink/60 hover:text-ink dark:border-paper/20 dark:text-paper/60 dark:hover:border-gilt-400 dark:hover:text-gilt-300",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ----------------------------------- Section ------------------------------------ */

export function Section({
  no,
  title,
  hint,
  aside,
  children,
  className,
}: {
  no: string;
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-ink/10 px-5 py-5 dark:border-paper/10 sm:px-6", className)}>
      <header className="mb-3.5 flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display wonk text-2xl italic leading-none text-wine-700 dark:text-gilt-400">{no}</span>
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold leading-tight">{title}</h3>
            {hint ? <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45 dark:text-paper/40">{hint}</p> : null}
          </div>
        </div>
        {aside ? <div className="flex shrink-0 items-center gap-1.5 pt-0.5">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------ Field ------------------------------------- */

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50 dark:text-paper/45", className)}
    >
      {children}
    </label>
  );
}

export const textareaCls =
  "w-full resize-y rounded-sm border border-ink/15 bg-transparent px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink/30 transition-colors focus:border-wine-600 focus:outline-none focus:ring-1 focus:ring-wine-600/40 dark:border-paper/15 dark:text-paper dark:placeholder:text-paper/25 dark:focus:border-gilt-400 dark:focus:ring-gilt-400/30";

export const inputCls =
  "w-full rounded-sm border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink/30 transition-colors focus:border-wine-600 focus:outline-none focus:ring-1 focus:ring-wine-600/40 dark:border-paper/15 dark:text-paper dark:placeholder:text-paper/25 dark:focus:border-gilt-400 dark:focus:ring-gilt-400/30";

export function SelectBox({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, "appearance-none pr-9 font-mono text-xs")}
      >
        {placeholder !== undefined ? (
          <option value="" disabled className="bg-paper text-ink/50 dark:bg-ink dark:text-paper/50">
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-paper text-ink dark:bg-ink dark:text-paper">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40 dark:text-paper/40" aria-hidden />
    </div>
  );
}

/* ------------------------------------ Switch ------------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-500",
        checked ? "border-wine-700 bg-wine-700 dark:border-gilt-500 dark:bg-gilt-500" : "border-ink/25 bg-ink/10 dark:border-paper/25 dark:bg-paper/10"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className={cn("h-3.5 w-3.5 rounded-full", checked ? "ml-[18px] bg-wine-50 dark:bg-ink" : "ml-[3px] bg-ink/50 dark:bg-paper/50")}
      />
    </button>
  );
}

/* ------------------------------------ Dialog ------------------------------------ */

export function Dialog({
  open,
  onClose,
  title,
  kicker,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-[2px] dark:bg-ink/80" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={cn(
              "relative max-h-[92dvh] w-full overflow-y-auto border border-ink/15 bg-paper shadow-2xl dark:border-paper/15 dark:bg-[#19171c] sm:rounded-sm",
              wide ? "sm:max-w-4xl" : "sm:max-w-lg"
            )}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink/10 bg-paper/95 px-5 py-4 backdrop-blur dark:border-paper/10 dark:bg-[#19171c]/95 sm:px-6">
              <div>
                {kicker ? (
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-wine-700 dark:text-gilt-400">{kicker}</p>
                ) : null}
                <h2 id={titleId} className="font-display text-xl font-semibold italic">
                  {title}
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog" className="-mr-2">
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="px-5 py-5 sm:px-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
