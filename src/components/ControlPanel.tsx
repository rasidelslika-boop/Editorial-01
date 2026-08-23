import { useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  Clapperboard,
  Dices,
  Film,
  Flame,
  Layers,
  Loader2,
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
  drawSeriesFrames,
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
  rollBodyCustom,
  rollDistinctiveCustom,
  rollEyesCustom,
  rollFaceCustom,
  rollHairCombo,
  rollHairComboFantasy,
  rollHairstyleCustom,
  rollHairstyleFantasy,
  rollSkinCustom,
  rollVibeCustom,
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
import { aiIdentity, aiMuseBlock, aiTrait } from "../lib/aiTraits";
import { composeScenePlate } from "../lib/promptBuilder";
import { cn } from "../lib/utils";
import { Button, Chip, Label, Section, SelectBox, Switch, inputCls, textareaCls } from "./ui";
import { PromptPreview } from "./PromptPreview";
import { useUIStore } from "../stores/ui";
import type { ReactNode } from "react";

/* ------------------- AI-powered trait rolling (shared helpers) ------------------ */

/** Roll a single muse-trait field with the live model, falling back to the pool. */
function rollTraitAI(describe: string, fallback: () => string): Promise<string> {
  return aiTrait({ describe, fallback });
}

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
  onRoll: () => void | Promise<void>;
  fantasy?: boolean;
  hot?: boolean;
  text?: string;
}) {
  const [busy, setBusy] = useState(false);

  const click = () => {
    if (busy) return;
    const result = onRoll();
    // AI rolls are async — show the summoning state until the phrase lands.
    if (result instanceof Promise) {
      setBusy(true);
      void result.finally(() => setBusy(false));
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9, rotate: fantasy || hot ? 0 : 12 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      onClick={click}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 items-center gap-1 rounded-sm border px-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-500",
        busy && "animate-pulse opacity-80",
        fantasy
          ? "border-gilt-500/50 text-gilt-600 hover:border-gilt-500 hover:bg-gilt-500/10 dark:text-gilt-300"
          : hot
            ? "border-wine-600/60 text-wine-600 hover:border-wine-600 hover:bg-wine-600/15 dark:border-wine-400/60 dark:text-wine-300 dark:hover:border-wine-400 dark:hover:bg-wine-500/20"
            : "border-wine-700/40 text-wine-700 hover:border-wine-700 hover:bg-wine-700/10 dark:border-gilt-400/40 dark:text-gilt-400 dark:hover:border-gilt-400 dark:hover:bg-gilt-400/10"
      )}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {busy ? "AI…" : text ?? (fantasy ? "Fantasy" : "Random")}
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

/**
 * The random-entry box. Shows the current custom description (from a Random /
 * Fantasy press, or typed by hand). Unlike the chips, this holds a composed
 * phrase that doesn't match any preset — so a dice press fills it with fresh
 * text instead of selecting a chip.
 */
function MuseNote({
  value,
  onChange,
  placeholder,
  ariaLabel,
  fantasy,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  fantasy?: boolean;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "mt-2 w-full rounded-sm border bg-transparent px-2.5 py-1.5 font-mono text-[11px] leading-relaxed transition-colors",
        "focus:outline-none focus:ring-1",
        fantasy
          ? "border-gilt-500/40 text-gilt-700 placeholder:text-gilt-600/35 focus:border-gilt-500 focus:ring-gilt-500/30 dark:text-gilt-300 dark:placeholder:text-gilt-300/30"
          : "border-ink/20 text-ink/80 placeholder:text-ink/30 focus:border-wine-600 focus:ring-wine-600/30 dark:border-paper/20 dark:text-paper/80 dark:placeholder:text-paper/25 dark:focus:border-gilt-400 dark:focus:ring-gilt-400/30"
      )}
    />
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

  /** AI-roll a single muse field; the button shows a spinner until it lands. */
  const aiMuseRoll =
    (field: "hairstyle" | "hairColor" | "eyeColor" | "skinTone" | "faceShape" | "bodyType" | "distinctive" | "museVibe" | "skinDetail", describe: string, fallback: () => string) =>
    () =>
      rollTraitAI(describe, fallback).then((v) => patchMuse({ [field]: v } as never));

  return (
    <div className="mt-3 space-y-2">
      {/* 01a — Hairstyle */}
      <MuseSub
        code="01a"
        title="Hairstyle"
        aside={
          <>
            <RollButton
              icon={Dices}
              label="Roll a fresh hairstyle with AI"
              onRoll={aiMuseRoll(
                "hairstyle",
                "A trendy, camera-ready editorial hairstyle for a young fashion model — one short descriptive phrase.",
                rollHairstyleCustom
              )}
            />
            <RollButton
              icon={Sparkles}
              label="Roll a fantasy hairstyle with AI"
              fantasy
              onRoll={aiMuseRoll(
                "hairstyle",
                "A wildly fantastical yet beautiful hairstyle for a high-fashion editorial — one short descriptive phrase.",
                rollHairstyleFantasy
              )}
            />
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
        <MuseNote
          value={muse.hairstyle}
          onChange={(v) => patchMuse({ hairstyle: v })}
          placeholder="Press Random for a fresh style, or write your own…"
          ariaLabel="Custom hairstyle"
          fantasy={!!muse.hairstyle && !HAIRSTYLES_TRENDY.includes(muse.hairstyle as never) && !HAIRSTYLES_FANTASY.includes(muse.hairstyle as never)}
        />
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
            <RollButton
              icon={Dices}
              label="Roll hair colour and texture with AI"
              onRoll={aiMuseRoll(
                "hairColor",
                "A hair colour and texture combination for a fashion model, in the format 'colour · texture'.",
                rollHairCombo
              )}
            />
            <RollButton
              icon={Sparkles}
              label="Roll a fantasy hair colour with AI"
              fantasy
              onRoll={aiMuseRoll(
                "hairColor",
                "A fantastical, otherworldly hair colour and texture combination, in the format 'colour · texture'.",
                rollHairComboFantasy
              )}
            />
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
          <RollButton
            icon={Dices}
            label="Roll a fresh eye description with AI"
            onRoll={() =>
              rollTraitAI(
                "Eye colour and shape for a striking fashion model, in the format 'shape colour' — do not include the word 'eyes'.",
                rollEyesCustom
              ).then((v) => patchMuse({ eyeColor: v.replace(/\s*eyes$/i, "").trim(), eyeShape: "" }))
            }
          />
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
        <MuseNote
          value={muse.eyeColor}
          onChange={(v) => patchMuse({ eyeColor: v })}
          placeholder="Press Random for a composed eye description, or write your own…"
          ariaLabel="Custom eye description"
        />
      </MuseSub>

      {/* 01e — Complexion */}
      <MuseSub
        code="01e"
        title="Skin tone / complexion"
        aside={
          <RollButton
            icon={Dices}
            label="Roll a fresh complexion description with AI"
            onRoll={() =>
              rollTraitAI(
                "Skin tone, undertone and finish for a fashion model as one flowing phrase, e.g. 'golden tan skin with a warm undertone and a luminous dewy glow'.",
                rollSkinCustom
              ).then((v) => patchMuse({ skinTone: v, undertone: "", skinDetail: "" }))
            }
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
        <MuseNote
          value={muse.skinTone}
          onChange={(v) => patchMuse({ skinTone: v })}
          placeholder="Press Random for a composed complexion, or write your own…"
          ariaLabel="Custom complexion description"
        />
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
            <RollButton
              icon={Dices}
              label="Roll a skin finish with AI"
              onRoll={aiMuseRoll(
                "skinDetail",
                "A skin finish for a beauty close-up fashion photograph, e.g. 'fine water droplets beading across the collarbones'.",
                rollSkinDetail
              )}
              text="Roll"
            />
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
            label="Roll a fresh face description with AI"
            onRoll={() =>
              rollTraitAI(
                "Face shape, standout features and makeup level for a fashion model as one flowing phrase, e.g. 'heart-shaped face with high cheekbones, full lips and soft glam makeup'.",
                rollFaceCustom
              ).then((v) => patchMuse({ faceShape: v, faceFeatures: "", makeup: "" }))
            }
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
        <MuseNote
          value={muse.faceShape}
          onChange={(v) => patchMuse({ faceShape: v })}
          placeholder="Press Random for a composed face description, or write your own…"
          ariaLabel="Custom face description"
        />
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
      <MuseSub
        code="01g"
        title="Body type"
        aside={
          <RollButton
            icon={Dices}
            label="Roll a fresh body type with AI"
            onRoll={aiMuseRoll(
              "bodyType",
              "A body type descriptor for a fashion model, e.g. 'a statuesque hourglass figure with long elegant lines'.",
              rollBodyCustom
            )}
          />
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {BODY_TYPES.map((b) => (
            <Chip key={b} active={muse.bodyType === b} onClick={() => patchMuse({ bodyType: b })}>
              {b}
            </Chip>
          ))}
        </div>
        <MuseNote
          value={muse.bodyType}
          onChange={(v) => patchMuse({ bodyType: v })}
          placeholder="Press Random for a composed body type, or write your own…"
          ariaLabel="Custom body type"
        />
      </MuseSub>

      {/* 01h — Distinctive details */}
      <MuseSub
        code="01h"
        title="Distinctive details"
        aside={
          <RollButton
            icon={Dices}
            label="Roll a fresh distinctive detail with AI"
            onRoll={aiMuseRoll(
              "distinctive",
              "One subtle distinctive detail for a fashion model — dimples, a mole's placement, a tiny tattoo or a delicate piercing — short phrase.",
              rollDistinctiveCustom
            )}
          />
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {DISTINCTIVE_DETAILS.map((d) => (
            <Chip key={d} active={muse.distinctive === d} onClick={() => patchMuse({ distinctive: d })}>
              {d}
            </Chip>
          ))}
        </div>
        <MuseNote
          value={muse.distinctive === "none" ? "" : muse.distinctive}
          onChange={(v) => patchMuse({ distinctive: v })}
          placeholder="Press Random for a fresh detail, or write your own…"
          ariaLabel="Custom distinctive detail"
        />
      </MuseSub>

      {/* 01i — Overall muse vibe */}
      <MuseSub
        code="01i"
        title="Overall muse vibe"
        aside={
          <RollButton
            icon={Dices}
            label="Roll a fresh muse vibe with AI"
            onRoll={aiMuseRoll(
              "museVibe",
              "An overall muse vibe for a fashion editorial, e.g. 'an elegant supermodel presence with old-money poise'.",
              rollVibeCustom
            )}
          />
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {MUSE_VIBES.map((v) => (
            <Chip key={v} active={muse.museVibe === v} onClick={() => patchMuse({ museVibe: v })}>
              {v}
            </Chip>
          ))}
        </div>
        <MuseNote
          value={muse.museVibe}
          onChange={(v) => patchMuse({ museVibe: v })}
          placeholder="Press Random for a composed vibe, or write your own…"
          ariaLabel="Custom muse vibe"
        />
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
  const toast = useGenerateToast();

  /**
   * Series — ONE continuous photoshoot: the exact same model, the exact same
   * outfit and the exact same location on every plate. Only her pose,
   * expression, framing and motion treatment change — and the pinned prompt
   * plus a shared seed keep the backdrop from drifting between frames.
   */
  const shootSeries = () => {
    const s = useStudioStore.getState();
    // Anchor: the plate currently loaded in the lightbox — click any contact-
    // sheet thumbnail and the next shoot anchors to that plate instead.
    // Empty lightbox → the current direction on the form.
    const anchor = s.generations.find((g) => g.id === s.activeId) ?? s.generations[0] ?? null;
    const settings = anchor?.settings ?? { ...s.form };
    const n = s.seriesCount;
    const frames = drawSeriesFrames(n);
    const wildcards = frames.filter((f) => f.wildcard).length;
    const teaser = frames
      .slice(0, 3)
      .map((f) => f.pose.split(",")[0])
      .join(" · ");
    const source = anchor ? `Anchored to plate №${String(anchor.seed).slice(0, 5)}` : "From the current direction";
    toast(`Series of ${n} — one continuous shoot`, {
      description: `${source} · ${teaser}…${wildcards ? ` + ${wildcards} wildcard frame${wildcards > 1 ? "s" : ""}` : ""}`,
      tone: "info",
    });
    // Engines that honour a negative prompt get an extra anti-collage guard.
    const baseNeg = (settings.negative ?? "").trim();
    const seriesNegative = `${baseNeg ? baseNeg + ", " : ""}grid, collage, multiple photos in one image, split screen, triptych, contact sheet, multiple people`;
    void generate({
      settings,
      perPlate: frames.map((f) => ({ pose: f.pose, expression: f.expression, negative: seriesNegative })),
      compose: (ps, i) => composeScenePlate(ps, frames[i]),
      seedStep: 0,
    });
  };

  /**
   * Seq — ONE continuous shoot built on the CURRENT direction: the same model
   * and the same backdrop on every plate, the same angles-and-framing variety
   * as Series, while the wardrobe shifts one editorial layer per plate
   * (remove or add). Never falls back to an old archived plate's settings.
   */
  const shootSeq = () => {
    const s = useStudioStore.getState();
    // Same anchor rule as Series — the plate on screen (or the form if the
    // lightbox is empty), read fresh at click time.
    const anchor = s.generations.find((g) => g.id === s.activeId) ?? s.generations[0] ?? null;
    const settings = anchor?.settings ?? { ...s.form };
    const n = s.seqCount;
    const steps = s.seqDirection === "remove" ? REMOVE_STEPS : ADD_STEPS;
    const frames = drawSeriesFrames(n);
    // Plate 0 wears the current outfit; each following plate shifts one layer.
    const perPlate = frames.map((frame, i) => ({
      pose: frame.pose,
      expression: frame.expression,
      outfit: i === 0 ? settings.outfit : steps[(i - 1) % steps.length],
      negative: `${(settings.negative ?? "").trim() ? settings.negative.trim() + ", " : ""}grid, collage, multiple photos in one image, split screen, triptych, contact sheet, multiple people`,
    }));
    const seqSource = anchor ? `Anchored to plate №${String(anchor.seed).slice(0, 5)}` : "From the current direction";
    toast(`Shooting a ${n}-step ${s.seqDirection === "remove" ? "remove" : "add"} sequence`, {
      description: `${seqSource} · same model, same backdrop — the wardrobe shifts one layer per plate, angles and framing never repeat.`,
      tone: "info",
    });
    void generate({
      settings,
      perPlate,
      compose: (ps, i) => composeScenePlate(ps, frames[i], { wardrobeShifts: true }),
      seedStep: 0,
    });
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
            aria-label={`Generate a ${seriesCount}-plate series — same model, outfit and background, a new pose each frame`}
            title="Anchored to the plate loaded in the lightbox — same model, outfit and background, every frame gets a new pose, look and energy (crouches, floor poses, frozen jumps, motion blur…), with the occasional wildcard"
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
          title={`Anchored to the plate loaded in the lightbox — same model and backdrop, ${seqDirection} one wardrobe layer per plate`}
          className="h-10 flex-1 uppercase tracking-[0.08em]"
        >
          <Clapperboard className="h-3.5 w-3.5" />
          Generate Seq
        </Button>
      </div>

      <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-ink/35 dark:text-paper/30">
        ⌘↵ shoot · Series & Seq anchor to the loaded plate · Series keeps the wardrobe, Seq steps it {seqDirection === "remove" ? "down" : "up"}
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

  const recast = async () => {
    // Local roller provides the instant baseline + any fields the model skips.
    const local = rollMuse();
    const [identity, block] = await Promise.all([aiIdentity(() => local.model), aiMuseBlock()]);

    const muse = { ...local.details };
    if (block) {
      muse.hairstyle = block.hairstyle;
      muse.hairColor = block.hairColor;
      muse.eyeColor = block.eyes.replace(/\s*eyes$/i, "").trim();
      muse.eyeShape = "";
      muse.skinTone = block.skin;
      muse.undertone = "";
      muse.skinDetail = "";
      muse.faceShape = block.face;
      muse.faceFeatures = "";
      muse.bodyType = block.bodyType;
      muse.distinctive = block.distinctive;
      muse.museVibe = block.museVibe;
    }

    patchForm({ model: identity, muse });
    toast(block ? "The muse has been re-cast by AI" : "The muse has been re-cast", {
      description: identity,
      tone: "success",
    });
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
              <RollButton
                icon={Dices}
                label="Roll a random location with AI"
                onRoll={() =>
                  rollTraitAI(
                    "A photoshoot-worthy location for a fashion editorial — it can range from an empty photo studio to a lavish hotel, beach, shed, shack, factory or wasteland. One vivid descriptive phrase.",
                    () => pick(RANDOM_SETTINGS)
                  ).then((v) => patchForm({ location: v }))
                }
              />
              <RollButton
                icon={Sparkles}
                label="Roll a wild fantasy location with AI"
                fantasy
                onRoll={() =>
                  rollTraitAI(
                    "The wildest imaginable fantasy location for a high-fashion photoshoot — one vivid descriptive phrase.",
                    () => pick(FANTASY_SETTINGS)
                  ).then((v) => patchForm({ location: v }))
                }
              />
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
              <RollButton
                icon={Dices}
                label="Roll a classic look with AI"
                onRoll={() =>
                  rollTraitAI(
                    "A classic, timeless fashion look — garments, fabric and styling in one evocative phrase.",
                    () => pick(CLASSIC_LOOKS)
                  ).then((v) => patchForm({ outfit: v }))
                }
                text="Classic"
              />
              <RollButton
                icon={Sparkles}
                label="Roll a wild avant-garde look with AI"
                fantasy
                onRoll={() =>
                  rollTraitAI(
                    "An avant-garde, wildly creative high-fashion look — garments, silhouette and styling in one evocative phrase.",
                    () => pick(WILD_LOOKS)
                  ).then((v) => patchForm({ outfit: v }))
                }
                text="Wild"
              />
              <RollButton
                icon={Flame}
                label="Roll an alluring, glamorous look with AI"
                hot
                onRoll={() =>
                  rollTraitAI(
                    "An alluring, glamorous fashion-editorial look — tasteful and chic, garments and styling in one evocative phrase.",
                    () => pick(HOT_LOOKS)
                  ).then((v) => patchForm({ outfit: v }))
                }
                text="Hot"
              />
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
          aside={
            <RollButton
              icon={Dices}
              label="Roll a random pose with AI"
              onRoll={() =>
                rollTraitAI(
                  "A fashion pose and composition direction, e.g. 'standing full-length, weight on one hip, chin lifted, fabric caught mid-motion'.",
                  () => pick(RANDOM_POSES)
                ).then((v) => patchForm({ pose: v }))
              }
            />
          }
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
