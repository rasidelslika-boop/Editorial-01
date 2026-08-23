import { liveDimensions, studioProvider } from "./mock";
import type { GenerateRequest, ImageProvider, ProgressFn, ProviderImage } from "./mock";

const env = import.meta.env as Record<string, string | undefined>;

/* ------------------------------------------------------------------ */
/*  Qwen platform — DashScope (Alibaba Cloud Model Studio), rewritten  */
/*  against the current Text-to-Image API:                             */
/*    · Qwen-Image 3.0 — sync,  POST /api/v1/services/aigc/            */
/*      multimodal-generation/generation (messages shape)              */
/*    · Wan 2.7        — async, POST /api/v1/services/aigc/            */
/*      image-generation/generation + task polling                     */
/*    · Z-Image Turbo  — via the OpenAI-compatible endpoint            */
/*  Base URL: https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com   */
/* ------------------------------------------------------------------ */

/**
 * The DashScope key comes exclusively from the environment —
 * `VITE_DASHSCOPE_API_KEY` in `.env.local` (never committed to git).
 *
 * ⚠ Any VITE_ variable is inlined into the client bundle at build time, so
 *   for long-lived keys deploy the relay worker (see README) and keep the
 *   credential server-side.
 */
export function dashscopeKey(): string {
  return (env.VITE_DASHSCOPE_API_KEY ?? "").trim();
}

export function hasDashscopeKey(): boolean {
  return dashscopeKey().length > 0;
}

const WS_HOST = "https://ws-ou063af90w6dlklj.ap-southeast-1.maas.aliyuncs.com";
const INTL_HOST = "https://dashscope-intl.aliyuncs.com";

/** Hosts to try, in order: relay → owner workspace → custom → generic intl. */
function hostList(): string[] {
  const hosts: string[] = [];
  const relay = env.VITE_DASHSCOPE_RELAY?.replace(/\/+$/, "");
  if (relay) hosts.push(relay);
  hosts.push(WS_HOST);
  const custom = env.VITE_DASHSCOPE_BASE_URL?.match(/^https?:\/\/[^/]+/)?.[0]?.replace(/\/+$/, "");
  if (custom && !hosts.includes(custom)) hosts.push(custom);
  if (!hosts.includes(INTL_HOST)) hosts.push(INTL_HOST);
  return hosts;
}

/* ------------------------------ Model catalogue ------------------------------ */

type Family = "qwen3" | "qwen-fixed" | "wan27" | "wan27-pro" | "wanx21" | "z" | "compat";
type Route = "mm-sync" | "img-async" | "compat";

interface Candidate {
  id: string;
  family: Family;
  routes: Route[];
}

const ENGINE_CANDIDATES: Record<string, Candidate[]> = {
  "qwen-image": [
    { id: "qwen-image-3.0-pro", family: "qwen3", routes: ["mm-sync"] },
    { id: "qwen-image-3.0", family: "qwen3", routes: ["mm-sync"] },
    { id: "qwen-image-plus", family: "qwen-fixed", routes: ["mm-sync", "compat"] },
    { id: "qwen-image", family: "qwen-fixed", routes: ["mm-sync", "compat"] },
  ],
  "wanx-turbo": [
    { id: "z-image-turbo", family: "z", routes: ["compat", "img-async"] },
    { id: "wan2.7-image", family: "wan27", routes: ["img-async"] },
    { id: "wanx2.1-t2i-turbo", family: "wanx21", routes: ["img-async", "compat"] },
  ],
  "wanx-plus": [
    { id: "wan2.7-image-pro", family: "wan27-pro", routes: ["img-async"] },
    { id: "wan2.6-image", family: "wan27", routes: ["img-async"] },
    { id: "wanx2.1-t2i-plus", family: "wanx21", routes: ["img-async", "compat"] },
  ],
  "flux-pro": [{ id: "flux-merged", family: "compat", routes: ["compat"] }],
  "flux-dev": [{ id: "flux-dev", family: "compat", routes: ["compat"] }],
  sd3: [{ id: "stable-diffusion-3.5-large", family: "compat", routes: ["compat"] }],
};

/* --------------------------- Sizes per model family --------------------------- */

