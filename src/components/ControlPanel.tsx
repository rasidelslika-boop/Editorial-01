import { motion } from "framer-motion";
import { Camera, Dices, Layers, Lock, Unlock } from "lucide-react";
import { useStudioStore } from "../stores/editorial";
import { useGenerate } from "../hooks/useGenerate";
import {
  CAMERA_OPTIONS,
  ENGINES,
  EXPRESSION_PRESETS,
  LIGHTING_CUSTOM_ID,
  LIGHTING_OPTIONS,
  LOCATION_PRESETS,
  MODEL_PRESETS,
  POSE_PRESETS,
  RATIOS,
  REFERENCE_OPTIONS,
} from "../lib/presets";
import { cn } from "../lib/utils";
import { Button, Chip, Label, Section, SelectBox, Switch, inputCls, textareaCls } from "./ui";
import { PromptPreview } from "./PromptPreview";

function PresetChips({
  presets,
  onPick,
  activeValue,
}: {
  presets: { label: string; value: string }[];
  onPick: (value: string) => void;
  activeValue?: string;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap gap-1.5">
      {presets.map((p) => (
        <Chip key={p.label} active={activeValue === p.value} onClick={() => onPick(p.value)} title={p.value}>
          {p.label}
        </Chip>
      ))}
    </div>
  );
}

