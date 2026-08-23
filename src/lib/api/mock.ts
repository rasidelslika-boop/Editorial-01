import { hashString, mulberry32 } from "../utils";

/* ------------------------------------------------------------------ */
/*  The Studio engine.                                                 */
/*  Primary: renders live from your exact prompt via the free          */
/*  Pollinations image API (no key required) — every plate is unique.  */
/*  Fallback: a bundled editorial plate pool, used only when the live  */
/*  engine is unreachable, so the studio never dead-ends.              */
/* ------------------------------------------------------------------ */

export interface ProviderImage {
  url: string;
  seed: number;
  /** Darkroom finish, applied to fallback plates only. */
  filter?: string;
  focus?: string;
  /** True when served from the offline plate pool. */
  fallback?: boolean;
}

export interface GenerateRequest {
  prompt: string;
  negative?: string;
  seed: number;
  count: number;
  ratio: string;
  quality?: "standard" | "hq";
}

export type ProgressFn = (stage: string, pct: number) => void;

export interface ImageProvider {
  id: string;
  label: string;
  mock?: boolean;
  generate(req: GenerateRequest, onProgress?: ProgressFn): Promise<ProviderImage[]>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------- Offline plate pool ---------------------------- */

const PLATE_POOL = [
  {
    url: "https://image.qwenlm.ai/generated-images/41ebc34b-8399-48bd-ab44-b01e43abc386/_result.png",
    focus: "Crimson silk · Paris rooftop",
  },
  {
    url: "https://image.qwenlm.ai/generated-images/bc1991cb-782e-4320-8163-21308a9f9809/_result.png",
    focus: "Sculptural tailoring · white cove",
  },
  {
    url: "https://image.qwenlm.ai/generated-images/f4b1585b-8414-4cc6-84da-63610920b834/_result.png",
    focus: "Iridescent trench · Tokyo rain",
  },
  {
    url: "https://image.qwenlm.ai/generated-images/ca35633e-c37b-492f-be01-2ffde56a3a9a/_result.png",
    focus: "Charcoal wool · black sand",
  },
  {
    url: "https://image.qwenlm.ai/generated-images/d596e67b-8906-4be4-bc49-705f66e90256/_result.png",
    focus: "Gold-leaf beauty crop",
  },
  {
    url: "https://image.qwenlm.ai/generated-images/82fe1630-a603-4320-9653-2473c389d055/_result.png",
    focus: "Ivory suit · concrete atrium",
  },
  {
    url: "https://image.qwenlm.ai/generated-images/2a8816ad-ee6f-40b0-93d0-3a2824fe132d/_result.png",
    focus: "Silver updo · noir glamour",
  },
  {
    url: "https://image.qwenlm.ai/generated-images/08ce0028-b121-4986-b0b9-62b7fbc937e6/_result.png",
    focus: "Liquid silver · mirror salt flats",
  },
];

const FINISHES = [
  { label: "None", filter: "none" },
  { label: "Kodak Portra", filter: "saturate(1.06) contrast(1.03) sepia(0.09) hue-rotate(-4deg)" },
  { label: "Cinestill 800T", filter: "saturate(1.18) contrast(1.1) hue-rotate(8deg) brightness(0.98)" },
  { label: "Ilford HP5", filter: "grayscale(1) contrast(1.14) brightness(1.03)" },
  { label: "Faded Vogue '96", filter: "contrast(0.94) brightness(1.06) sepia(0.16) saturate(0.88)" },
  { label: "Chrome Gloss", filter: "saturate(1.3) contrast(1.16) brightness(1.02)" },
];

function fallbackPick(prompt: string, seed: number, index: number) {
  const rng = mulberry32(hashString(prompt) ^ ((seed + index * 7919) >>> 0));
  const plate = PLATE_POOL[Math.floor(rng() * PLATE_POOL.length)];
  const finish = FINISHES[Math.floor(rng() * FINISHES.length)];
  return { plate, finish };
}

/* ------------------------------ Live engine ------------------------------ */

const LIVE_BASE = "https://image.pollinations.ai/prompt/";

export function liveDimensions(ratio: string, maxSide: number) {
  const [w, h] = ratio.split(":").map(Number);
  const rw = w || 1;
  const rh = h || 1;
  let width: number;
  let height: number;
  if (rw >= rh) {
    width = maxSide;
    height = (maxSide * rh) / rw;
  } else {
    height = maxSide;
    width = (maxSide * rw) / rh;
  }
  const round = (n: number) => Math.max(512, Math.round(n / 64) * 64);
  return { width: round(width), height: round(height) };
}

export function liveUrl(prompt: string, seed: number, width: number, height: number) {
  const p = encodeURIComponent(prompt.slice(0, 1600));
  return `${LIVE_BASE}${p}?model=flux&seed=${seed}&width=${width}&height=${height}&nologo=true&private=true&safe=true&referrer=editorial-ai`;
}

/** Fetch waits for the remote engine to actually finish rendering. One retry on throttle/5xx. */
async function fetchLive(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 75_000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) return true;
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        // Anonymous tier throttles to 1 request / 15s — back off, then retry.
        await sleep(16_000);
        continue;
      }
      return false;
    } catch {
      if (attempt === 0) {
        await sleep(4_000);
        continue;
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  return false;
}

export const studioProvider: ImageProvider = {
  id: "studio",
  label: "EditorialAI studio engine",
  mock: true,

  async generate(req, onProgress) {
    const maxSide = req.quality === "hq" ? 1536 : 1024;
    const { width, height } = liveDimensions(req.ratio, maxSide);
    const images: ProviderImage[] = [];

    for (let i = 0; i < req.count; i++) {
      const seed = (req.seed + i * 977) >>> 0;
      onProgress?.(
        req.count > 1 ? `Developing plate ${i + 1} of ${req.count}` : "Exposing the frame",
        16 + (i / req.count) * 48
      );

      const url = liveUrl(req.prompt, seed, width, height);
      const ok = await fetchLive(url);

      if (ok) {
        images.push({ url, seed });
      } else {
        const { plate, finish } = fallbackPick(req.prompt, seed, i);
        images.push({ url: plate.url, seed, filter: finish.filter, focus: plate.focus, fallback: true });
      }

      // Space out plates so batches stay inside the anonymous rate limit.
      if (i < req.count - 1) await sleep(1_400);
    }

    onProgress?.("Printing", 100);
    return images;
  },
};

/** Alias for older imports. */
export const mockProvider = studioProvider;