/** qwen-image-max / plus only accept these five presets — map the ratio onto them. */
const QWEN_PRESETS: [number, number][] = [
  [1664, 928],
  [1472, 1104],
  [1328, 1328],
  [1104, 1472],
  [928, 1664],
];

function sizeFor(family: Family, ratio: string, hq: boolean): string {
  const [rw, rh] = ratio.split(":").map(Number);
  const target = (rw || 1) / (rh || 1);
  const dims = liveDimensions(ratio, 1024);
  const fit = (maxSide: number, min: number, max: number, mult: number) => {
    const d = liveDimensions(ratio, maxSide);
    const r = (n: number) => Math.min(max, Math.max(min, Math.round(n / mult) * mult));
    return `${r(d.width)}*${r(d.height)}`;
  };

  switch (family) {
    case "qwen3": // 512*512 – 2048*2048, free sizes
      return fit(hq ? 2048 : 1328, 512, 2048, 32);
    case "qwen-fixed": {
      const best = QWEN_PRESETS.reduce((a, b) =>
        Math.abs(b[0] / b[1] - target) < Math.abs(a[0] / a[1] - target) ? b : a
      );
      return `${best[0]}*${best[1]}`;
    }
    case "wan27-pro": // 768*768 – 4096*4096
      return fit(hq ? 2880 : 2048, 768, 4096, 64);
    case "wan27": // 768*768 – 2048*2048
      return fit(2048, 768, 2048, 64);
    case "wanx21": // three documented sizes only
      if (Math.abs(target - 1) < 0.01) return "1024*1024";
      return target > 1 ? "1280*720" : "720*1280";
    case "z":
      return fit(hq ? 2048 : 1328, 512, 2048, 64);
    default:
      return `${dims.width}*${dims.height}`;
  }
}

/* ------------------------------- Route plumbing ------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Terminal errors — do not cascade to other models (moderation, auth, quota). */
class TerminalError extends Error {}

function checkBody(body: string) {
  if (body.includes("DataInspectionFailed") || body.includes("inappropriate")) {
    throw new TerminalError("Prompt blocked by content moderation — adjust the brief and reshoot.");
  }
  if (body.includes("InvalidApiKey") || body.includes("AccessDenied.Unpurchased")) {
    throw new TerminalError("DashScope rejected the API key — check it in Model Studio → API keys.");
  }
  if (body.includes("AllocationQuota") || body.includes("InsufficientBalance")) {
    throw new TerminalError("DashScope quota exhausted — top up the workspace or wait for the quota reset.");
  }
}

function extractImage(data: unknown): string | null {
  const d = data as {
    output?: {
      choices?: { message?: { content?: { image?: string }[] } }[];
      results?: { url?: string }[];
    };
    data?: { url?: string }[];
  };
  const content = d?.output?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    const hit = content.find((c) => typeof c?.image === "string");
    if (hit?.image) return hit.image;
  }
  const legacy = d?.output?.results?.[0]?.url;
  if (legacy) return legacy;
  const compat = d?.data?.[0]?.url;
  if (compat) return compat;
  return null;
}

interface Shot {
  key: string;
  host: string;
  candidate: Candidate;
  prompt: string;
  negative?: string;
  size: string;
  seed: number;
  onProgress?: ProgressFn;
}

