# RSFASHIONPHOTO — The AI Fashion Editorial Studio

A production-ready single-page studio for generating high-end fashion editorial
photography with AI. Cast the muse, scout the setting, style the look, and develop
plates in a lightbox — with a full archive, comparison view, prompt engineering,
batch generation and one-parameter reshoots.

Built with **React 18 + Vite + TypeScript**, **Tailwind CSS v4** (shadcn-style
primitives in `src/components/ui.tsx`), **Zustand**, **Framer Motion** and
**Lucide React**.

---

## Quick start

```bash
npm install
npm run dev        # local development
npm run build      # production build → dist/
npm run typecheck  # strict TS check
```

Out of the box the app runs on the **studio engine** — every plate is rendered
live from your exact prompt via the free [Pollinations](https://pollinations.ai)
image API (Flux model, no key required), so each generation is a unique image.
If the live engine is unreachable, it falls back to a bundled editorial plate
pool so the studio never dead-ends.

---

## Plugging in a direct image API

The image layer lives in `src/lib/api/`:

```
src/lib/api/
├── index.ts       # resolveProvider() — routes engines → providers (studio engine default)
├── mock.ts        # ImageProvider interface + the studio engine (Pollinations + offline fallback)
└── providers.ts   # DALL·E 3, Flux (BFL), and custom-endpoint implementations
```

When credentials are present, engines are routed to their direct APIs; without
keys they use the free studio engine. Either way, upscales are real re-renders
at higher resolution and every seed/prompt combination is reproducible.

All providers implement the same `ImageProvider` interface, so swapping engines
never touches the UI:

```ts
interface ImageProvider {
  id: string;
  label: string;
  generate(req: GenerateRequest, onProgress?: ProgressFn): Promise<ProviderImage[]>;
}
```

### 1. Environment variables

Create a `.env.local` in the project root:

```bash
# Qwen platform — DashScope / Alibaba Cloud Model Studio (Qwen-Image, Wanx 2.1,
# plus Flux and SD 3.5 through the same key).
# The key lives only in .env.local (git-ignored) — nothing is hardcoded in source.
VITE_DASHSCOPE_API_KEY=sk-...
# Optional — defaults to the ap-southeast-1 MaaS workspace gateway.
# Other accounts — intl: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
# China mainland: https://dashscope.aliyuncs.com/compatible-mode/v1
VITE_DASHSCOPE_BASE_URL=https://ws-ou063af90w6dlklj.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
# Optional — deploy worker/dashscope-proxy.js to route around browser CORS (see below)
VITE_DASHSCOPE_RELAY=https://rsfashionphoto-dashscope.<you>.workers.dev

# DALL·E 3 (OpenAI)
VITE_OPENAI_API_KEY=sk-...

# Flux 1.1 Pro / Flux Dev / SD3.5 via BFL
VITE_BFL_API_KEY=...

# Any custom endpoint (POST {prompt, negative_prompt, seed, count, width, height}
# → { images: [url] } or { url })
VITE_CUSTOM_ENDPOINT=https://your-api.example.com/generate
```

### Qwen-Image 3.0, Wan 2.7 & Z-Image (DashScope)

`Qwen-Max` / `Qwen 3.x` are **text** models — image generation on the Qwen
platform is served by **Qwen-Image 3.0**, **Wan 2.7** (通义万相) and
**Z-Image Turbo**. All three are enabled by default in the Singapore region —
verify in the [Model Experience Center](https://modelstudio.console.alibabacloud.com/?tab=dashboard#/efm/model_experience_center/vision?currentTab=imageGenerate).
`src/lib/api/dashscope.ts` implements the current native API contracts:

| Studio engine             | DashScope models tried (in order)                       | Route                                            |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| Qwen-Image 3.0 Pro        | `qwen-image-3.0-pro` → `qwen-image-3.0` → `qwen-image-plus` → `qwen-image` | sync `multimodal-generation/generation` |
| Wan 2.7 Pro               | `wan2.7-image-pro` → `wan2.6-image` → `wanx2.1-t2i-plus` | async `image-generation/generation` + task polling |
| Z-Image Turbo (fast)      | `z-image-turbo` → `wan2.7-image` → `wanx2.1-t2i-turbo`  | OpenAI-compatible `/images/generations`, then async |
| Flux Pro / Dev, SD 3.5    | `flux-merged` / `flux-dev` / `stable-diffusion-3.5-large` | OpenAI-compatible (same key)                   |

The provider searches workspace gateway → international endpoint, caches the
winning model + route for 12 h, and understands per-model size rules
(Qwen fixed presets, Wan 2.7 `thinking_mode`, legacy Wanx sizes).

**Browser CORS:** DashScope sends no CORS headers, so a purely client-side
call is blocked — the studio then serves a curated stand-in plate and explains
why. To render with your key from the browser, deploy the relay:

```bash
npm i -g wrangler && wrangler login
wrangler deploy worker/dashscope-proxy.js --name rsfashionphoto-dashscope
```

then set `VITE_DASHSCOPE_RELAY=https://rsfashionphoto-dashscope.<you>.workers.dev`
in `.env.local` and rebuild. For production, generate server-side (the provider
is plain `fetch` — lift it into an API route) so the key never ships to the
browser.

**Keep in mind:**

- The key is read from `VITE_DASHSCOPE_API_KEY` in `.env.local` (git-ignored).
  Note that any `VITE_` variable is still inlined into the client bundle at
  build time — for long-lived keys, keep the credential server-side in the
  relay worker (`wrangler secret put DASHSCOPE_API_KEY`).
- DashScope image URLs expire after ~24 hours, so download plates you want to
  keep (PNG / high-res buttons in the lightbox).
- Failed generations are never billed; new accounts get free image quota.

### 2. Engine → provider map

| Studio engine       | Live provider                     | Key                    |
| ------------------- | --------------------------------- | ---------------------- |
| Qwen-Image 3.0 Pro  | DashScope `qwen-image-3.0-pro`    | `VITE_DASHSCOPE_API_KEY` |
| Wan 2.7 Pro / Z-Image Turbo | DashScope `wan2.7-image-pro` / `z-image-turbo` | `VITE_DASHSCOPE_API_KEY` |
| Flux 1.1 Pro        | `api.bfl.ml/v1/flux-pro-1.1`      | `VITE_BFL_API_KEY`     |
| Flux Dev            | `api.bfl.ml/v1/flux-dev`          | `VITE_BFL_API_KEY`     |
| Stable Diffusion 3.5| `api.bfl.ml/v1/sd3.5`             | `VITE_BFL_API_KEY`     |
| DALL·E 3            | `api.openai.com/v1/images/...`    | `VITE_OPENAI_API_KEY`  |
| Midjourney v6 style | studio engine (no official API — route via a relay or swap the provider) | — |
| Custom endpoint     | your POST endpoint                | `VITE_CUSTOM_ENDPOINT` |

### 3. Adding a new provider

Implement `ImageProvider` in `providers.ts` and add one case to
`resolveProvider()` in `index.ts`. Nothing else changes.

---

## Prompt construction

`src/lib/promptBuilder.ts` assembles the brief modularly:

```
Fashion editorial photograph of {muse}, {expression}, wearing {outfit}, {pose},
set in {location}, {lighting}, shot on {camera}, in the style of {reference},
hyper-detailed skin texture, refined colour grade, … 8k [--ar … | (ratio frame)]
```

Empty fields are skipped; the Midjourney-style engine appends `--ar/--style/--seed`
flags, others get a plain frame tag. The **Free-write** mode (section 07, "The
Brief") bypasses composition entirely for full prompt-engineering control.

---

## Feature map

- **Direction form** — muse, expression, setting, outfit, pose, lighting,
  camera/lens, visual aspect-ratio picker, engine selector, style reference,
  negative prompt, seed + lock, curated presets throughout
- **The Lightbox** — large preview, darkroom loading stages with progress,
  PNG / high-res download, copy prompt, "Use as Base" reference locking,
  quick reshoots (pose / outfit / location / expression), regenerate,
  upscale, vary subtly / strongly, expandable full prompt
- **Archive** — persistent history (localStorage via Zustand persist) with
  favorites, delete, reopen-into-form, two-step clear
- **Advanced** — live prompt preview + free-write prompt engineering, batch
  generation (×2/×4/×6/×8), side-by-side comparison slider, project JSON export,
  dark/light theme, `⌘/Ctrl + Enter` to shoot

## Project structure

```
src/
├── components/   # Header, ControlPanel, PromptPreview, ResultsPanel,
│                 # QuickActionModal, CompareOverlay, HistoryDrawer,
│                 # FlickrDialog, Toasts, ui
├── hooks/        # useGenerate (orchestration), useKeyboardShortcuts
├── lib/          # promptBuilder, presets, utils, flickr, api/
├── stores/       # editorial (persisted), ui
├── types/        # FormState, Generation, …
└── App.tsx

worker/
└── dashscope-proxy.js   # optional DashScope CORS relay
```

---

## Posting plates to Flickr

The lightbox has a **Flickr** button under the active plate. One click posts the
plate to your photostream as a public photo, renamed `IMG_xxxx` (random number),
with a fitting title, a written editorial description, and 30 tags composed from
the plate's own direction (muse, wardrobe, scene, lighting, camera, vibe).

Everything runs **in the browser — no relay to deploy, nothing to set up.**
Your API key and secret are stored only in your browser (localStorage). The
secret is never transmitted: it's used locally to compute an OAuth 1.0a
HMAC-SHA1 signature (via the Web Crypto API), and only that signature is sent
to Flickr.

One technical note: Flickr's OAuth and upload endpoints send no CORS headers,
so a web page can never call them directly. The app therefore routes each
signed request through a public CORS relay (`corsproxy.io`, with a fallback).
The relay forwards your request to Flickr but **never sees your key or secret**
— only the already-signed request and, when posting, the photo itself.

Setup, one time:

1. Click **Flickr** under a plate → paste your **API key** and **API secret**
   (from the Flickr App Garden) → **Save credentials**.
2. **Connect to Flickr** → a tab opens → press *"OK, I'll authorize it"* →
   Flickr shows a 9-digit code → paste it back and press **Verify & connect**.
3. Done. Every later click of the **Flickr** button publishes immediately.

You can **Remove stored credentials** or **Disconnect** from the same panel at
any time.
