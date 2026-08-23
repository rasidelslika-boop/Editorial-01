import type { FormState } from "../types";
import { CAMERA_OPTIONS, LIGHTING_CUSTOM_ID, LIGHTING_OPTIONS } from "./presets";

/**
 * Modular prompt construction. Each part is optional — empty fields are skipped,
 * so the sentence always reads naturally. Tweak the parts, suffixes and quality
 * boosters here without touching the UI.
 */

export function lightingText(form: FormState): string {
  if (form.lighting === LIGHTING_CUSTOM_ID) {
    return form.lightingCustom.trim() || "natural ambient light";
  }
  const opt = LIGHTING_OPTIONS.find((o) => o.id === form.lighting);
  return opt?.prompt || "soft diffused beauty lighting";
}

export function cameraText(form: FormState): string {
  const opt = CAMERA_OPTIONS.find((o) => o.id === form.camera);
  return opt?.prompt || "an 85mm ƒ/1.4 prime lens";
}

/**
 * 01a–01i trait system → one flowing physical description.
 * Unset traits are skipped, so locking a few and rolling the rest
 * still reads naturally.
 */
export function museText(form: FormState): string {
  const d = form.muse;
  if (!d) return "";

  const fmtH = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;
  /** True when a field holds a full composed phrase (from the Random boxes) rather than a chip value. */
  const phrase = (v: string) => v.includes(" with ") || v.includes(" and ") || v.length > 28;

  const silhouette: string[] = [];
  if (d.heightIn) silhouette.push(`${fmtH(d.heightIn)} tall`);
  if (d.weightLb) silhouette.push(`${d.weightLb} lbs`);
  if (d.bodyType) silhouette.push(phrase(d.bodyType) ? d.bodyType : `${d.bodyType} figure`);
  if (d.bust) silhouette.push(`${d.bust} bust`);
  if (d.waistIn) silhouette.push(`${d.waistIn}" waist`);
  if (d.hipsIn) silhouette.push(`${d.hipsIn}" hips`);

  const face: string[] = [];
  if (d.faceShape) face.push(phrase(d.faceShape) ? d.faceShape : `${d.faceShape} face`);
  if (d.faceFeatures && !(d.faceShape && phrase(d.faceShape))) face.push(d.faceFeatures);
  if (d.eyeColor && phrase(d.eyeColor)) face.push(d.eyeColor);
  else if (d.eyeShape && d.eyeColor) face.push(`${d.eyeShape} ${d.eyeColor} eyes`);
  else if (d.eyeColor) face.push(`${d.eyeColor} eyes`);
  if (d.skinTone) {
    if (phrase(d.skinTone)) face.push(d.skinTone);
    else face.push(d.undertone ? `${d.skinTone} skin with a ${d.undertone} undertone` : `${d.skinTone} skin`);
  }
  if (
    d.skinDetail &&
    !(d.skinTone && phrase(d.skinTone)) &&
    d.skinDetail !== "none — flawless matte" &&
    d.skinDetail !== "natural bare skin"
  ) {
    face.push(d.skinDetail);
  }

  const hair: string[] = [];
  if (d.hairstyle) hair.push(d.hairstyle);
  if (d.hairColor) hair.push(d.hairColor);

  const glam: string[] = [];
  if (d.makeup && !(d.faceShape && phrase(d.faceShape))) glam.push(`${d.makeup} makeup`);
  if (d.distinctive && d.distinctive !== "none") glam.push(d.distinctive);

  const bits = [silhouette.join(", "), face.join(", "), hair.join(", "), glam.join(", ")]
    .filter(Boolean)
    .join("; ");
  const vibe = d.museVibe ? (phrase(d.museVibe) || d.museVibe.startsWith("a ") ? d.museVibe : `an overall ${d.museVibe} presence`) : "";
  return [bits, vibe].filter(Boolean).join(" — ");
}

export function composePrompt(form: FormState, opts?: { baseLocked?: boolean }): string {
  const parts: string[] = [];

  // Subject — identity line plus the 01a–01i trait system.
  const identity = form.model.trim() || "a breathtaking 21-year-old woman";
  const traits = museText(form);
  parts.push(`Fashion editorial photograph of ${identity}${traits ? `, ${traits}` : ""}`);

  if (form.expression.trim()) parts.push(form.expression.trim());
  if (form.outfit.trim()) parts.push(`wearing ${form.outfit.trim()}`);
  if (form.pose.trim()) parts.push(form.pose.trim());
  if (form.location.trim()) parts.push(`set in ${form.location.trim()}`);

  // Light & glass
  parts.push(lightingText(form));
  parts.push(`shot on ${cameraText(form)}`);

  // Reference
  const ref = form.reference.trim();
  if (ref && ref !== "none") parts.push(`in the style of ${ref}`);

  // Quality boosters
  parts.push(
    "hyper-detailed skin texture, refined colour grade, professional fashion photography, 8k"
  );

  let prompt = parts.join(", ");

  if (opts?.baseLocked) {
    prompt = `Continuing from a locked reference plate — ${prompt}`;
  }

  // Engine dialect
  if (form.engine === "mj6") {
    prompt += ` --ar ${form.ratio} --style raw --stylize 250${form.seed ? ` --seed ${form.seed}` : ""}`;
  } else {
    prompt += ` [${form.ratio} frame]`;
  }

  return prompt;
}

/** The prompt actually sent — honours free-write prompt-engineering mode. */
export function finalPrompt(form: FormState, opts?: { baseLocked?: boolean }): string {
  if (form.promptMode === "custom" && form.customPrompt.trim()) {
    return form.customPrompt.trim();
  }
  return composePrompt(form, opts);
}

export function promptSummary(prompt: string, max = 96): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

export function ratioDimensions(ratio: string, base = 1024): { width: number; height: number } {
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) return { width: base, height: base };
  if (w >= h) {
    return { width: Math.round((base * w) / h / 64) * 64, height: base };
  }
  return { width: base, height: Math.round((base * h) / w / 64) * 64 };
}
