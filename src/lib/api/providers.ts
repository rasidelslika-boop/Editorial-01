import { liveDimensions, studioProvider, type GenerateRequest, type ImageProvider, type ProviderImage } from "./mock";
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
 * Endpoint base. DashScope does not send browser CORS headers, so direct
 * client calls are usually blocked — point `VITE_DASHSCOPE_RELAY` at the
 * relay worker from `/worker` (README) to route around that.
 */
function dashscopeBase(): string {
  const relay = env.VITE_DASHSCOPE_RELAY;
  if (relay) return relay.replace(/\/+$/, "");
  // Baked default: the owner's ap-southeast-1 MaaS workspace gateway.
  // Generic endpoints for other accounts:
  //   intl:   https://dashscope-intl.aliyuncs.com/compatible-mode/v1
  //   china:  https://dashscope.aliyuncs.com/compatible-mode/v1
  return (
    env.VITE_DASHSCOPE_BASE_URL ??
    "https://ws-ou063af90w6dlklj.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/+$/, "");
}

export function qwenProvider(engine: string): ImageProvider {
  const spec = DASHSCOPE_MODELS[engine] ?? DASHSCOPE_MODELS["wanx-turbo"];
  return {
    id: engine,
    label: spec.model,

    async generate(req, onProgress) {
      const key = dashscopeKey();
      const base = dashscopeBase();

      // Upscaling on Wanx Turbo promotes to the Plus model for a true quality lift.
      const model =
        req.quality === "hq" && spec.model === "wanx2.1-t2i-turbo" ? "wanx2.1-t2i-plus" : spec.model;
      const size = dashScopeSize(spec.family, req.ratio, req.quality === "hq");

      const images: ProviderImage[] = [];
      for (let i = 0; i < req.count; i++) {
        onProgress?.(`Rendering plate ${i + 1} of ${req.count} · ${model}`, 18 + (i / req.count) * 55);

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90_000);
        let res: Response;
        try {
          res = await fetch(`${base}/images/generations`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              prompt: req.prompt,
              ...(spec.family === "wanx" || spec.family === "qwen" ? { negative_prompt: req.negative } : {}),
              size,
              n: 1,
              seed: req.seed + i,
            }),
            signal: ctrl.signal,
          });
        } catch (err) {
          clearTimeout(timer);
          if (err instanceof DOMException && err.name === "AbortError") {
            throw new Error("DashScope render timed out after 90s");
          }
          // Almost always browser CORS — hand the shoot to the studio engine so it still lands.
          console.warn("[EditorialAI] DashScope direct call failed (likely CORS). Falling back to studio engine.", err);
          const fallback = await studioProvider.generate(req, onProgress);
          return fallback.map((img) => ({ ...img, fallback: true }));
        } finally {
          clearTimeout(timer);
        }

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`DashScope error ${res.status}: ${body.slice(0, 220)}`);
        }
        const data = await res.json();
        const url: string | undefined = data?.data?.[0]?.url;
        if (!url) throw new Error("DashScope returned no image URL");
        images.push({ url, seed: req.seed + i });
      }
      onProgress?.("Printing", 100);
      return images;
    },
  };
}
