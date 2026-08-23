import {
  liveDimensions,
  studioProvider,
  type GenerateRequest,
  type ImageProvider,
  type ProgressFn,
  type ProviderImage,
} from "./mock";
import { ratioDimensions } from "../promptBuilder";

/* ------------------------------------------------------------------ */
/*  Real providers. Drop keys into `.env.local` (see README.md):       */
/*    VITE_OPENAI_API_KEY   → DALL·E 3                                 */
/*    VITE_BFL_API_KEY      → Flux 1.1 Pro / Flux Dev                  */
/*    VITE_CUSTOM_ENDPOINT  → your own POST endpoint                   */
/*  When a key is missing, resolveProvider() falls back to the mock.   */
/* ------------------------------------------------------------------ */

const env = import.meta.env as Record<string, string | undefined>;

export const openaiProvider: ImageProvider = {
  id: "dalle3",
  label: "DALL·E 3",

  async generate(req, onProgress) {
    const key = env.VITE_OPENAI_API_KEY;
    if (!key) throw new Error("VITE_OPENAI_API_KEY is not set");
    onProgress?.("Sending to DALL·E 3", 30);

    // DALL·E 3 only supports three sizes — map the closest frame.
    const sizeMap: Record<string, string> = {
      "1:1": "1024x1024",
      "16:9": "1792x1024",
      "21:9": "1792x1024",
      "9:16": "1024x1792",
    };
    const size = sizeMap[req.ratio] ?? "1024x1024";

    const images: ProviderImage[] = [];
    for (let i = 0; i < req.count; i++) {
      onProgress?.(`Rendering plate ${i + 1} of ${req.count}`, 30 + (i / req.count) * 60);
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: req.prompt,
          n: 1,
          size,
          quality: "hd",
          response_format: "url",
        }),
      });
      if (!res.ok) throw new Error(`DALL·E 3 error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      images.push({ url: data.data[0].url, seed: req.seed + i });
    }
    onProgress?.("Printing", 100);
    return images;
  },
};

export function bflProvider(engine: "flux-pro" | "flux-dev" | "sd3"): ImageProvider {
  const model = engine === "flux-pro" ? "flux-pro-1.1" : engine === "flux-dev" ? "flux-dev" : "sd3.5";
  return {
    id: engine,
    label: engine,

    async generate(req, onProgress) {
      const key = env.VITE_BFL_API_KEY;
      if (!key) throw new Error("VITE_BFL_API_KEY is not set");
      const { width, height } = ratioDimensions(req.ratio);
      const images: ProviderImage[] = [];

      for (let i = 0; i < req.count; i++) {
        onProgress?.(`Queueing plate ${i + 1} of ${req.count}`, 20);
        const res = await fetch(`https://api.bfl.ml/v1/${model}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-key": key },
          body: JSON.stringify({
            prompt: req.prompt,
            width,
            height,
            seed: req.seed + i,
            safety_tolerance: 2,
          }),
        });
        if (!res.ok) throw new Error(`BFL error ${res.status}: ${await res.text()}`);
        const { id } = await res.json();

        // Poll until the plate is developed.
        let url: string | null = null;
        for (let attempt = 0; attempt < 60 && !url; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          const poll = await fetch(`https://api.bfl.ml/v1/get_result?id=${id}`, {
            headers: { "x-key": key },
          });
          const result = await poll.json();
          onProgress?.("Developing the plate", 20 + Math.min(70, attempt * 3));
          if (result.status === "Ready") url = result.result?.sample;
          if (result.status === "Error") throw new Error("BFL job failed");
        }
        if (!url) throw new Error("BFL job timed out");
        images.push({ url, seed: req.seed + i });
      }
      onProgress?.("Printing", 100);
      return images;
    },
  };
}

export const customProvider: ImageProvider = {
  id: "custom",
  label: "Custom endpoint",

  async generate(req, onProgress) {
    const endpoint = env.VITE_CUSTOM_ENDPOINT;
    if (!endpoint) throw new Error("VITE_CUSTOM_ENDPOINT is not set");
    onProgress?.("Sending to your endpoint", 35);
    const { width, height } = ratioDimensions(req.ratio);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: req.prompt,
        negative_prompt: req.negative,
        seed: req.seed,
        count: req.count,
        width,
        height,
      }),
    });
    if (!res.ok) throw new Error(`Custom endpoint error ${res.status}`);
    const data = await res.json();
    // Accepts { images: [url] } or { url }
    const list: string[] = Array.isArray(data.images) ? data.images : data.url ? [data.url] : [];
    if (!list.length) throw new Error("Custom endpoint returned no images");
    onProgress?.("Printing", 100);
    return list.slice(0, req.count).map((url, i) => ({ url, seed: req.seed + i }));
  },
};

