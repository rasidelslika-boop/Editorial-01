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
  engine?: string;
  quality?: "standard" | "hq";
  /** Skip live rendering — serve straight from the curated plate pool. */
  curatedOnly?: boolean;
  /**
   * The anchored plate (Series / Seq). When the live engine can't render,
   * stand-ins become darkroom variations of THIS image — not the stock pool.
   */
  anchorUrl?: string;
}

export type ProgressFn = (stage: string, pct: number) => void;

export interface ImageProvider {
  id: string;
  label: string;
  mock?: boolean;
  generate(req: GenerateRequest, onProgress?: ProgressFn): Promise<ProviderImage[]>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const env = import.meta.env as Record<string, string | undefined>;

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

const CROPS = ["center", "top", "bottom", "close"];

function fallbackPick(prompt: string, seed: number, index: number) {
  const rng = mulberry32(hashString(prompt) ^ ((seed + index * 7919) >>> 0));
  const plate = PLATE_POOL[Math.floor(rng() * PLATE_POOL.length)];
  const finish = FINISHES[Math.floor(rng() * FINISHES.length)];
  // A different crop per seed so stand-in plates read as distinct shots.
  const crop = CROPS[Math.floor(rng() * CROPS.length)];
  return { plate, finish, crop };
}

/* ------------------------------ Live engine ------------------------------ */

const LIVE_BASE = "https://image.pollinations.ai/prompt/";
const POLLINATIONS_TOKEN = env.VITE_POLLINATIONS_TOKEN;

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

/**
 * Discover the best model the anonymous tier will actually serve right now.
 * The list has moved around (flux → sana-only → …), so we ask the engine
 * itself once per hour instead of hardcoding, and prefer flux-class models
 * whenever they're available. With a VITE_POLLINATIONS_TOKEN, flux is assumed.
 */
let modelPick: Promise<string> | null = null;
function pickLiveModel(engine?: string): Promise<string> {
  if (POLLINATIONS_TOKEN) return Promise.resolve(engine === "sd3" ? "turbo" : "flux");
  if (!modelPick) {
    modelPick = (async () => {
      try {
        const cached = localStorage.getItem("editorial-ai:pl-model");
        if (cached) {
          const [m, ts] = cached.split("|");
          if (m && Date.now() - Number(ts) < 3_600_000) return m;
        }
      } catch {
        /* private mode */
      }
      let best = "sana";
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5_000);
        const res = await fetch("https://image.pollinations.ai/models", { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
          const list: unknown = await res.json();
          if (Array.isArray(list)) {
            best = ["flux", "kontext", "turbo"].find((m) => list.includes(m)) ?? "sana";
          }
        }
      } catch {
        /* offline — sana */
      }
      try {
        localStorage.setItem("editorial-ai:pl-model", `${best}|${Date.now()}`);
      } catch {
        /* ignore */
      }
      return best;
    })();
  }
  return modelPick;
}

/**
 * Smaller diffusion models choke on long briefs and MJ-style flags.
 * Flux-class models get the full prompt; everyone else gets a tight caption.
 */
function tunePrompt(prompt: string, model: string): string {
  let p = prompt
    .replace(/\s*--\w+\s+\S+/g, "") // --ar / --stylize / --seed flags
    .replace(/\s*\[\d+:\d+ frame\]/g, "") // ratio tags
    .replace(/\s{2,}/g, " ")
    .trim();
  if (model === "flux" || model === "kontext") return p.slice(0, 1200);
  p = p
    .replace(/,\s*hyper-detailed[\s\S]*$/i, ", professional fashion photography, sharp focus, natural skin texture")
    .trim();
  return p.slice(0, 360);
}

export function liveUrl(prompt: string, seed: number, width: number, height: number, model: string) {
  const params = new URLSearchParams({
    model,
    seed: String(seed),
    width: String(width),
    height: String(height),
    safe: "true",
    referrer: "editorial-ai",
  });
  // nologo/private are account-gated — only send them with a token.
  if (POLLINATIONS_TOKEN) {
    params.set("token", POLLINATIONS_TOKEN);
    params.set("nologo", "true");
    params.set("private", "true");
  }
  return `${LIVE_BASE}${encodeURIComponent(prompt.slice(0, 1600))}?${params.toString()}`;
}

/**
 * Fetch the plate and *verify* it. Pollinations can answer 200 with an
 * error artwork, so sniff the bytes: it must be an image type and a
 * photograph-sized payload, not a tiny rendered error card.
 */
async function renderLive(url: string): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`engine responded ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("engine returned a non-image payload");
    if (blob.size < 30_000) throw new Error("engine returned an error plate");
  } finally {
    clearTimeout(timer);
  }
}

/** Try the best discovered model first, then `sana`, with throttle back-off between attempts. */
async function developPlate(prompt: string, seed: number, width: number, height: number, engine?: string): Promise<string> {
  const preferred = await pickLiveModel(engine);
  const models = [preferred];
  if (!models.includes("sana")) models.push("sana");

  for (let m = 0; m < models.length; m++) {
    const url = liveUrl(tunePrompt(prompt, models[m]), seed, width, height, models[m]);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await renderLive(url);
        // Return the CDN URL itself — Pollinations caches by URL, so the
        // same plate re-loads from the archive after a page refresh.
        return url;
      } catch {
        if (attempt === 0) await sleep(m === 0 ? 16_000 : 6_000);
      }
    }
  }
  throw new Error("live render failed");
}

export const studioProvider: ImageProvider = {
  id: "studio",
  label: "Editorial-RSF studio engine",
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

      // Curated path — used when a configured engine failed; instant and beautiful.
      if (req.curatedOnly) {
        await sleep(600); // let the darkroom theatrics breathe
        const { plate, finish, crop } = fallbackPick(req.prompt, seed, i);
        // With an anchor, the stand-in is a crop/grade variation of the loaded plate.
        images.push({ url: req.anchorUrl ?? plate.url, seed, filter: finish.filter, focus: crop, fallback: true });
        continue;
      }

      try {
        const url = await developPlate(req.prompt, seed, width, height, req.engine);
        images.push({ url, seed });
      } catch {
        const { plate, finish, crop } = fallbackPick(req.prompt, seed, i);
        images.push({ url: req.anchorUrl ?? plate.url, seed, filter: finish.filter, focus: crop, fallback: true });
      }

      // Keep batches friendly to the anonymous rate limit; the retry
      // logic above absorbs any remaining 429s.
      if (i < req.count - 1) await sleep(3_000);
    }

    onProgress?.("Printing", 100);
    return images;
  },
};

/** Alias for older imports. */
export const mockProvider = studioProvider;
