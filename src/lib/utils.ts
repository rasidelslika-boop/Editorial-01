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

/* --------------------------- File System Access API --------------------------- */
/*  The most reliable save path: a picker handle acquired inside the user's     */
/*  click gesture, written to after the bytes arrive. Works even where anchor   */
/*  downloads are stripped by the embedding context.                            */

export type SaveHandle = { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> };

/** Must be called synchronously inside a click handler (user gesture). */
export function acquireSaveHandle(suggestedName: string): Promise<SaveHandle | null> | null {
  const w = window as unknown as { showSaveFilePicker?: (opts: { suggestedName: string }) => Promise<SaveHandle> };
  if (typeof w.showSaveFilePicker !== "function") return null;
  try {
    return w.showSaveFilePicker({ suggestedName }).catch(() => null);
  } catch {
    return null;
  }
}

export async function writeToSaveHandle(handle: SaveHandle | null, blob: Blob): Promise<boolean> {
  if (!handle) return false;
  try {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
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

function extFor(blob: Blob): string {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("gif")) return "gif";
  return "jpg";
}

export type DownloadStatus = "saved" | "opened" | "failed";

/**
 * Save a plate to the Downloads folder. Route order:
 *   1. Anchor download of the graded blob (targets Downloads, no dialog)
 *   2. Blob opened in a tab (user saves from there)
 *   3. Raw URL opened in a tab
 */
export async function downloadImage(url: string, filename: string, filter?: string): Promise<DownloadStatus> {
  const blob = await fetchBlob(url);
  if (blob) {
    const graded = await applyGrade(blob, filter);
    if (triggerDownload(graded, `${filename}.${extFor(graded)}`)) return "saved";
    try {
      const href = URL.createObjectURL(graded);
      window.open(href, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
      return "opened";
    } catch {
      /* fall through */
    }
  }
  // Last resort — hand the browser the raw URL so it can be saved manually.
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.jpg`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return "opened";
  } catch {
    return "failed";
  }
}

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