function RatioPicker() {
  const ratio = useStudioStore((s) => s.form.ratio);
  const patchForm = useStudioStore((s) => s.patchForm);
  return (
    <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Aspect ratio">
      {RATIOS.map((r) => {
        const [w, h] = r.id.split(":").map(Number);
        const active = ratio === r.id;
        const maxSide = 26;
        const rw = w >= h ? maxSide : Math.round((maxSide * w) / h);
        const rh = h >= w ? maxSide : Math.round((maxSide * h) / w);
        return (
          <button
            key={r.id}
            role="radio"
            aria-checked={active}
            aria-label={`Aspect ratio ${r.id} — ${r.label}`}
            onClick={() => patchForm({ ratio: r.id })}
            className={cn(
              "group flex flex-col items-center gap-1.5 rounded-sm border px-1 py-2.5 transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-500",
              active
                ? "border-wine-700 bg-wine-700/10 dark:border-gilt-400 dark:bg-gilt-400/10"
                : "border-ink/15 hover:border-ink/50 dark:border-paper/15 dark:hover:border-paper/50"
            )}
          >
            <span
              className={cn(
                "border-[1.5px] transition-colors",
                active ? "border-wine-700 dark:border-gilt-400" : "border-ink/40 group-hover:border-ink/70 dark:border-paper/40 dark:group-hover:border-paper/70"
              )}
              style={{ width: rw, height: rh }}
            />
            <span className={cn("font-mono text-[9px] font-bold leading-none", active ? "text-wine-700 dark:text-gilt-400" : "text-ink/50 dark:text-paper/50")}>
              {r.id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AdvancedSection() {
  const form = useStudioStore((s) => s.form);
  const patchForm = useStudioStore((s) => s.patchForm);
  const randomizeSeed = useStudioStore((s) => s.randomizeSeed);

  return (
    <div className="mt-3 space-y-3 rounded-sm border border-dashed border-ink/20 p-3 dark:border-paper/20">
      <div>
        <Label>Negative prompt</Label>
        <textarea
          aria-label="Negative prompt"
          value={form.negative}
          onChange={(e) => patchForm({ negative: e.target.value })}
          rows={2}
          className={cn(textareaCls, "font-mono text-xs")}
          placeholder="What the darkroom should avoid…"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[130px] flex-1">
          <Label htmlFor="seed-input">Seed</Label>
          <div className="flex gap-1.5">
            <input
              id="seed-input"
              type="number"
              inputMode="numeric"
              value={form.seed ?? ""}
              onChange={(e) => patchForm({ seed: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="random"
              className={cn(inputCls, "font-mono text-xs")}
            />
            <Button variant="outline" size="md" onClick={randomizeSeed} aria-label="Randomize seed" className="shrink-0 px-2.5">
              <Dices className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex h-10 items-center gap-2">
          <Switch checked={form.lockSeed} onChange={(v) => patchForm({ lockSeed: v })} label="Lock seed" />
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55 dark:text-paper/50">
            {form.lockSeed ? <Lock className="h-3 w-3 text-wine-700 dark:text-gilt-400" /> : <Unlock className="h-3 w-3" />}
            Lock
          </span>
        </div>
      </div>
    </div>
  );
}

function GenerateBar() {
  const { generate, generating, stage } = useGenerate();
  const batchCount = useStudioStore((s) => s.batchCount);
  const setBatchCount = useStudioStore((s) => s.setBatchCount);

  return (
    <div className="sticky bottom-0 z-10 border-t border-ink/15 bg-paper/95 px-5 py-4 backdrop-blur-sm dark:border-paper/15 dark:bg-ink/95 sm:px-6">
      <div className="flex gap-2">
        <motion.div className="flex-1" whileHover={{ scale: generating ? 1 : 1.008 }}>
          <Button
            variant="accent"
            size="lg"
            disabled={generating}
            onClick={() => void generate({ count: 1 })}
            className="w-full uppercase tracking-[0.14em]"
            aria-label="Generate one image (Control or Command + Enter)"
          >
            {generating ? (
              <>
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-gilt-300" />
                <span className="truncate normal-case tracking-normal">{stage || "Developing…"}</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Generate
                <kbd className="ml-1 hidden rounded-sm border border-wine-400/50 px-1.5 py-0.5 font-mono text-[9px] sm:inline">⌘↵</kbd>
              </>
            )}
          </Button>
        </motion.div>
        <div className="flex items-stretch gap-1.5">
          <select
            aria-label="Variations batch size"
            value={batchCount}
            onChange={(e) => setBatchCount(Number(e.target.value))}
            className="h-12 rounded-sm border border-ink/25 bg-transparent px-1.5 font-mono text-xs dark:border-paper/25 dark:[&>option]:bg-ink"
          >
            {[2, 4, 6, 8].map((n) => (
              <option key={n} value={n} className="bg-paper text-ink dark:bg-ink dark:text-paper">
                ×{n}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="lg"
            disabled={generating}
            onClick={() => void generate({ count: batchCount })}
            aria-label={`Generate ${batchCount} variations`}
            className="uppercase tracking-[0.12em]"
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Variations</span>
            <span className="sm:hidden">×{batchCount}</span>
          </Button>
        </div>
      </div>
      <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.22em] text-ink/35 dark:text-paper/30">
        Ctrl / ⌘ + Enter to shoot · Batch develops {batchCount} plates
      </p>
    </div>
  );
}

export function ControlPanel() {
  const form = useStudioStore((s) => s.form);
  const patchForm = useStudioStore((s) => s.patchForm);

  const pick = (key: keyof typeof form) => (value: string) => patchForm({ [key]: value } as never);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {/* 01 — The Muse */}
        <Section no="01" title="The Muse" hint="Cast your model">
          <PresetChips presets={MODEL_PRESETS} onPick={pick("model")} activeValue={form.model} />
          <textarea
            aria-label="Model description"
            value={form.model}
            onChange={(e) => patchForm({ model: e.target.value })}
            rows={3}
            className={textareaCls}
            placeholder="Age, ethnicity, gender presentation, body type, skin tone, features, hair, makeup…"
          />
          <div className="mt-3">
            <Label>Expression</Label>
            <PresetChips
              presets={EXPRESSION_PRESETS.map((v) => ({ label: v.split(",")[0].split(" ")[0], value: v }))}
              onPick={pick("expression")}
              activeValue={form.expression}
            />
            <input
              aria-label="Expression, custom"
              value={form.expression}
              onChange={(e) => patchForm({ expression: e.target.value })}
              className={inputCls}
              placeholder="Or write the exact expression…"
            />
          </div>
        </Section>

        {/* 02 — The Setting */}
        <Section no="02" title="The Setting" hint="Scout the location">
          <PresetChips presets={LOCATION_PRESETS} onPick={pick("location")} activeValue={form.location} />
          <textarea
            aria-label="Location and setting"
            value={form.location}
            onChange={(e) => patchForm({ location: e.target.value })}
            rows={2}
            className={textareaCls}
            placeholder="Studio, outdoor, urban, natural, architectural, surreal…"
          />
        </Section>

        {/* 03 — The Look */}
        <Section no="03" title="The Look" hint="Style the outfit">
          <textarea
            aria-label="Outfit description"
            value={form.outfit}
            onChange={(e) => patchForm({ outfit: e.target.value })}
            rows={3}
            className={textareaCls}
            placeholder="Garments, fabric, silhouette, accessories, colour story…"
          />
        </Section>

        {/* 04 — The Pose */}
        <Section no="04" title="The Pose" hint="Direct the composition">
          <PresetChips presets={POSE_PRESETS} onPick={pick("pose")} activeValue={form.pose} />
          <textarea
            aria-label="Pose and composition"
            value={form.pose}
            onChange={(e) => patchForm({ pose: e.target.value })}
            rows={2}
            className={textareaCls}
            placeholder="Standing, walking, reclining, dynamic, close-up beauty, full body…"
          />
        </Section>

        {/* 05 — Light & Glass */}
        <Section no="05" title="Light & Glass" hint="Lighting and camera">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Lighting style</Label>
              <SelectBox
                ariaLabel="Lighting style"
                value={form.lighting}
                onChange={pick("lighting")}
                options={LIGHTING_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              />
            </div>
            <div>
              <Label>Camera / lens</Label>
              <SelectBox
                ariaLabel="Camera and lens"
                value={form.camera}
                onChange={pick("camera")}
                options={CAMERA_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              />
            </div>
          </div>
          {form.lighting === LIGHTING_CUSTOM_ID ? (
            <input
              aria-label="Custom lighting description"
              value={form.lightingCustom}
              onChange={(e) => patchForm({ lightingCustom: e.target.value })}
              className={cn(inputCls, "mt-2.5")}
              placeholder="Describe your own lighting — candlelit, gel-lit, eclipse…"
            />
          ) : null}
        </Section>

        {/* 06 — The Frame */}
        <Section no="06" title="The Frame" hint="Ratio, engine and reference">
          <Label>Aspect ratio</Label>
          <RatioPicker />
          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>AI engine</Label>
              <SelectBox ariaLabel="AI engine" value={form.engine} onChange={(v) => patchForm({ engine: v as never })} options={ENGINES} />
            </div>
            <div>
              <Label>Style / reference</Label>
              <SelectBox
                ariaLabel="Style reference"
                value={form.reference}
                onChange={pick("reference")}
                options={REFERENCE_OPTIONS.map((r) => ({ id: r, label: r === "none" ? "— None —" : r }))}
              />
            </div>
          </div>
          <AdvancedSection />
        </Section>

        <PromptPreview />
      </div>

      <GenerateBar />
    </div>
  );
}
