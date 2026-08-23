import type { GenerateRequest, ImageProvider, ProviderImage } from "./mock";
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