async function postJson(url: string, key: string, body: unknown, headers: Record<string, string>, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      checkBody(text);
      throw new HttpError(res.status, `HTTP ${res.status} — ${text.slice(0, 180)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError(502, "endpoint returned a non-JSON payload");
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Qwen-Image — synchronous multimodal-generation call. */
async function routeMmSync(shot: Shot): Promise<string> {
  const data = await postJson(
    `${shot.host}/api/v1/services/aigc/multimodal-generation/generation`,
    shot.key,
    {
      model: shot.candidate.id,
      input: { messages: [{ role: "user", content: [{ text: shot.prompt }] }] },
      parameters: {
        prompt_extend: false,
        size: shot.size,
        seed: shot.seed,
        ...(shot.negative && shot.candidate.family !== "wan27" && shot.candidate.family !== "wan27-pro"
          ? { negative_prompt: shot.negative }
          : {}),
      },
    },
    {},
    150_000
  );
  const url = extractImage(data);
  if (!url) throw new HttpError(502, "response carried no image URL");
  return url;
}

/** Wan — asynchronous image-generation task with polling. */
async function routeImgAsync(shot: Shot): Promise<string> {
  const isLegacy = shot.candidate.family === "wanx21";
  const input = isLegacy
    ? { prompt: shot.prompt, ...(shot.negative ? { negative_prompt: shot.negative } : {}) }
    : { messages: [{ role: "user", content: [{ text: shot.prompt }] }] };
  const parameters = isLegacy
    ? { size: shot.size, n: 1, seed: shot.seed, prompt_extend: true }
    : { size: shot.size, n: 1, watermark: false, ...(shot.candidate.family === "z" ? {} : { thinking_mode: true }) };

  const data = await postJson(
    `${shot.host}/api/v1/services/aigc/image-generation/generation`,
    shot.key,
    { model: shot.candidate.id, input, parameters },
    { "X-DashScope-Async": "enable" },
    45_000
  );
  const taskId: string | undefined = (data as { output?: { task_id?: string } })?.output?.task_id;
  if (!taskId) throw new HttpError(502, "task accepted without a task id");

  // Poll — 3s cadence, ~2.5 min ceiling, per DashScope's guidance.
  for (let i = 0; i < 50; i++) {
    await sleep(3000);
    shot.onProgress?.("Developing the plate", 26 + Math.min(58, i * 1.4));
    let poll: Response;
    try {
      poll = await fetch(`${shot.host}/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${shot.key}` },
      });
    } catch {
      continue;
    }
    if (!poll.ok) continue;
    const t = await poll.json().catch(() => null);
    const output = (t as { output?: Record<string, unknown> })?.output ?? {};
    const status = String(output.task_status ?? "");
    if (status === "SUCCEEDED") {
      const url = extractImage(t);
      if (url) return url;
      throw new HttpError(502, "task succeeded without an image URL");
    }
    if (status && status !== "PENDING" && status !== "RUNNING") {
      checkBody(JSON.stringify(output));
      throw new HttpError(422, `task ${status.toLowerCase()}: ${String(output.message ?? "no details").slice(0, 160)}`);
    }
  }
  throw new HttpError(408, "task timed out after ~2.5 minutes");
}

/** OpenAI-compatible endpoint — Z-Image Turbo, legacy models, Flux/SD. */
async function routeCompat(shot: Shot): Promise<string> {
  const data = await postJson(
    `${shot.host}/compatible-mode/v1/images/generations`,
    shot.key,
    {
      model: shot.candidate.id,
      prompt: shot.prompt,
      ...(shot.negative ? { negative_prompt: shot.negative } : {}),
      size: shot.size,
      n: 1,
      seed: shot.seed,
    },
    {},
    120_000
  );
  const url = extractImage(data);
  if (!url) throw new HttpError(502, "response carried no image URL");
  return url;
}

const ROUTES: Record<Route, (shot: Shot) => Promise<string>> = {
  "mm-sync": routeMmSync,
  "img-async": routeImgAsync,
  compat: routeCompat,
};

/* --------------------------- Winning-route cache --------------------------- */

interface RouteMemory {
  ts: number;
  hostIdx: number;
  candidate: string;
  route: Route;
}

const CACHE_KEY = "editorial-ai-dashscope-route";

function readMemory(): RouteMemory | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const mem = JSON.parse(raw) as RouteMemory;
    if (Date.now() - mem.ts > 12 * 3600_000) return null;
    return mem;
  } catch {
    return null;
  }
}

function writeMemory(mem: Omit<RouteMemory, "ts">) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...mem, ts: Date.now() }));
  } catch {
    /* private mode */
  }
}

/* ------------------------------ Orchestration ------------------------------ */

function isNetwork(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return false;
  return err instanceof TypeError;
}

async function generateOne(req: GenerateRequest, seed: number, onProgress?: ProgressFn): Promise<string> {
  const hosts = hostList();
  const mem = readMemory();
  const key = dashscopeKey();

  // Cached winner jumps the queue.
  const orderedCandidates = [...ENGINE_CANDIDATES[req.engine ?? "qwen-image"] ?? []];
  if (mem?.candidate) {
    const idx = orderedCandidates.findIndex((c) => c.id === mem.candidate);
    if (idx > 0) orderedCandidates.unshift(...orderedCandidates.splice(idx, 1));
  }
  const orderedHosts = hosts.map((h, i) => ({ host: h, idx: i }));
  if (mem && mem.hostIdx > 0 && mem.hostIdx < orderedHosts.length) {
    orderedHosts.unshift(...orderedHosts.splice(mem.hostIdx, 1));
  }

  const unreachable = new Set<number>();
  const dead = new Set<string>();
  const diag: string[] = [];

  for (const cand of orderedCandidates) {
    const routes =
      mem?.candidate === cand.id && mem.route
        ? [mem.route, ...cand.routes.filter((r) => r !== mem.route)]
        : cand.routes;

    for (const route of routes) {
      for (const { host, idx } of orderedHosts) {
        if (unreachable.has(idx)) continue;
        if (dead.has(`${idx}:${cand.id}:${route}`)) continue;

        try {
          const url = await ROUTES[route]({
            key,
            host,
            candidate: cand,
            prompt: req.prompt,
            negative: req.negative,
            size: sizeFor(cand.family, req.ratio, req.quality === "hq"),
            seed,
            onProgress,
          });
          writeMemory({ hostIdx: idx, candidate: cand.id, route });
          console.info(`[EditorialAI] Rendered via ${cand.id} (${route}) @ ${host}`);
          return url;
        } catch (err) {
          if (err instanceof TerminalError) throw err;
          if (isNetwork(err)) {
            unreachable.add(idx);
            diag.push(`network/CORS @ ${host}`);
            continue;
          }
          if (err instanceof HttpError) {
            diag.push(`${cand.id}/${route}: ${err.message}`);
            console.warn(`[EditorialAI] ${cand.id} via ${route} failed: ${err.message}`);
            if (err.status === 401 || err.status === 403) throw err;
            dead.add(`${idx}:${cand.id}:${route}`);
            if (err.status === 404 || err.status === 405 || err.status === 400 || err.status === 422) continue;
            // 429/5xx on this combo — try the next host for the same combo
            continue;
          }
          diag.push(`${cand.id}/${route}: ${err instanceof Error ? err.message : "unknown"}`);
          dead.add(`${idx}:${cand.id}:${route}`);
        }
      }
    }
  }

  if (unreachable.size === orderedHosts.length) throw new TypeError("Failed to fetch");
  throw new Error(
    `No image model responded in this workspace. If Qwen-Image / Wan 2.7 / Z-Image aren't listed under Model Studio → Models, enable one there. (${diag.slice(0, 3).join(" · ")})`
  );
}

