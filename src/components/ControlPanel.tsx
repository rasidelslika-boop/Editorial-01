import { motion } from "framer-motion";
import {
  Camera,
  Clapperboard,
  Dices,
  Film,
  Flame,
  Layers,
  Lock,
  Minus,
  Plus,
  Sparkles,
  Unlock,
  type LucideIcon,
} from "lucide-react";
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
import {
  ADD_STEPS,
  BODY_TYPES,
  BUST_OPTIONS,
  CLASSIC_LOOKS,
  DISTINCTIVE_DETAILS,
  drawPoses,
  EYE_COLORS,
  EYE_SHAPES,
  FACE_FEATURES,
  FACE_SHAPES,
  FANTASY_SETTINGS,
  HAIRSTYLES_FANTASY,
  HAIRSTYLES_TRENDY,
  HAIR_COMBOS,
  HAIR_COMBOS_FANTASY,
  HEIGHT_OPTIONS,
  HIPS_OPTIONS,
  HOT_LOOKS,
  MAKEUP_LEVELS,
  MUSE_VIBES,
  RANDOM_POSES,
  RANDOM_SETTINGS,
  REMOVE_STEPS,
  SKIN_DETAILS,
  SKIN_TONES,
  TRENDY_LOOKS,
  UNDERTONES,
  WAIST_OPTIONS,
  WEIGHT_OPTIONS,
  WILD_LOOKS,
  fmtHeight,
  pick,
  rollMeasurements,
  rollMuse,
  rollSkinDetail,
} from "../lib/randomizers";
import { cn } from "../lib/utils";
import { Button, Chip, Label, Section, SelectBox, Switch, inputCls, textareaCls } from "./ui";
import { PromptPreview } from "./PromptPreview";
import { useUIStore } from "../stores/ui";
import type { ReactNode } from "react";

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

/* ------------------------- Randomize / Fantasy controls ------------------------- */

function RollButton({
  icon: Icon,
  label,
  onRoll,
  fantasy,
  hot,
  text,
}: {
  icon: LucideIcon;
  label: string;
  onRoll: () => void;
  fantasy?: boolean;
  hot?: boolean;
  text?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9, rotate: fantasy || hot ? 0 : 12 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      onClick={onRoll}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 items-center gap-1 rounded-sm border px-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-500",
        fantasy
          ? "border-gilt-500/50 text-gilt-600 hover:border-gilt-500 hover:bg-gilt-500/10 dark:text-gilt-300"
          : hot
            ? "border-wine-600/60 text-wine-600 hover:border-wine-600 hover:bg-wine-600/15 dark:border-wine-400/60 dark:text-wine-300 dark:hover:border-wine-400 dark:hover:bg-wine-500/20"
            : "border-wine-700/40 text-wine-700 hover:border-wine-700 hover:bg-wine-700/10 dark:border-gilt-400/40 dark:text-gilt-400 dark:hover:border-gilt-400 dark:hover:bg-gilt-400/10"
      )}
    >
      <Icon className="h-3 w-3" />
      {text ?? (fantasy ? "Fantasy" : "Random")}
    </motion.button>
  );
}

/** A numbered sub-block of the muse dossier — 01a, 01b, … 01i. */
function MuseSub({ code, title, aside, children }: { code: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-sm border border-ink/12 bg-ink/[0.02] transition-colors hover:border-ink/25 dark:border-paper/12 dark:bg-paper/[0.03] dark:hover:border-paper/25">
      <div className="flex items-center justify-between gap-2 border-b border-ink/8 bg-ink/[0.025] px-2.5 py-1.5 dark:border-paper/8 dark:bg-paper/[0.025]">
        <span className="flex items-baseline gap-2">
          <span className="font-display wonk text-sm italic leading-none text-wine-700 dark:text-gilt-400">{code}</span>
          <span className="smallcaps font-sans text-[11px] font-bold text-ink/65 dark:text-paper/60">{title}</span>
        </span>
        {aside ? <span className="flex items-center gap-1">{aside}</span> : null}
      </div>
      <div className="px-2.5 py-2">{children}</div>
    </div>
  );
}

