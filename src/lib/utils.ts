import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** FNV-1a — deterministic, good enough for plate selection. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function timeAgo(ts: number) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------ Download pipeline ------------------------------ */

/**
 * Public CORS relays used only as a last resort for saving plates. Most CDNs
 * (DashScope included) send no CORS headers, so a direct browser fetch is
 * blocked and the plate never reaches the Downloads folder — routing the bytes
 * through a relay fixes the save while keeping the image identical.
 */
const CORS_RELAYS: ((u: string) => string)[] = [
  // weserv.nl is a dedicated image proxy that reliably sends CORS headers and
  // returns the original bytes — the most dependable first hop for CDNs (like
  // DashScope's) that don't set Access-Control-Allow-Origin themselves.
  (u) => `https://images.weserv.nl/?url=${encodeURIComponent(u)}&output=jpg`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://cors.eu.org/${u}`,
];

/** Remember which relay worked last and try it first next time. */
let preferredRelay = -1;

/**
 * Decode a CORS-enabled image via <img> + canvas. Covers hosts that allow
 * crossOrigin rendering but where fetch() is blocked — and doubles as a check
 * that the bytes are a real image.
 */
async function decodeViaCanvas(url: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const giveUp = setTimeout(() => resolve(null), 30_000);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => {
          clearTimeout(giveUp);
          resolve(b && b.size > 10_000 ? b : null);
        }, "image/jpeg", 0.92);
      } catch {
        clearTimeout(giveUp);
        resolve(null); // tainted canvas — host didn't actually allow CORS
      }
    };
    img.onerror = () => {
      clearTimeout(giveUp);
      resolve(null);
    };
    img.src = url;
  });
}

/** Fetch a remote plate as a blob — direct, canvas-decode, then CORS relays. */
export async function fetchBlob(url: string): Promise<Blob | null> {
  // 1. Direct fetch (works when the host sends CORS headers, e.g. Pollinations).
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(url, { mode: "cors", signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 10_000) return blob;
    }
  } catch {
    /* fall through */
  }

  // 2. Canvas decode (works for CORS-enabled hosts where fetch is blocked).
  const decoded = await decodeViaCanvas(url);
  if (decoded) return decoded;

  // 3. CORS relays — remembered-good route first.
  const relayIdx = CORS_RELAYS.map((_, i) => i);
  if (preferredRelay >= 0) relayIdx.sort((a, b) => (a === preferredRelay ? -1 : b === preferredRelay ? 1 : 0));
  for (const i of relayIdx) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      const res = await fetch(CORS_RELAYS[i](url), { mode: "cors", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const blob = await res.blob();
      // Relays can answer 200 with an error payload — insist on real bytes.
      if (blob.size > 10_000) {
        preferredRelay = i;
        return blob;
      }
    } catch {
      /* try the next route */
    }
  }
  return null;
}

/* ------------------------------ Delivery tab --------------------------------- */
/*  Embedded preview iframes strip programmatic downloads — and even `about:    */
/*  blank` / `data:` popup tabs inherit that restriction (opaque origins).      */
/*  The one context that is never restricted is a genuine top-level page on     */
/*  the app's own origin. So: the click opens the app itself at `#delivery`     */
/*  (synchronously, gesture-safe), and the bytes are piped over a               */
/*  BroadcastChannel. The delivery page — a real secure-context tab — saves     */
/*  to Downloads, with copy-to-clipboard and right-click fallbacks that work    */
/*  absolutely anywhere.                                                        */

export const DELIVERY_HASH = "#delivery";
const DELIVERY_CHANNEL = "editorial-ai:delivery";

export type DeliveryMessage =
  | { type: "ready" }
  | { type: "deliver"; kind: "image" | "zip"; name: string; blob: Blob }
  | { type: "progress"; pct: number; label: string }
  | { type: "cancel"; reason: string };

function deliveryHref(): string {
  try {
    const u = new URL(window.location.href);
    u.hash = DELIVERY_HASH;
    return u.toString();
  } catch {
    return window.location.href + DELIVERY_HASH;
  }
}

export function isDeliveryRoute(): boolean {
  return typeof window !== "undefined" && window.location.hash === DELIVERY_HASH;
}

/**
 * A one-shot session: open the delivery tab (must be called synchronously
 * inside the click handler) and queue messages until the page reports ready.
 */
export class DeliverySession {
  readonly tab: Window | null;
  private channel: BroadcastChannel | null = null;
  private ready = false;
  private queue: DeliveryMessage[] = [];