/* ------------------------------------------------------------------ */
/*  Qwen platform — DashScope (Alibaba Cloud Model Studio).            */
/*  Note: Qwen-Max / Qwen 3.x are text models. Image generation on     */
/*  the Qwen platform is served by Qwen-Image and Wanx 2.1 — wired     */
/*  here through the OpenAI-compatible endpoint. Flux and SD 3.5 are   */
/*  also available through the same API key.                           */
/* ------------------------------------------------------------------ */

type DashScopeFamily = "qwen" | "wanx" | "flux" | "sd";

const DASHSCOPE_MODELS: Record<string, { model: string; family: DashScopeFamily }> = {
  "qwen-image": { model: "qwen-image", family: "qwen" },
  "wanx-turbo": { model: "wanx2.1-t2i-turbo", family: "wanx" },
  "wanx-plus": { model: "wanx2.1-t2i-plus", family: "wanx" },
  "flux-pro": { model: "flux-merged", family: "flux" },
  "flux-dev": { model: "flux-dev", family: "flux" },
  sd3: { model: "stable-diffusion-3.5-large", family: "sd" },
};

/** Size strings in DashScope's `W*H` format, respecting each family's documented limits. */
function dashScopeSize(family: DashScopeFamily, ratio: string, hq: boolean): string {
  if (family === "wanx") {
    // wanx2.1 documents exactly three sizes.
    const [rw, rh] = ratio.split(":").map(Number);
    if (Math.abs((rw || 1) - (rh || 1)) < 0.01) return "1024*1024";
    return (rw || 1) > (rh || 1) ? "1280*720" : "720*1280";
  }
  const maxSide = hq ? (family === "qwen" ? 1664 : 1440) : family === "qwen" ? 1328 : 1024;
  const multiple = family === "qwen" ? 32 : 64;
  const { width, height } = liveDimensions(ratio, maxSide);
  const round = (n: number) => Math.max(512, Math.round(n / multiple) * multiple);
  return `${round(width)}*${round(height)}`;
}

/**
 * Baked-in DashScope (Alibaba Cloud Model Studio) key so the studio works
 * out of the box. `VITE_DASHSCOPE_API_KEY` in `.env.local` takes precedence.
 *
 * ⚠ Keys baked into a client bundle are publicly readable. Treat this one as
 *   disposable — for long-lived keys, deploy the relay worker (see README)
 *   and keep credentials server-side.
 */
const BAKED_DASHSCOPE_KEY =
  "sk-ws-H.DMYPHYD.OfEJ.MEUCIBtqBWReDnRKM1bGzTuTPqH7xJBXLt2Rrn6DDKLvuV-rAiEA4Y2EUAFBEaTba5IQp9ojgHeFxCAHIP9q3S45r-_RCcM";

export function dashscopeKey(): string {
  return env.VITE_DASHSCOPE_API_KEY || BAKED_DASHSCOPE_KEY;
}

export function hasDashscopeKey(): boolean {
  return dashscopeKey().length > 0;
}

/**
 * Gateway host — the owner's ap-southeast-1 MaaS workspace, or the relay
 * worker from `/worker` when `VITE_DASHSCOPE_RELAY` is set (see README).
 * Generic endpoints for other accounts:
 *   intl:  https://dashscope-intl.aliyuncs.com
 *   china: https://dashscope.aliyuncs.com
 */
function dashscopeHost(): string {
  const relay = env.VITE_DASHSCOPE_RELAY;
  if (relay) return relay.replace(/\/+$/, "");
  return "https://ws-ou063af90w6dlklj.ap-southeast-1.maas.aliyuncs.com";
}

/** OpenAI-compatible base — the route the studio tries first. */
function dashscopeBase(): string {
  return (env.VITE_DASHSCOPE_BASE_URL ?? `${dashscopeHost()}/compatible-mode/v1`).replace(/\/+$/, "");
}

