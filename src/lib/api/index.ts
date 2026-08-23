import type { EngineId } from "../../types";
import { mockProvider, type ImageProvider } from "./mock";
import { bflProvider, customProvider, openaiProvider } from "./providers";

export type { ImageProvider, ProviderImage, GenerateRequest, ProgressFn } from "./mock";

const env = import.meta.env as Record<string, string | undefined>;

/**
 * Route an engine to its live provider when credentials exist,
 * otherwise fall back to the mock darkroom so the studio always works.
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
  if (!p.mock) return null;
  switch (engine) {
    case "dalle3":
      return "Mock darkroom — set VITE_OPENAI_API_KEY in .env.local to shoot live with DALL·E 3.";
    case "flux-pro":
    case "flux-dev":
    case "sd3":
      return "Mock darkroom — set VITE_BFL_API_KEY in .env.local to shoot live with Flux.";
    case "custom":
      return "Mock darkroom — set VITE_CUSTOM_ENDPOINT in .env.local to use your own API.";
    case "mj6":
      return "Mock darkroom — Midjourney style is simulated locally (no official API).";
    default:
      return null;
  }
}
