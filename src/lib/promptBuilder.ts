import type { FormState, MuseDetails, SeriesFrame } from "../types";
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
 * 01b measurements → renderable silhouette language. Diffusion models barely
 * respond to raw numbers ("5'9\", 130 lbs, 24\" waist"); they respond to
 * descriptive body language. Each imperial value is mapped to the visual
 * phrase a model can actually draw, plus a hip-to-waist ratio check that
 * emphasises an hourglass silhouette when the numbers warrant it.
 */
export function bodySilhouette(d: MuseDetails): string {
  const adj: string[] = [];
  const features: string[] = [];

  if (d.heightIn) {
    adj.push(
      d.heightIn <= 61
        ? "petite"
        : d.heightIn <= 67
          ? "average-height"
          : d.heightIn <= 73
            ? "tall"
            : "strikingly tall, statuesque"
    );
  }

  if (d.weightLb && d.heightIn) {
    const bmi = (703 * d.weightLb) / (d.heightIn * d.heightIn);
    adj.push(
      bmi < 18.5
        ? "willowy and slender"
        : bmi < 22
          ? "slim"
          : bmi < 25
            ? "toned and fit"
            : bmi < 28
              ? "softly curvy"
              : bmi < 32
                ? "voluptuously curvy"
                : "gracefully full-figured"
    );
  }

  if (d.waistIn) {
    features.push(
      d.waistIn <= 22
        ? "a tiny nipped-in waist"
        : d.waistIn <= 26
          ? "a defined, snatched waist"
          : d.waistIn <= 30
            ? "a softly defined waist"
            : "a soft, relaxed waistline"
    );
  }

  if (d.hipsIn) {
    features.push(
      d.hipsIn <= 34
        ? "slim, straight hips"
        : d.hipsIn <= 39
          ? "gently curved hips"
          : d.hipsIn <= 44
            ? "pronounced, rounded hips"
            : "dramatically curvy hips"
    );
  }

  if (d.bust) {
    const cup = d.bust.replace(/\d+/g, "");
    features.push(
      cup === "A" || cup === "B"
        ? "a modest bust"
        : cup === "C" || cup === "D"
          ? "a shapely, full bust"
          : "a generous, voluptuous bust"
    );
  }

  if (d.hipsIn && d.waistIn && d.waistIn > 0) {
    const ratio = d.hipsIn / d.waistIn;
    if (ratio >= 1.4) features.push("an exaggerated hourglass silhouette");
    else if (ratio >= 1.2) features.push("a classic hourglass silhouette");
  }

  if (adj.length && features.length) return `a ${adj.join(", ")} figure with ${features.join(", ")}`;
  if (adj.length) return `a ${adj.join(", ")} figure`;
  if (features.length) return `a figure with ${features.join(", ")}`;
  return "";
}

/**
 * 01a–01i trait system → one flowing physical description.
 * Unset traits are skipped, so locking a few and rolling the rest
 * still reads naturally.
 */
