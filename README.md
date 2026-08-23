# EditorialAI — The AI Fashion Editorial Studio

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
# DALL·E 3 (OpenAI)
VITE_OPENAI_API_KEY=sk-...

# Flux 1.1 Pro / Flux Dev / SD3.5 via BFL
VITE_BFL_API_KEY=...

# Any custom endpoint (POST {prompt, negative_prompt, seed, count, width, height}
# → { images: [url] } or { url })
VITE_CUSTOM_ENDPOINT=https://your-api.example.com/generate
```

`resolveProvider(engine)` automatically uses the direct provider when its key is
present, and otherwise uses the free studio engine (the UI surfaces a one-time
toast telling you which route is active). Keys are read at build time via
`import.meta.env` — for a real deployment, proxy requests through a server so
keys are never shipped to the browser.

### 2. Engine → provider map

| Studio engine       | Live provider                     | Key                    |
| ------------------- | --------------------------------- | ---------------------- |
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
│                 # QuickActionModal, CompareOverlay, HistoryDrawer, Toasts, ui
├── hooks/        # useGenerate (orchestration), useKeyboardShortcuts
├── lib/          # promptBuilder, presets, utils, api/
├── stores/       # editorial (persisted), ui
├── types/        # FormState, Generation, …
└── App.tsx
```