/** Native DashScope async API on the same gateway — the fallback route. */
function dashscopeNativeBase(): string {
  const origin = dashscopeBase().match(/^(https?:\/\/[^/]+)/)?.[1];
  return origin ? `${origin}/api/v1` : `${dashscopeHost()}/api/v1`;
}

/* ------------------------- Multi-route generation ------------------------- */
/*  Route A  — OpenAI-compatible `POST /images/generations` (sync).           */
/*  Route A2 — on 404/400, probe the workspace's `/models` and retry with the */
/*             closest available image model (regional workspaces expose      */
/*             different model lists).                                        */
/*  Route B  — native DashScope async API on the same gateway                 */
/*             (`/api/v1/services/aigc/text2image/image-synthesis` + polling).*/
/*  If the endpoint is unreachable from the browser at all, the free studio   */
/*  engine finishes the shoot so it never dead-ends.                          */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return false;
  return err instanceof TypeError;
}

interface OneShot {
  key: string;
  base: string;
  nativeBase: string;
  model: string;
  size: string;
  seed: number;
  prompt: string;
  negative?: string;
  family: DashScopeFamily;
  onProgress?: ProgressFn;
}

type CompatResult = { url: string } | { status: number } | { network: true };

async function tryCompatible(ctx: OneShot, diag: { last?: string }): Promise<CompatResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(`${ctx.base}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.key}` },
      body: JSON.stringify({
        model: ctx.model,
        prompt: ctx.prompt,
        ...(ctx.family === "wanx" || ctx.family === "qwen" ? { negative_prompt: ctx.negative } : {}),
        size: ctx.size,
        n: 1,
        seed: ctx.seed,
      }),
      signal: ctrl.signal,
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const url: string | undefined = data?.data?.[0]?.url;
      if (url) return { url };
      diag.last = "compatible-mode returned 200 but no image URL";
      return { status: 502 };
    }
    const body = await res.text().catch(() => "");
    diag.last = `compatible-mode HTTP ${res.status} — ${body.slice(0, 180)}`;
    console.warn(`[EditorialAI] ${diag.last}`);
    return { status: res.status };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      diag.last = "compatible-mode timed out after 90s";
      return { status: 408 };
    }
    return { network: true };
  } finally {
    clearTimeout(timer);
  }
}

/** Cached probe of the workspace's available models. */
let modelProbe: Promise<string[] | null> | null = null;
function probeModels(base: string, key: string): Promise<string[] | null> {
  if (!modelProbe) {
    modelProbe = (async () => {
      try {
        const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        const ids = (data?.data ?? [])
          .map((m: { id?: string }) => m?.id)
          .filter((x: unknown): x is string => typeof x === "string");
        return ids.length ? ids : null;
      } catch {
        return null;
      }
    })();
  }
  return modelProbe;
}

const IMAGE_HINTS = ["qwen-image", "wanx", "flux", "stable-diffusion", "sd3", "kolors"];

function pickAvailableImageModel(models: string[], preferred: string): string | null {
  if (models.includes(preferred)) return preferred;
  const candidates = models.filter((m) => IMAGE_HINTS.some((h) => m.toLowerCase().includes(h)));
  if (!candidates.length) return null;
  const family = preferred.split(/[-.]/)[0];
  return candidates.find((m) => m.toLowerCase().startsWith(family)) ?? candidates[0];
}