/* ------------------------------ The muse dossier ------------------------------ */

function MusePanel() {
  const muse = useStudioStore((s) => s.form.muse);
  const patchMuse = useStudioStore((s) => s.patchMuse);
  const patchForm = useStudioStore((s) => s.patchForm);

  const chips = (pool: readonly string[]) => pool.map((v) => ({ label: v, value: v }));
  const numSel = (v: number | null) => (v != null ? String(v) : "");
  const numSet = (key: "heightIn" | "weightLb" | "waistIn" | "hipsIn") => (raw: string) =>
    patchMuse({ [key]: raw === "" ? null : Number(raw) } as never);

  return (
    <div className="mt-3 space-y-2">
      {/* 01a — Hairstyle */}
      <MuseSub
        code="01a"
        title="Hairstyle"
        aside={
          <>
            <RollButton icon={Dices} label="Roll a trendy hairstyle" onRoll={() => patchMuse({ hairstyle: pick(HAIRSTYLES_TRENDY) })} />
            <RollButton icon={Sparkles} label="Roll a fantasy hairstyle" fantasy onRoll={() => patchMuse({ hairstyle: pick(HAIRSTYLES_FANTASY) })} />
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {HAIRSTYLES_TRENDY.map((h) => (
            <Chip key={h} active={muse.hairstyle === h} onClick={() => patchMuse({ hairstyle: h })} title={h}>
              {h}
            </Chip>
          ))}
        </div>
        {muse.hairstyle && !HAIRSTYLES_TRENDY.includes(muse.hairstyle as never) ? (
          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-gilt-600 dark:text-gilt-300">
            <Sparkles className="h-3 w-3" /> {muse.hairstyle}
          </p>
        ) : null}
      </MuseSub>

      {/* 01b — Body measurements (imperial) */}
      <MuseSub
        code="01b"
        title="Body measurements · imperial"
        aside={<RollButton icon={Dices} label="Roll all measurements" onRoll={() => patchMuse(rollMeasurements())} />}
      >
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          <div>
            <Label htmlFor="muse-height" className="!mb-1">Height</Label>
            <SelectBox
              ariaLabel="Height"
              placeholder="—"
              value={numSel(muse.heightIn)}
              onChange={numSet("heightIn")}
              options={HEIGHT_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              className="!text-[11px]"
            />
            {muse.heightIn != null ? <p className="mt-0.5 font-mono text-[9px] text-ink/40 dark:text-paper/35">{fmtHeight(muse.heightIn)}</p> : null}
          </div>
          <div>
            <Label className="!mb-1">Weight</Label>
            <SelectBox ariaLabel="Weight" placeholder="—" value={numSel(muse.weightLb)} onChange={numSet("weightLb")} options={WEIGHT_OPTIONS} />
          </div>
          <div>
            <Label className="!mb-1">Bust</Label>
            <SelectBox
              ariaLabel="Bust size"
              placeholder="—"
              value={muse.bust}
              onChange={(v) => patchMuse({ bust: v })}
              options={BUST_OPTIONS}
            />
          </div>
          <div>
            <Label className="!mb-1">Waist</Label>
            <SelectBox ariaLabel="Waist in inches" placeholder="—" value={numSel(muse.waistIn)} onChange={numSet("waistIn")} options={WAIST_OPTIONS} />
          </div>
          <div>
            <Label className="!mb-1">Hips</Label>
            <SelectBox ariaLabel="Hips in inches" placeholder="—" value={numSel(muse.hipsIn)} onChange={numSet("hipsIn")} options={HIPS_OPTIONS} />
          </div>
        </div>
      </MuseSub>

      {/* 01c — Hair colour + texture */}
      <MuseSub
        code="01c"
        title="Hair colour + texture"
        aside={
          <>
            <RollButton icon={Dices} label="Roll hair colour and texture" onRoll={() => patchMuse({ hairColor: pick(HAIR_COMBOS) })} />
            <RollButton icon={Sparkles} label="Roll a fantasy hair colour" fantasy onRoll={() => patchMuse({ hairColor: pick(HAIR_COMBOS_FANTASY) })} />
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {HAIR_COMBOS.map((c) => (
            <Chip key={c} active={muse.hairColor === c} onClick={() => patchMuse({ hairColor: c })} title={c}>
              {c}
            </Chip>
          ))}
        </div>
        {muse.hairColor && !HAIR_COMBOS.includes(muse.hairColor as never) ? (
          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-gilt-600 dark:text-gilt-300">
            <Sparkles className="h-3 w-3" /> {muse.hairColor}
          </p>
        ) : null}
      </MuseSub>

      {/* 01d — Eyes */}
      <MuseSub
        code="01d"
        title="Eyes"
        aside={
          <RollButton icon={Dices} label="Roll eye colour and shape" onRoll={() => patchMuse({ eyeColor: pick(EYE_COLORS), eyeShape: pick(EYE_SHAPES) })} />
        }
      >
        <Label className="!mb-1">Colour</Label>
        <div className="flex flex-wrap gap-1.5">
          {EYE_COLORS.map((c) => (
            <Chip key={c} active={muse.eyeColor === c} onClick={() => patchMuse({ eyeColor: c })}>
              {c}
            </Chip>
          ))}
        </div>
        <Label className="!mb-1 mt-2">Shape</Label>
        <div className="flex flex-wrap gap-1.5">
          {EYE_SHAPES.map((s) => (
            <Chip key={s} active={muse.eyeShape === s} onClick={() => patchMuse({ eyeShape: s })}>
              {s}
            </Chip>
          ))}
        </div>
      </MuseSub>

      {/* 01e — Complexion */}
      <MuseSub
        code="01e"
        title="Skin tone / complexion"
        aside={
          <RollButton
            icon={Dices}
            label="Roll complexion"
            onRoll={() => patchMuse({ skinTone: pick(SKIN_TONES), undertone: pick(UNDERTONES), skinDetail: pick(SKIN_DETAILS) })}
          />
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {SKIN_TONES.map((t) => (
            <Chip key={t} active={muse.skinTone === t} onClick={() => patchMuse({ skinTone: t })}>
              {t}
            </Chip>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <SelectBox ariaLabel="Undertone" placeholder="Undertone —" value={muse.undertone} onChange={(v) => patchMuse({ undertone: v })} options={UNDERTONES.map((u) => ({ id: u, label: `${u} undertone` }))} />
          <div className="flex items-center gap-1.5">
            <SelectBox
              ariaLabel="Skin finish"
              placeholder="Finish —"
              value={muse.skinDetail}
              onChange={(v) => patchMuse({ skinDetail: v })}
              options={SKIN_DETAILS.map((s) => ({ id: s, label: s }))}
              className="min-w-0 flex-1"
            />
            <RollButton icon={Dices} label="Roll a skin finish" onRoll={() => patchMuse({ skinDetail: rollSkinDetail() })} text="Roll" />
          </div>
        </div>
      </MuseSub>

      {/* 01f — Face shape & features */}
      <MuseSub
        code="01f"
        title="Face shape & features"
        aside={
          <RollButton
            icon={Dices}
            label="Roll face shape, features and makeup"
            onRoll={() => patchMuse({ faceShape: pick(FACE_SHAPES), faceFeatures: pick(FACE_FEATURES), makeup: pick(MAKEUP_LEVELS) })}
          />
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {FACE_SHAPES.map((f) => (
            <Chip key={f} active={muse.faceShape === f} onClick={() => patchMuse({ faceShape: f })}>
              {f}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FACE_FEATURES.map((f) => (
            <Chip key={f} active={muse.faceFeatures === f} onClick={() => patchMuse({ faceFeatures: f })}>
              {f}
            </Chip>
          ))}
        </div>
        <div className="mt-2">
          <Label className="!mb-1">Makeup level</Label>
          <div className="flex flex-wrap gap-1.5">
            {MAKEUP_LEVELS.map((m) => (
              <Chip key={m} active={muse.makeup === m} onClick={() => patchMuse({ makeup: m })}>
                {m}
              </Chip>
            ))}
          </div>
        </div>
      </MuseSub>

      {/* 01g — Body type */}
      <MuseSub code="01g" title="Body type" aside={<RollButton icon={Dices} label="Roll body type" onRoll={() => patchMuse({ bodyType: pick(BODY_TYPES) })} />}>
        <div className="flex flex-wrap gap-1.5">
          {BODY_TYPES.map((b) => (
            <Chip key={b} active={muse.bodyType === b} onClick={() => patchMuse({ bodyType: b })}>
              {b}
            </Chip>
          ))}
        </div>
      </MuseSub>

      {/* 01h — Distinctive details */}
      <MuseSub
        code="01h"
        title="Distinctive details"
        aside={<RollButton icon={Dices} label="Roll a distinctive detail" onRoll={() => patchMuse({ distinctive: pick(DISTINCTIVE_DETAILS) })} />}
      >
        <div className="flex flex-wrap gap-1.5">
          {DISTINCTIVE_DETAILS.map((d) => (
            <Chip key={d} active={muse.distinctive === d} onClick={() => patchMuse({ distinctive: d })}>
              {d}
            </Chip>
          ))}
        </div>
      </MuseSub>

      {/* 01i — Overall muse vibe */}
      <MuseSub code="01i" title="Overall muse vibe" aside={<RollButton icon={Dices} label="Roll the muse vibe" onRoll={() => patchMuse({ museVibe: pick(MUSE_VIBES) })} />}>
        <div className="flex flex-wrap gap-1.5">
          {MUSE_VIBES.map((v) => (
            <Chip key={v} active={muse.museVibe === v} onClick={() => patchMuse({ museVibe: v })}>
              {v}
            </Chip>
          ))}
        </div>
      </MuseSub>
    </div>
  );
}

function RatioPicker() {
  const ratio = useStudioStore((s) => s.form.ratio);
  const patchForm = useStudioStore((s) => s.patchForm);
  return (
    <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Aspect ratio">
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

/** A compact count selector — shared by Variations, Series and Seq. */
function CountSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  options: number[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-10 rounded-sm border border-ink/25 bg-transparent px-1.5 font-mono text-xs dark:border-paper/25 dark:[&>option]:bg-ink"
    >
      {options.map((n) => (
        <option key={n} value={n} className="bg-paper text-ink dark:bg-ink dark:text-paper">
          ×{n}
        </option>
      ))}
    </select>
  );
}

function GenerateBar() {
  const { generate, generating, stage } = useGenerate();
  const batchCount = useStudioStore((s) => s.batchCount);
  const setBatchCount = useStudioStore((s) => s.setBatchCount);
  const seriesCount = useStudioStore((s) => s.seriesCount);
  const setSeriesCount = useStudioStore((s) => s.setSeriesCount);
  const seqCount = useStudioStore((s) => s.seqCount);
  const setSeqCount = useStudioStore((s) => s.setSeqCount);
  const seqDirection = useStudioStore((s) => s.seqDirection);
  const setSeqDirection = useStudioStore((s) => s.setSeqDirection);
  const form = useStudioStore((s) => s.form);
  const generations = useStudioStore((s) => s.generations);
  const activeId = useStudioStore((s) => s.activeId);
  const toast = useGenerateToast();

  // The plate the Seq shooter starts from — the active plate, else the current form.
  const activeGen = generations.find((g) => g.id === activeId) ?? generations[0] ?? null;

  /** Series — same muse, same wardrobe, same session; a different pose per plate. */
  const shootSeries = () => {
    const poses = drawPoses(seriesCount, form.pose);
    toast(`Shooting a ${seriesCount}-plate series`, {
      description: "Same muse, same wardrobe — a fresh pose on every plate.",
      tone: "info",
    });
    void generate({ count: seriesCount, perPlate: poses.map((pose) => ({ pose })) });
  };

  /** Seq — start from the active plate and step the wardrobe up or down, new pose each plate. */
  const shootSeq = () => {
    const steps = seqDirection === "remove" ? REMOVE_STEPS : ADD_STEPS;
    const poses = drawPoses(seqCount, form.pose);
    const base = activeGen?.settings ?? form;
    const perPlate = Array.from({ length: seqCount }, (_, i) => ({
      pose: poses[i],
      outfit: i === 0 ? base.outfit : steps[(i - 1) % steps.length],
    }));
    toast(`Shooting a ${seqCount}-step ${seqDirection === "remove" ? "remove" : "add"} sequence`, {
      description: "Wardrobe shifts one editorial layer per plate, poses never repeat.",
      tone: "info",
    });
    void generate({ count: seqCount, settings: base, perPlate });
  };

  return (
    <div className="sticky bottom-0 z-10 border-t border-ink/15 bg-paper/95 px-5 py-3.5 backdrop-blur-sm dark:border-paper/15 dark:bg-ink/95 sm:px-6">
      {/* Primary generate */}
      <motion.div whileHover={{ scale: generating ? 1 : 1.006 }}>
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

      {/* Variations + Series */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex items-stretch gap-1.5">
          <CountSelect value={batchCount} onChange={setBatchCount} label="Variations batch size" options={[2, 4, 6, 8]} />
          <Button
            variant="outline"
            size="md"
            disabled={generating}
            onClick={() => void generate({ count: batchCount })}
            aria-label={`Generate ${batchCount} variations`}
            className="h-10 flex-1 uppercase tracking-[0.08em]"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Variations</span>
            <span className="md:hidden">Var</span>
          </Button>
        </div>
        <div className="flex items-stretch gap-1.5">
          <CountSelect value={seriesCount} onChange={setSeriesCount} label="Series plate count" options={[2, 3, 4, 5, 6, 8]} />
          <Button
            variant="outline"
            size="md"
            disabled={generating}
            onClick={shootSeries}
            aria-label={`Generate a ${seriesCount}-plate series with different poses`}
            title="Same muse & wardrobe, a different pose on every plate"
            className="h-10 flex-1 uppercase tracking-[0.08em]"
          >
            <Film className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Series</span>
            <span className="md:hidden">Ser</span>
          </Button>
        </div>
      </div>

      {/* Seq — wardrobe remove/add across plates */}
      <div className="mt-2 flex items-stretch gap-1.5">
        <div
          className="flex h-10 shrink-0 items-center rounded-sm border border-ink/25 p-0.5 dark:border-paper/25"
          role="tablist"
          aria-label="Sequence wardrobe direction"
        >
          {(
            [
              { id: "remove", label: "Remove", icon: Minus, title: "Pare the wardrobe back one layer per plate" },
              { id: "add", label: "Add", icon: Plus, title: "Layer the wardrobe up one step per plate" },
            ] as const
          ).map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={seqDirection === d.id}
              title={d.title}
              onClick={() => setSeqDirection(d.id)}
              className={cn(
                "flex h-full items-center gap-1 rounded-[3px] px-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors",
                seqDirection === d.id
                  ? d.id === "remove"
                    ? "bg-wine-700 text-wine-50 dark:bg-wine-500 dark:text-wine-950"
                    : "bg-gilt-500 text-ink dark:bg-gilt-400"
                  : "text-ink/45 hover:text-ink dark:text-paper/45 dark:hover:text-paper"
              )}
            >
              <d.icon className="h-3 w-3" />
              <span className="hidden sm:inline">{d.label}</span>
            </button>
          ))}
        </div>
        <CountSelect value={seqCount} onChange={setSeqCount} label="Sequence step count" options={[2, 3, 4, 5, 6]} />
        <Button
          variant="outline"
          size="md"
          disabled={generating}
          onClick={shootSeq}
          aria-label={`Generate a ${seqCount}-step ${seqDirection} wardrobe sequence`}
          title={`Start from the ${activeGen ? "active plate" : "current form"} and ${seqDirection} one layer per plate`}
          className="h-10 flex-1 uppercase tracking-[0.08em]"
        >
          <Clapperboard className="h-3.5 w-3.5" />
          Generate Seq
        </Button>
      </div>

      <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-ink/35 dark:text-paper/30">
        ⌘↵ shoot · Series keeps muse & wardrobe, changes pose · Seq steps the wardrobe {seqDirection === "remove" ? "down" : "up"}
      </p>
    </div>
  );
}

export function ControlPanel() {
  const form = useStudioStore((s) => s.form);
  const patchForm = useStudioStore((s) => s.patchForm);
  const patchMuse = useStudioStore((s) => s.patchMuse);
  const toast = useGenerateToast();

  const pickField = (key: keyof typeof form) => (value: string) => patchForm({ [key]: value } as never);

  const recast = () => {
    const rolled = rollMuse();
    patchForm({ model: rolled.model, muse: rolled.details });
    toast("The muse has been re-cast", { description: rolled.model, tone: "success" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {/* 01 — The Muse */}
        <Section
          no="01"
          title="The Muse"
          hint="Cast your model · full trait dossier"
          aside={<RollButton icon={Dices} label="Re-cast the entire muse" onRoll={recast} text="Re-cast" />}
        >
          <PresetChips presets={MODEL_PRESETS} onPick={pickField("model")} activeValue={form.model} />
          <textarea
            aria-label="Model description"
            value={form.model}
            onChange={(e) => patchForm({ model: e.target.value })}
            rows={2}
            className={textareaCls}
            placeholder="Identity line — e.g. a breathtaking 21-year-old Brazilian woman…"
          />
          <MusePanel />
          <div className="mt-3">
            <Label>Expression</Label>
            <PresetChips
              presets={EXPRESSION_PRESETS.map((v) => ({ label: v.split(",")[0].split(" ")[0], value: v }))}
              onPick={pickField("expression")}
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
        <Section
          no="02"
          title="The Setting"
          hint="Scout the location"
          aside={
            <>
              <RollButton icon={Dices} label="Roll a random location" onRoll={() => patchForm({ location: pick(RANDOM_SETTINGS) })} />
              <RollButton icon={Sparkles} label="Roll a wild fantasy location" fantasy onRoll={() => patchForm({ location: pick(FANTASY_SETTINGS) })} />
            </>
          }
        >
          <PresetChips presets={LOCATION_PRESETS} onPick={pickField("location")} activeValue={form.location} />
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
        <Section
          no="03"
          title="The Look"
          hint="Style the outfit · top trending looks"
          aside={
            <>
              <RollButton icon={Dices} label="Roll a classic look" onRoll={() => patchForm({ outfit: pick(CLASSIC_LOOKS) })} text="Classic" />
              <RollButton icon={Sparkles} label="Roll a wild avant-garde look" fantasy onRoll={() => patchForm({ outfit: pick(WILD_LOOKS) })} text="Wild" />
              <RollButton icon={Flame} label="Roll an alluring, glamorous look" hot onRoll={() => patchForm({ outfit: pick(HOT_LOOKS) })} text="Hot" />
            </>
          }
        >
          <PresetChips
            presets={TRENDY_LOOKS.map((l) => ({ label: l.split("—")[0].trim(), value: l }))}
            onPick={pickField("outfit")}
            activeValue={form.outfit}
          />
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
        <Section
          no="04"
          title="The Pose"
          hint="Direct the composition"
          aside={<RollButton icon={Dices} label="Roll a random pose" onRoll={() => patchForm({ pose: pick(RANDOM_POSES) })} />}
        >
          <PresetChips presets={POSE_PRESETS} onPick={pickField("pose")} activeValue={form.pose} />
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
                onChange={pickField("lighting")}
                options={LIGHTING_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              />
            </div>
            <div>
              <Label>Camera / lens</Label>
              <SelectBox
                ariaLabel="Camera and lens"
                value={form.camera}
                onChange={pickField("camera")}
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
                onChange={pickField("reference")}
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

/* Local alias so the panel can toast without extra wiring. */
function useGenerateToast() {
  return useUIStore((s) => s.toast);
}
