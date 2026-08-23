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

export function composePrompt(form: FormState, opts?: { baseLocked?: boolean }): string {
  const parts: string[] = [];

  // Subject
  const muse = form.model.trim() || "an enigmatic high-fashion model";
  parts.push(`Fashion editorial photograph of ${muse}`);

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