/* --------------------------------- Provider --------------------------------- */

export function qwenProvider(engine: string): ImageProvider {
  return {
    id: engine,
    label: (ENGINE_CANDIDATES[engine] ?? [])[0]?.id ?? "dashscope",

    async generate(req, onProgress) {
      const images: ProviderImage[] = [];

      for (let i = 0; i < req.count; i++) {
        const seed = req.seed + i;
        const primary = (ENGINE_CANDIDATES[engine] ?? [])[0]?.id ?? "dashscope";
        onProgress?.(
          req.count > 1 ? `Rendering plate ${i + 1} of ${req.count} · ${primary}` : `Exposing the frame · ${primary}`,
          12 + (i / req.count) * 46
        );

        try {
          const url = await generateOne({ ...req, seed }, seed, onProgress);
          images.push({ url, seed });
        } catch (err) {
          if (err instanceof TerminalError) throw err;
          if (isNetwork(err)) {
            // Every host unreachable from the browser — curated stand-ins take over.
            console.warn("[EditorialAI] DashScope unreachable from the browser — curated stand-ins take over.", err);
            const remaining = await studioProvider.generate({ ...req, curatedOnly: true }, onProgress);
            return [...images, ...remaining.slice(images.length).map((img) => ({ ...img, fallback: true }))];
          }
          throw err;
        }
        if (i < req.count - 1) await sleep(800);
      }
      onProgress?.("Printing", 100);
      return images;
    },
  };
}