export function museText(form: FormState): string {
  const d = form.muse;
  if (!d) return "";

  /** True when a field holds a full composed phrase (from the Random boxes) rather than a chip value. */
  const phrase = (v: string) => v.includes(" with ") || v.includes(" and ") || v.length > 28;

  const silhouette: string[] = [];
  const built = bodySilhouette(d);
  if (built) silhouette.push(built);
  if (d.bodyType) silhouette.push(phrase(d.bodyType) ? d.bodyType : `${d.bodyType} figure`);

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
  if (d.skinDetail && d.skinDetail !== "none — flawless matte" && d.skinDetail !== "natural bare skin") {
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

  // Outfit early — wardrobe carries enormous visual weight, and an empty
  // outfit field gets a fashion-grade default so the engine never improvises
  // casual filler (the classic "denim jacket" confabulation).
  parts.push(`wearing ${form.outfit.trim() || "a chic high-fashion editorial outfit"}`);
  if (form.pose.trim()) parts.push(form.pose.trim());
  if (form.expression.trim()) parts.push(form.expression.trim());
  if (form.location.trim()) parts.push(`set in ${form.location.trim()}`);

  // Light & glass
  parts.push(lightingText(form));
  parts.push(`shot on ${cameraText(form)}`);

  // Reference
  const ref = form.reference.trim();
  if (ref && ref !== "none") parts.push(`in the style of ${ref}`);

  // Quality tail — kept deliberately short. Verbose booster lists dilute the
  // selected details; the details above are what the engine should follow.
  parts.push(form.engine === "mj6" ? "hyper-detailed, refined colour grade, professional fashion photography, 8k" : "professional fashion photography");

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

/**
 * A Series frame. Two hard rules shape the wording:
 *   1. It must read as ONE standalone photograph — never "frame X of N" or
 *      "series" language, which makes diffusion models render collages and
 *      multi-panel contact sheets in a single image.
 *   2. The model, outfit and setting are restated verbatim, so every plate of
 *      the shoot keeps the identical backdrop and look while pose, expression
 *      and framing change.
 */
export function composeScenePlate(
  form: FormState,
  frame: SeriesFrame,
  opts?: { wardrobeShifts?: boolean }
): string {
  const identity = form.model.trim() || "a breathtaking 21-year-old woman";
  const traits = museText(form);
  const muse = traits ? `${identity}, ${traits}` : identity;
  // A fashion-grade default beats a vague one — "her styled look" invites the
  // engine to improvise casual filler clothing.
  const outfit = form.outfit.trim() || "a chic high-fashion editorial outfit";
  const shifting = opts?.wardrobeShifts === true;

  const settingBits = [form.location.trim(), lightingText(form), `shot on ${cameraText(form)}`]
    .filter((s) => s && s.length > 2)
    .join(", ");
  const ref = form.reference.trim();
  const motion = frame.motion ? `, ${frame.motion}` : "";

  const contract = shifting
    ? `She is the exact same model in the exact same location as every other frame of this shoot — only her outfit, pose, expression and framing change from frame to frame. ` +
      `Do not change the backdrop or setting.`
    : `She is the exact same model, wearing the exact same outfit, in the exact same location as every other frame of this shoot — only her pose, expression and framing change from frame to frame. ` +
      `Do not change the backdrop or setting.`;
  const outfitLine = shifting ? `In this frame she is wearing: ${outfit}.` : `She is wearing exactly this outfit: ${outfit}.`;

  const prompt =
    `A single standalone fashion editorial photograph — exactly one model in one scene, no collage, no grid, no split panels. ` +
    `${contract} ` +
    `The setting: ${settingBits}` +
    `${ref && ref !== "none" ? `, in the style of ${ref}` : ""}. ` +
    `The model is ${muse}. ${outfitLine} ` +
    `In this photograph she is captured in a ${frame.framing}, ${frame.pose}${motion}, ${frame.expression}, ` +
    `professional fashion photography`;

  if (form.engine === "mj6") {
    return `${prompt} --ar ${form.ratio} --style raw --stylize 250${form.seed ? ` --seed ${form.seed}` : ""}`;
  }
  return `${prompt} [${form.ratio} frame]`;
}

/**
 * Series/Seq anchor continuation. Starts from the anchored plate's EXACT
 * prompt and swaps only the pose / expression clauses. A minimal lexical
 * diff combined with the identical seed is what genuinely continues the
 * loaded plate's scene — a semantic rewrite (same facts, new words) makes
 * the model redraw a different picture.
 */
export function reframeAnchorPrompt(anchorPrompt: string, s: FormState, frame: SeriesFrame): string {
  const motion = frame.motion ? `, ${frame.motion}` : "";
  let p = anchorPrompt;
  let swapped = false;

  const pose = (s.pose ?? "").trim();
  if (pose.length > 3 && p.includes(pose)) {
    p = p.replace(pose, `${frame.framing}, ${frame.pose}${motion}`);
    swapped = true;
  }
  const expr = (s.expression ?? "").trim();
  if (expr.length > 3 && p.includes(expr)) {
    p = p.replace(expr, frame.expression);
    swapped = true;
  }

  if (!swapped) {
    // Free-write or hand-edited brief — append the frame direction while
    // respecting any engine dialect tail (e.g. "--ar 4:5 --stylize …").
    const tail = p.indexOf(" --");
    const insert = `, in this photograph: a ${frame.framing}, ${frame.pose}${motion}, ${frame.expression}`;
    p = tail >= 0 ? p.slice(0, tail) + insert + p.slice(tail) : p + insert;
  }
  return p;
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
