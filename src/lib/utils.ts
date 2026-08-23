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

/** Fetch a remote plate as a blob (requires the host to allow CORS). */
export async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    const res = await fetch(url, { mode: "cors", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
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
 * Save a plate. Best path: CORS blob → graded pixels → local download.
 * Fallback: a direct anchor to the URL (opens a tab when the browser
 * refuses an unattended cross-origin download).
 */
export async function downloadImage(url: string, filename: string, filter?: string): Promise<DownloadStatus> {
  const blob = await fetchBlob(url);
  if (blob) {
    const graded = await applyGrade(blob, filter);
    const ok = triggerDownload(graded, `${filename}.${extFor(graded)}`);
    if (ok) return "saved";
  }
  // Last resort — hand the browser the raw URL.
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

/** One-click session archive — every plate in the contact sheet, zipped. */
export async function downloadZipArchive(
  items: { url: string; name: string; filter?: string }[],
  onStep?: (done: number, total: number) => void
): Promise<{ saved: number; failed: number }> {
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

  if (!saved) return { saved, failed };
  const out = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(out, `editorial-ai-session-${stamp}.zip`);
  return { saved, failed };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
}
