export type RatioId = "1:1" | "5:4" | "4:3" | "3:2" | "4:5" | "3:4" | "2:3" | "16:9" | "9:16" | "21:9";

export type EngineId =
  | "flux-pro"
  | "flux-dev"
  | "sd3"
  | "dalle3"
  | "qwen-image"
  | "wanx-turbo"
  | "wanx-plus"
  | "mj6"
  | "custom";

export type PromptMode = "auto" | "custom";

/**
 * 01a–01i — the deep muse trait system. Every field is independently
 * randomizable (lock some, roll others). Measurements are imperial.
 */
export interface MuseDetails {
  /** 01a */ hairstyle: string;
  /** 01c */ hairColor: string; // colour + texture combo
  /** 01b */ heightIn: number | null; // 56 (4'8") – 81 (6'9")
  weightLb: number | null; // 85 – 250
  bust: string; // US band + cup, e.g. "34C"
  waistIn: number | null; // 18 – 36
  hipsIn: number | null; // 30 – 50
  /** 01d */ eyeColor: string;
  eyeShape: string;
  /** 01e */ skinTone: string;
  undertone: string;
  skinDetail: string;
  /** 01f */ faceShape: string;
  faceFeatures: string;
  makeup: string;
  /** 01g */ bodyType: string;
  /** 01h */ distinctive: string;
  /** 01i */ museVibe: string;
}

export interface FormState {
  /** The muse — identity line: age, ethnicity, presence. Physical detail lives in `muse`. */
  model: string;
  muse: MuseDetails;
  expression: string;
  outfit: string;
  pose: string;
  location: string;
  /** Key into LIGHTING_OPTIONS or "custom". */
  lighting: string;
  lightingCustom: string;
  camera: string;
  ratio: RatioId;
  engine: EngineId;
  reference: string;
  negative: string;
  seed: number | null;
  lockSeed: boolean;
  promptMode: PromptMode;
  customPrompt: string;
}

export interface Generation {
  id: string;
  prompt: string;
  negative?: string;
  url: string;
  seed: number;
  settings: FormState;
  ratio: RatioId;
  engine: EngineId;
  /** Mock-darkroom finish so variations read as distinct plates. */
  filter?: string;
  focus?: string;
  upscaled?: boolean;
  baseId?: string;
  favorite?: boolean;
  tag?: string;
  /** Served from the curated stand-in pool because the live engine failed. */
  standIn?: boolean;
  createdAt: number;
}

export type QuickActionKind = "pose" | "outfit" | "location" | "expression";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

/** One frame of a Series shoot — same muse/outfit/setting, new energy. */
export interface SeriesFrame {
  pose: string;
  expression: string;
  framing: string;
  /** Motion treatment — "" means a clean, crisp frame. */
  motion: string;
  wildcard?: boolean;
}
