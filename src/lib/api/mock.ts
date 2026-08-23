import type { EngineId, RatioId } from "../../types";
import { hashString, mulberry32 } from "../utils";

/* ------------------------------------------------------------------ */
/*  The mock darkroom.                                                 */
/*  Develops plates from a bundled editorial image pool so the whole   */
/*  product is usable without keys. Swap in a real provider in         */
/*  ./providers.ts and ./index.ts — the interface is identical.        */
/* ------------------------------------------------------------------ */

export interface ProviderImage {
  url: string;
  seed: number;
  filter?: string;
  focus?: string;
}

export interface GenerateRequest {
  prompt: string;
  negative?: string;
  ratio: RatioId;
  seed: number;
  count: number;
  engine: EngineId;
}

export type ProgressFn = (stage: string, pct: number) => void;

export interface ImageProvider {
  readonly id: string;
  readonly label: string;
  readonly mock?: boolean;
  generate(req: GenerateRequest, onProgress?: ProgressFn): Promise<ProviderImage[]>;
}

const POOL: { src: string; alt: string }[] = [
  { src: "https://image.qwenlm.ai/generated-images/41ebc34b-8399-48bd-ab44-b01e43abc386/_result.png", alt: "Crimson silk gown on a Parisian rooftop at golden hour" },
  { src: "https://image.qwenlm.ai/generated-images/bc1991cb-782e-4320-8163-21308a9f9809/_result.png", alt: "Androgynous model in a sculptural blazer, white infinity studio" },
  { src: "https://image.qwenlm.ai/generated-images/f4b1585b-8414-4cc6-84da-63610920b834/_result.png", alt: "Iridescent trench in a neon Tokyo backstreet" },
  { src: "https://image.qwenlm.ai/generated-images/ca35633e-c37b-492f-be01-2ffde56a3a9a/_result.png", alt: "Wool coat on an Icelandic black sand beach" },
  { src: "https://image.qwenlm.ai/generated-images/d596e67b-8906-4be4-bc49-705f66e90256/_result.png", alt: "Close-up beauty portrait with gold leaf makeup" },
  { src: "https://image.qwenlm.ai/generated-images/82fe1630-a603-4320-9653-2473c389d055/_result.png", alt: "Ivory suit in a brutalist concrete atrium" },
  { src: "https://image.qwenlm.ai/generated-images/2a8816ad-ee6f-40b0-93d0-3a2824fe132d/_result.png", alt: "Black and white portrait with a wide-brim hat" },
  { src: "https://image.qwenlm.ai/generated-images/08ce0028-b121-4986-b0b9-62b7fbc937e6/_result.png", alt: "Silver slip dress on mirror salt flats at dusk" },
];

const FINISHES = [
  "none",
  "saturate(1.08) contrast(1.04)",
  "sepia(0.14) saturate(1.1)",
  "contrast(1.08) brightness(0.98)",
  "hue-rotate(-8deg) saturate(1.06)",
  "brightness(1.05) saturate(0.94)",
  "contrast(0.96) saturate(1.12) brightness(1.03)",
];

const FOCUSES = ["50% 22%", "50% 38%", "50% 50%", "32% 40%", "68% 30%", "50% 62%"];

const STAGES = [
  "Casting the muse",
  "Scouting the location",
  "Styling the look",
  "Setting the lights",
  "Rolling the shutter",
  "Developing the plate",
  "Retouching",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockProvider: ImageProvider = {
  id: "mock",
  label: "Mock darkroom",
  mock: true,

  async generate(req, onProgress) {
    const total = 1900 + req.count * 380;
    const started = Date.now();
    const promptHash = hashString(req.prompt);

    const timer = setInterval(() => {
      const pct = Math.min(96, Math.round(((Date.now() - started) / total) * 100));
      const stage = STAGES[Math.min(STAGES.length - 1, Math.floor((pct / 100) * STAGES.length))];
      onProgress?.(stage, pct);
    }, 140);

    await sleep(total);
    clearInterval(timer);
    onProgress?.("Printing", 100);

    const images: ProviderImage[] = [];
    for (let i = 0; i < req.count; i++) {
      const seed = (req.seed + i * 7919) >>> 0;
      const rnd = mulberry32(promptHash + seed);
      const plate = POOL[(promptHash + seed) % POOL.length];
      images.push({
        url: plate.src,
        seed,
        filter: FINISHES[Math.floor(rnd() * FINISHES.length)],
        focus: FOCUSES[Math.floor(rnd() * FOCUSES.length)],
      });
    }
    return images;
  },
};