async function nativeGenerate(ctx: OneShot, diag: { last?: string }): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`${ctx.nativeBase}/services/aigc/text2image/image-synthesis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.key}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: ctx.model,
        input: {
          prompt: ctx.prompt,
          ...(ctx.negative ? { negative_prompt: ctx.negative } : {}),
        },
        parameters: {
          size: ctx.size,
          n: 1,
          seed: ctx.seed,
          ...(ctx.family !== "qwen" ? { prompt_extend: true } : {}),
        },
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    diag.last = `native API HTTP ${res.status} — ${body.slice(0, 180)}`;
    throw new HttpError(res.status, diag.last);
  }

  const data = await res.json().catch(() => null);
  const taskId: string | undefined = data?.output?.task_id;
  if (!taskId) throw new Error("DashScope accepted the job but returned no task id");

  // Poll the task until the plate is developed (~2 min ceiling).
  for (let i = 0; i < 48; i++) {
    await sleep(2500);
    ctx.onProgress?.("Developing the plate", 30 + Math.min(55, i * 2));
    const poll = await fetch(`${ctx.nativeBase}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${ctx.key}` },
    }).catch(() => null);
    if (!poll || !poll.ok) continue;
    const t = await poll.json().catch(() => null);
    const status: string | undefined = t?.output?.task_status;
    if (status === "SUCCEEDED") {
      const url: string | undefined = t?.output?.results?.[0]?.url;
      if (url) return url;
      throw new Error("DashScope task succeeded but returned no image URL");
    }
    if (status && status !== "PENDING" && status !== "RUNNING") {
      throw new Error(`DashScope task ${status.toLowerCase()}: ${t?.output?.message ?? "no details"}`);
    }
  }
  throw new Error("DashScope task timed out after ~2 minutes");
}

/* --------------- route search: bases × models, with caching --------------- */

/** Known DashScope image models, best-first, for the blind cascade. */
const MODEL_CASCADE = [
  "qwen-image",
  "qwen-image-plus",
  "wanx2.1-t2i-plus",
  "wanx2.1-t2i-turbo",
  "wanx2.0-t2i-turbo",
  "flux-merged",
  "flux-schnell",
  "stable-diffusion-3.5-large",
];

/** Every base worth trying, in order (workspace first, generic intl last). */
function candidateBases(): string[] {
  const list: string[] = [];
  const push = (b?: string) => {
    if (!b) return;
    const clean = b.replace(/\/+$/, "");
    if (clean && !list.includes(clean)) list.push(clean);
  };
  push(env.VITE_DASHSCOPE_BASE_URL);
  push(`${dashscopeHost()}/compatible-mode/v1`);
  push(`${dashscopeHost()}/v1`); // some MaaS gateways expose /v1 without /compatible-mode
  push("https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
  return list;
}

const nativeFor = (base: string) => `${base.match(/^(https?:\/\/[^/]+)/)?.[1] ?? ""}/api/v1`;
const shortHost = (u: string) => u.replace(/^https?:\/\//, "").slice(0, 44);

interface RouteCache {
  base: string;
  model: string;
  ts: number;
}
const ROUTE_KEY = "editorial-ai:ds-route:v1";

function readRoute(): RouteCache | null {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RouteCache;
    return Date.now() - r.ts < 12 * 3_600_000 ? r : null;
  } catch {
    return null;
  }
}

function saveRoute(base: string, model: string) {
  try {
    localStorage.setItem(ROUTE_KEY, JSON.stringify({ base, model, ts: Date.now() }));
  } catch {
    /* private mode */
  }
}

/**
 * Search for a working base × model combination:
 *   1. cached winner (12h TTL) → 2. compatible-mode on every candidate base,
 *   preferred model first then a blind cascade → 3. a `/models` probe on the
 *   primary base → 4. the native async API with the same cascade.
 * A full trace is collected so failures explain themselves.
 */
async function generateOne(ctx: OneShot): Promise<string> {
  const diag: { last?: string } = {};
  const trace: string[] = [];
  const cached = readRoute();

  const basesRaw = cached ? [cached.base, ...candidateBases()] : candidateBases();
  const seen = new Set<string>();
  const bases = basesRaw.filter((b) => (seen.has(b) ? false : (seen.add(b), true)));

  let sawHttp = false;
  let attempts = 0;

  for (const base of bases) {
    const models: string[] =
      cached && cached.base === base ? [cached.model, ctx.model] : [ctx.model];
    for (const m of MODEL_CASCADE) if (!models.includes(m)) models.push(m);

    for (const model of models) {
      if (attempts >= 8) break;
      attempts += 1;
      ctx.onProgress?.(`Trying ${model}`, 14 + Math.min(30, attempts * 4));
      const r = await tryCompatible({ ...ctx, base, model }, diag);
      if ("url" in r) {
        saveRoute(base, model);
        return r.url;
      }
      if ("network" in r) {
        trace.push(`${shortHost(base)} · ${model} → unreachable`);
        break; // this base can't be reached at all — try the next one
      }
      sawHttp = true;
      trace.push(`${shortHost(base)} · ${model} → ${r.status}`);
      if (r.status === 401 || r.status === 403) {
        throw new Error(`DashScope rejected the API key (HTTP ${r.status}). Rotate or replace it in the console.`);
      }
      if (r.status === 429) await sleep(4_000);
    }

    // Probe the primary base's model list before moving on.
    if (base === bases[0]) {
      const available = await probeModels(base, ctx.key);
      if (available?.length) {
        const alt = pickAvailableImageModel(available, ctx.model);
        if (alt) {
          const r = await tryCompatible({ ...ctx, base, model: alt }, diag);
          if ("url" in r) {
            saveRoute(base, alt);
            return r.url;
          }
          if ("status" in r) {
            sawHttp = true;
            trace.push(`${shortHost(base)} · ${alt} (probed) → ${r.status}`);
          }
        }
        const imageOnes = available.filter((m) => IMAGE_HINTS.some((h) => m.toLowerCase().includes(h)));
        if (!imageOnes.length) {
          diag.last = `workspace lists ${available.length} models but none look image-capable (${available.slice(0, 5).join(", ")}${available.length > 5 ? "…" : ""})`;
        }
      }
    }
  }

  // Route B — native DashScope async API, same cascade, two bases.
  const tried = new Set<string>();
  for (const base of bases.slice(0, 2)) {
    const nativeBase = nativeFor(base);
    for (const model of [ctx.model, ...MODEL_CASCADE.slice(0, 3)]) {
      const combo = `${nativeBase}|${model}`;
      if (tried.has(combo)) continue;
      tried.add(combo);
      try {
        const url = await nativeGenerate({ ...ctx, nativeBase, model }, diag);
        saveRoute(base, model);
        return url;
      } catch (err) {
        if (isNetworkError(err)) {
          trace.push(`${shortHost(nativeBase)} · ${model} → unreachable`);
          break;
        }
        const msg = err instanceof Error ? err.message : String(err);
        trace.push(`${shortHost(nativeBase)} · ${model} → ${msg.slice(0, 70)}`);
        if (/401|403|InvalidApiKey|AccessDenied/i.test(msg)) {
          throw new Error(`DashScope rejected the API key — rotate or replace it in the console.`);
        }
      }
    }
  }

  // Nothing responded over HTTP at all → browser can't reach the endpoint
  // (CORS / offline). Throwing a TypeError hands the shoot to the studio engine.
  if (!sawHttp) throw new TypeError("Failed to fetch");

  console.warn("[EditorialAI] DashScope route trace:", trace);
  const hint = /none look image-capable/.test(diag.last ?? "")
    ? "Your workspace exposes no image models yet — enable Qwen-Image or Wanx 2.1 in Model Studio → Models, then shoot again."
    : "No DashScope route accepted the job — the image model likely needs enabling in your workspace.";
  throw new Error(`${hint} [${trace.slice(0, 3).join(" · ")}]`);
}

export function qwenProvider(engine: string): ImageProvider {
  const spec = DASHSCOPE_MODELS[engine] ?? DASHSCOPE_MODELS["wanx-turbo"];
  return {
    id: engine,
    label: spec.model,

    async generate(req, onProgress) {
      const baseCtx = {
        key: dashscopeKey(),
        base: dashscopeBase(),
        nativeBase: dashscopeNativeBase(),
        family: spec.family,
        prompt: req.prompt,
        negative: req.negative,
        onProgress,
      };

      const images: ProviderImage[] = [];
      for (let i = 0; i < req.count; i++) {
        // Upscaling on Wanx Turbo promotes to the Plus model for a true quality lift.
        const model =
          req.quality === "hq" && spec.model === "wanx2.1-t2i-turbo" ? "wanx2.1-t2i-plus" : spec.model;
        const size = dashScopeSize(spec.family, req.ratio, req.quality === "hq");
        const seed = req.seed + i;

        onProgress?.(
          req.count > 1 ? `Rendering plate ${i + 1} of ${req.count} · ${model}` : `Exposing the frame · ${model}`,
          14 + (i / req.count) * 50
        );

        try {
          const url = await generateOne({ ...baseCtx, model, size, seed });
          images.push({ url, seed });
        } catch (err) {
          if (isNetworkError(err)) {
            // Endpoint unreachable from the browser (CORS/offline) — serve a
            // curated stand-in plate so the shoot lands beautifully and fast.
            console.warn("[EditorialAI] DashScope unreachable — curated stand-ins take over.", err);
            const remaining = await studioProvider.generate({ ...req, curatedOnly: true }, onProgress);
            return [...images, ...remaining.slice(images.length).map((img) => ({ ...img, fallback: true }))];
          }
          throw err;
        }
        if (i < req.count - 1) await sleep(900);
      }
      onProgress?.("Printing", 100);
      return images;
    },
  };
}
