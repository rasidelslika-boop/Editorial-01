export type RatioId = "1:1" | "4:5" | "3:4" | "2:3" | "16:9" | "9:16" | "21:9";

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

export interface FormState {
  /** The muse — age, ethnicity, gender presentation, body type, skin, features, hair, makeup. */
  model: string;
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
