import type { EngineId } from "../../types";
import { mockProvider, type ImageProvider } from "./mock";
import { bflProvider, customProvider, openaiProvider } from "./providers";

export type { ImageProvider, ProviderImage, GenerateRequest, ProgressFn } from "./mock";

const env = import.meta.env as Record<string, string | undefined>;

/**
 * Route an engine to its direct provider when credentials exist,
 * otherwise use the studio engine — live prompt-driven renders via the
 * free Pollinations API, with bundled plates as an offline fallback.
 */
export function resolveProvider(engine: EngineId): ImageProvider {
  switch (engine) {
    case "dalle3":
      return env.VITE_OPENAI_API_KEY ? openaiProvider : mockProvider;
    case "flux-pro":
    case "flux-dev":
    case "sd3":
      return env.VITE_BFL_API_KEY ? bflProvider(engine) : mockProvider;
    case "custom":
      return env.VITE_CUSTOM_ENDPOINT ? customProvider : mockProvider;
    case "mj6":
      return mockProvider; // Midjourney has no official API — mock or route via a relay.
    default:
      return mockProvider;
  }
}

export function providerNotice(engine: EngineId): string | null {
  const p = resolveProvider(engine);
  if (!p.mock) return null; // routed to a direct API via env keys
  switch (engine) {
    case "dalle3":
      return "Rendering live via the free studio engine (Pollinations · sana) — add VITE_OPENAI_API_KEY for DALL·E 3, or VITE_POLLINATIONS_TOKEN for Flux.";
    case "flux-pro":
    case "flux-dev":
    case "sd3":
      return "Rendering live via the free studio engine — the anonymous tier serves Pollinations' sana model; add VITE_POLLINATIONS_TOKEN to unlock flux/turbo, or VITE_BFL_API_KEY for the direct Flux API.";
    case "custom":
      return "Rendering live via the free studio engine — set VITE_CUSTOM_ENDPOINT to route to your own API.";
    case "mj6":
      return "Midjourney-style plates are rendered by the free studio engine (Midjourney has no official API).";
    default:
      return null;
  }
}
