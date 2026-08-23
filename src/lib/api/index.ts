import type { EngineId } from "../../types";
import { mockProvider, type ImageProvider } from "./mock";
import { bflProvider, customProvider, openaiProvider, qwenProvider } from "./providers";

export type { ImageProvider, ProviderImage, GenerateRequest, ProgressFn } from "./mock";

const env = import.meta.env as Record<string, string | undefined>;

/**
 * Route an engine to its direct provider when credentials exist,
 * otherwise use the studio engine — live prompt-driven renders via the
 * free Pollinations API, with bundled plates as an offline fallback.
 *
 * Priority per engine family:
 *   Qwen / DashScope engines  → VITE_DASHSCOPE_API_KEY → studio engine
 *   DALL·E 3                  → VITE_OPENAI_API_KEY    → studio engine
 *   Flux / SD                 → VITE_BFL_API_KEY → VITE_DASHSCOPE_API_KEY → studio engine
 *   Custom                    → VITE_CUSTOM_ENDPOINT   → studio engine
 */
export function resolveProvider(engine: EngineId): ImageProvider {
  switch (engine) {
    case "qwen-image":
    case "wanx-turbo":
    case "wanx-plus":
      return env.VITE_DASHSCOPE_API_KEY ? qwenProvider(engine) : mockProvider;
    case "dalle3":
      return env.VITE_OPENAI_API_KEY ? openaiProvider : mockProvider;
    case "flux-pro":
    case "flux-dev":
    case "sd3":
      if (env.VITE_BFL_API_KEY) return bflProvider(engine);
      if (env.VITE_DASHSCOPE_API_KEY) return qwenProvider(engine);
      return mockProvider;
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
    case "qwen-image":
    case "wanx-turbo":
    case "wanx-plus":
      return "Add VITE_DASHSCOPE_API_KEY to shoot with Qwen-Image / Wanx on DashScope — currently rendering via the free studio engine.";
    case "dalle3":
      return "Rendering live via the free studio engine (Pollinations) — add VITE_OPENAI_API_KEY for DALL·E 3.";
    case "flux-pro":
    case "flux-dev":
    case "sd3":
      return "Rendering live via the free studio engine — add VITE_BFL_API_KEY or VITE_DASHSCOPE_API_KEY for direct Flux / SD renders.";
    case "custom":
      return "Rendering live via the free studio engine — set VITE_CUSTOM_ENDPOINT to route to your own API.";
    case "mj6":
      return "Midjourney-style plates are rendered by the free studio engine (Midjourney has no official API).";
    default:
      return null;
  }
}