  constructor() {
    this.tab = this.openTab();
    if (this.tab && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(DELIVERY_CHANNEL);
      this.channel.onmessage = (e: MessageEvent) => {
        if ((e.data as DeliveryMessage)?.type === "ready") {
          this.ready = true;
          const pending = this.queue;
          this.queue = [];
          for (const m of pending) this.channel?.postMessage(m);
        }
      };
    }
  }

  private openTab(): Window | null {
    try {
      return window.open(deliveryHref(), "_blank", "width=520,height=720");
    } catch {
      return null;
    }
  }

  get usable(): boolean {
    return Boolean(this.tab && !this.tab.closed);
  }

  send(msg: DeliveryMessage): void {
    if (!this.channel) return;
    if (this.ready) this.channel.postMessage(msg);
    else this.queue.push(msg);
  }

  /** Fire-and-forget convenience: open, deliver one payload, tidy up. */
  static async deliver(payload: Extract<DeliveryMessage, { type: "deliver" }>): Promise<DeliverySession | null> {
    const s = new DeliverySession();
    if (!s.usable) {
      s.close();
      return null;
    }
    s.send(payload);
    // Keep the channel alive long enough for the handshake, then retire it.
    setTimeout(() => s.close(), 20_000);
    return s;
  }

  close(): void {
    try {
      this.channel?.close();
    } catch {
      /* noop */
    }
    this.channel = null;
  }
}

/**
 * Bake the darkroom grade (the CSS filter shown in the lightbox) into the
 * pixels, so the saved file matches what's on screen. Falls back to the
 * original blob when canvas filters aren't supported.
 */
export async function applyGrade(blob: Blob, filter?: string): Promise<Blob> {
  if (!filter || filter === "none") return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx || !("filter" in ctx)) return blob;
    ctx.filter = filter;
    ctx.drawImage(bitmap, 0, 0);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    bitmap.close();
    return out ?? blob;
  } catch {
    return blob;
  }
}

function triggerDownload(blob: Blob, filename: string): boolean {
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 8000);
    return true;
  } catch {
    return false;
  }
}

export function extFor(blob: Blob): string {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("gif")) return "gif";
  return "jpg";
}

export { triggerDownload };

/**
 * Pollinations plates are cache-keyed by URL — the same prompt + seed at a
 * larger width/height re-renders the identical plate in high resolution.
 * DashScope URLs are opaque, so those download at their native size.
 */
export function highResUrl(url: string): string | null {
  if (!url.startsWith("https://image.pollinations.ai/prompt/")) return null;
  try {
    const u = new URL(url);
    const w = Number(u.searchParams.get("width")) || 1024;
    const h = Number(u.searchParams.get("height")) || 1024;
    u.searchParams.set("width", String(Math.round((w * 1.6) / 64) * 64));
    u.searchParams.set("height", String(Math.round((h * 1.6) / 64) * 64));
    return u.toString();
  } catch {
    return null;
  }
}

export interface ArchiveResult {
  blob: Blob;
  filename: string;
  saved: number;
  failed: number;
}

/**
 * Pack every plate into a ZIP blob (grades baked in). Returns null when no
 * plate could be fetched (e.g. expired DashScope URLs).
 */
export async function buildZipArchive(
  items: { url: string; name: string; filter?: string }[],
  onStep?: (done: number, total: number) => void
): Promise<ArchiveResult | null> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    onStep?.(i + 1, items.length);
    const blob = await fetchBlob(items[i].url);
    if (!blob) {
      failed++;
      continue;
    }
    const graded = await applyGrade(blob, items[i].filter);
    zip.file(`${items[i].name}.${extFor(graded)}`, graded);
    saved++;
    // Small breather keeps large sessions from tripping rate limits.
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, 250));
  }

  if (!saved) return null;
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const stamp = new Date().toISOString().slice(0, 10);
  return { blob, filename: `editorial-ai-session-${stamp}.zip`, saved, failed };
}

/**
 * Programmatic save via a real, dispatched anchor click. Some browsers refuse
 * once the original user gesture has expired (long async packs) — callers
 * should keep the blob URL alive and offer a manual anchor as a fallback.
 */
export function triggerBlobDownload(blob: Blob, filename: string): boolean {
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    a.remove();
    // Stay alive long enough for the browser to finish writing the file.
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return true;
  } catch {
    return false;
  }
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
}
