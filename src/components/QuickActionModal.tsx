import { Camera } from "lucide-react";
import { useEffect, useState } from "react";
import type { QuickActionKind } from "../types";
import { useStudioStore } from "../stores/editorial";
import { useUIStore } from "../stores/ui";
import { useGenerate } from "../hooks/useGenerate";
import {
  EXPRESSION_PRESETS,
  OUTFIT_PRESETS,
  QUICK_LOCATION_PRESETS,
  QUICK_POSE_PRESETS,
} from "../lib/presets";
import { Button, Chip, Dialog, Label, textareaCls } from "./ui";

const COPY: Record<QuickActionKind, { kicker: string; title: string; label: string; placeholder: string }> = {
  pose: {
    kicker: "Reshoot · keep everything else",
    title: "Change the pose",
    label: "New pose & composition",
    placeholder: "e.g. seated on a staircase, one leg extended, looking down…",
  },
  outfit: {
    kicker: "Reshoot · keep everything else",
    title: "Change the outfit",
    label: "New outfit description",
    placeholder: "e.g. a bias-cut champagne slip dress with opera gloves…",
  },
  location: {
    kicker: "Reshoot · keep everything else",
    title: "Change the location",
    label: "New setting",
    placeholder: "e.g. a flooded cathedral nave with morning light…",
  },
  expression: {
    kicker: "Reshoot · keep everything else",
    title: "Change the expression",
    label: "New expression",
    placeholder: "e.g. a defiant raised brow, eyes locked on the lens…",
  },
};

/**
 * Focused reshoot: edit a single parameter of an existing plate and
 * regenerate while every other setting is preserved.
 */
export function QuickActionModal() {
  const quickAction = useUIStore((s) => s.quickAction);
  const closeQuickAction = useUIStore((s) => s.closeQuickAction);
  const generations = useStudioStore((s) => s.generations);
  const generating = useStudioStore((s) => s.generating);
  const { generate } = useGenerate();
  const [value, setValue] = useState("");

  const gen = quickAction ? generations.find((g) => g.id === quickAction.genId) : null;
  const kind = quickAction?.kind;

  useEffect(() => {
    if (quickAction && gen) {
      setValue(gen.settings[quickAction.kind] ?? "");
    }
  }, [quickAction, gen]);

  if (!quickAction || !kind || !gen) return null;
  const copy = COPY[kind];

  const presets =
    kind === "pose"
      ? QUICK_POSE_PRESETS
      : kind === "outfit"
        ? OUTFIT_PRESETS
        : kind === "location"
          ? QUICK_LOCATION_PRESETS
          : EXPRESSION_PRESETS.map((v) => ({ label: v.split(",")[0], value: v }));

  const submit = () => {
    void generate({ settings: gen.settings, overrides: { [kind]: value } as Partial<typeof gen.settings>, count: 1 });
    closeQuickAction();
  };

  return (
    <Dialog open onClose={closeQuickAction} kicker={copy.kicker} title={copy.title}>
      <div className="flex gap-4">
        <div className="hidden w-28 shrink-0 sm:block">
          <div className="aspect-[4/5] overflow-hidden border border-ink/15 dark:border-paper/15">
            <img
              src={gen.url}
              alt="Source plate"
              className="h-full w-full object-cover"
              style={{ filter: gen.filter && gen.filter !== "none" ? gen.filter : undefined, objectPosition: gen.focus ?? "50% 40%" }}
            />
          </div>
          <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40 dark:text-paper/35">
            Source · {gen.seed}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <Label>{copy.label}</Label>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Chip key={p.label} active={value === p.value} onClick={() => setValue(p.value)} title={p.value}>
                {p.label}
              </Chip>
            ))}
          </div>
          <textarea
            autoFocus
            aria-label={copy.label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            className={textareaCls}
            placeholder={copy.placeholder}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/40 dark:text-paper/35">
              Muse, light & frame stay untouched
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="md" onClick={closeQuickAction}>
                Cancel
              </Button>
              <Button variant="accent" size="md" onClick={submit} disabled={generating || !value.trim()}>
                <Camera className="h-4 w-4" /> Reshoot
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
