import { X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";

/**
 * Side-by-side plate comparison with a draggable divider.
 * Divider is keyboard-operable via arrow keys (role="slider").
 */
export function CompareOverlay() {
  const compareIds = useUIStore((s) => s.compareIds);
  const compareOpen = useUIStore((s) => s.compareOpen);
  const clearCompare = useUIStore((s) => s.clearCompare);
  const generations = useStudioStore((s) => s.generations);

  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => clearCompare(), [clearCompare]);

  const plates = compareIds
    .map((id) => generations.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  if (!compareOpen || plates.length < 2) return null;
  const [a, b] = plates;

  const updateFromClientX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Plate comparison">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-gilt-400">Comparison</p>
          <h2 className="font-display text-xl font-semibold italic text-paper">Plate {a.seed} · against · Plate {b.seed}</h2>
        </div>
        <button
          onClick={close}
          aria-label="Close comparison"
          className="grid h-10 w-10 place-items-center rounded-sm border border-paper/25 text-paper/80 transition-colors hover:border-paper hover:bg-paper hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 cursor-col-resize touch-none select-none overflow-hidden border border-paper/20"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) updateFromClientX(e.clientX);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {/* Plate B — full bleed */}
        <img
          src={b.url}
          alt={`Plate seed ${b.seed}`}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ filter: b.filter && b.filter !== "none" ? b.filter : undefined }}
          draggable={false}
        />
        {/* Plate A — clipped */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img
            src={a.url}
            alt={`Plate seed ${a.seed}`}
            className="absolute inset-0 h-full object-contain"
            style={{
              width: wrapRef.current?.clientWidth ? `${wrapRef.current.clientWidth}px` : "100vw",
              filter: a.filter && a.filter !== "none" ? a.filter : undefined,
            }}
            draggable={false}
          />
        </div>

        {/* Divider */}
        <div className="absolute inset-y-0 z-10" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-gilt-400" />
          <div
            role="slider"
            aria-label="Comparison divider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
              if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
            }}
            className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-col-resize place-items-center rounded-full border-2 border-gilt-400 bg-ink/80 text-gilt-300 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt-400"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M5 3L1.5 8L5 13M11 3l3.5 5L11 13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <span className="absolute left-3 top-3 rounded-sm bg-ink/70 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper backdrop-blur-sm">
          A · {a.seed}
        </span>
        <span className="absolute right-3 top-3 rounded-sm bg-ink/70 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper backdrop-blur-sm">
          B · {b.seed}
        </span>
      </div>

      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
        Drag the divider · arrow keys nudge · Esc closes
      </p>
    </div>
  );
}
