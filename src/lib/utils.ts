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

/* ------------------------------ Delivery popup -------------------------------- */
/*  The embedded preview strips programmatic downloads from the studio iframe,   */
/*  and a separately-opened top-level tab can't receive bytes over a             */
/*  BroadcastChannel (same-origin only). The robust route is a popup that needs  */
/*  no messaging at all: open it synchronously inside the click gesture, then    */
/*  write the finished file into it as a base64 data URI. The popup is a real    */
/*  top-level tab, displays the plate, and offers an anchor download plus        */
/*  copy-to-clipboard and right-click/drag-out fallbacks that work anywhere.     */

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

const safeName = (name: string) => name.replace(/["'<>\\]/g, "_");

const POPUP_HEAD = (title: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>Editorial-RSF · ${title}</title>` +
  `<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">` +
  `<style>` +
  `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#121114;color:#efedea;` +
  `font-family:'Space Mono',monospace;display:flex;flex-direction:column;align-items:center;padding:40px 24px 48px;` +
  `background-image:radial-gradient(50rem 32rem at -10% -10%,rgba(140,42,64,.14),transparent 60%),radial-gradient(40rem 30rem at 110% 110%,rgba(176,141,87,.12),transparent 60%)}` +
  `.kicker{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#c6a465}` +
  `h1{font-family:'Fraunces',serif;font-style:italic;font-weight:500;font-size:30px;margin:14px 0 4px;text-align:center;word-break:break-word}` +
  `.meta{font-size:11px;color:#8b8781;letter-spacing:.08em;margin:0 0 22px}` +
  `img{max-width:100%;max-height:52vh;border:1px solid #3a3733;background:#1b181e;display:block;margin-bottom:22px;box-shadow:0 24px 60px -24px rgba(0,0,0,.6)}` +
  `.btn{display:inline-block;text-decoration:none;background:#f1f0ec;color:#121114;padding:14px 30px;font-family:'Space Mono',monospace;` +
  `font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;transition:background .15s,transform .15s;cursor:pointer;border:none}` +
  `.btn:hover{background:#c6a465;transform:translateY(-1px)}` +
  `.ghost{margin-top:12px;background:none;border:1px solid #3a3733;color:#c6a465;padding:10px 22px;font-family:'Space Mono',monospace;` +
  `font-size:11px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;transition:border-color .15s}` +
  `.ghost:hover{border-color:#c6a465}` +
  `.hint{margin-top:22px;max-width:380px;text-align:center;font-size:11.5px;line-height:1.7;color:#8b8781}` +
  `.status{min-height:16px;margin-top:14px;font-size:11px;letter-spacing:.06em;color:#c6a465;text-align:center}` +
  `.zipart{width:132px;height:132px;border:1px solid #3a3733;background:#1b181e;display:grid;place-items:center;margin-bottom:22px;` +
  `box-shadow:0 24px 60px -24px rgba(0,0,0,.6);position:relative;overflow:hidden}` +
  `.zipart::after{content:'';position:absolute;left:0;top:0;height:1px;width:100%;background:linear-gradient(90deg,transparent,rgba(198,164,101,.7),transparent);animation:scan 1.8s linear infinite}` +
  `.fname{font-size:10px;letter-spacing:.12em;color:#8b8781;margin:-14px 0 20px;word-break:break-all;text-align:center}` +
  `.scan{position:fixed;left:0;top:0;height:1px;width:100%;background:linear-gradient(90deg,transparent,rgba(198,164,101,.8),transparent);animation:scan 1.6s linear infinite}` +
  `@keyframes scan{from{transform:translateY(0)}to{transform:translateY(100vh)}}` +
  `</style></head><body>`;

const POPUP_FOOT = `</body></html>`;

function writeDoc(tab: Window, html: string): boolean {
  try {
    tab.document.open();
    tab.document.write(html);
    tab.document.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the delivery popup. MUST be called synchronously inside the click
 * handler (before any `await`) so the browser's popup blocker stays satisfied.
 */
export function openDeliveryPopup(): Window | null {
  try {
    const w = window.open("", "_blank", "width=560,height=800");
    if (!w) return null;
    writeDoc(
      w,
      POPUP_HEAD("Preparing") +
        `<div class="scan"></div>` +
        `<p class="kicker">Editorial-RSF · Darkroom</p>` +
        `<h1>Developing your file…</h1>` +
        `<p class="meta">Fetching and grading the plate</p>` +
        POPUP_FOOT
    );
    return w;
  } catch {
    return null;
  }
}

/**
 * Fill an already-open popup with the finished file (base64 data URI), then
 * trigger the download. `getBlob` runs after the popup is open, so it may be
 * as slow as the network requires.
 */
export async function populateDeliveryPopup(
  tab: Window,
  getBlob: () => Promise<Blob | null>,
  kind: "image" | "zip",
  baseName: string
): Promise<boolean> {
  try {
    const blob = await getBlob();
    if (!blob || tab.closed) {
      if (!tab.closed) {
        writeDoc(
          tab,
          POPUP_HEAD("Unavailable") +
            `<p class="kicker">Editorial-RSF · Darkroom</p>` +
            `<h1>Couldn't fetch that plate</h1>` +
            `<p class="meta">The source bytes never arrived</p>` +
            `<p class="hint">The image may have expired (DashScope URLs live ~24h) or the network blocked it. Try regenerating the plate, then download again.</p>` +
            POPUP_FOOT
        );
      }
      return false;
    }

    // Images take their extension from the bytes; archives are always .zip.
    const name = kind === "zip" ? (baseName.endsWith(".zip") ? safeName(baseName) : `${safeName(baseName)}.zip`) : `${safeName(baseName)}.${extFor(blob)}`;
    const kb = Math.max(1, Math.round(blob.size / 1024));
    const dataUri = await blobToDataUri(blob);
    const isImg = kind === "image";

    const zipGlyph =
      `<div class="zipart"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#c6a465" stroke-width="1.4">` +
      `<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg></div>`;

    const body =
      (isImg ? `<img id="plate" src="${dataUri}" alt="${name}">` : zipGlyph) +
      `<p class="kicker">Editorial-RSF · Darkroom</p>` +
      `<h1>${isImg ? "Plate developed" : "Session archived"}</h1>` +
      `<p class="fname">${name}</p>` +
      `<p class="meta">${isImg ? "graded plate" : "session archive"} · ${kb} KB</p>` +
      // A real anchor (so right-click → "Save link as…" always works with the
      // right name); the click handler upgrades it to the native save dialog.
      `<a id="saveBtn" class="btn" href="${dataUri}" download="${name}">Save to Downloads</a>` +
      `<a id="dlAuto" style="display:none" href="${dataUri}" download="${name}"></a>` +
      (isImg ? `<button id="copyBtn" class="ghost" type="button">Copy image to clipboard</button>` : "") +
      `<p id="status" class="status"></p>` +
      `<p class="hint">${
        isImg
          ? `Your download starts automatically. If it doesn't, click the button — or right-click the image and choose “Save image as…”, or drag it to your desktop.`
          : `Click the button to open your browser's save dialog (it lands in Downloads). If that's blocked, right-click the button and choose “Save link as…”.`
      }</p>` +
      `<script>` +
      `var NAME=${JSON.stringify(name)};` +
      `var DATA=${JSON.stringify(dataUri)};` +
      `function setStatus(t){var s=document.getElementById('status');if(s)s.textContent=t;}` +
      `function doSave(){` +
      `setStatus('Opening the save dialog…');` +
      `return fetch(DATA).then(function(r){return r.blob();}).then(function(blob){` +
      `return window.showSaveFilePicker({suggestedName:NAME}).then(function(handle){` +
      `return handle.createWritable().then(function(w){return w.write(blob).then(function(){return w.close();});});` +
      `});}).then(function(){` +
      `setStatus('Saved — check your Downloads folder.');` +
      `var b=document.getElementById('saveBtn');if(b)b.textContent='Saved ✓';` +
      `}).catch(function(err){` +
      `if(err&&err.name==='AbortError'){setStatus('');return;}` +
      `setStatus('Save dialog was blocked — right-click the button and choose "Save link as…" instead.');` +
      `});}` +
      `window.addEventListener('DOMContentLoaded',function(){` +
      `var b=document.getElementById('saveBtn');` +
      `if(b)b.addEventListener('click',function(e){if(window.showSaveFilePicker){e.preventDefault();doSave();}});` +
      `setTimeout(function(){try{document.getElementById('dlAuto').click();}catch(e){}},600);` +
      (isImg
        ? `var cb=document.getElementById('copyBtn');if(cb)cb.addEventListener('click',function(){var im=document.getElementById('plate');var c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;var x=c.getContext('2d');x.drawImage(im,0,0);c.toBlob(function(b){try{navigator.clipboard.write([new ClipboardItem({'image/png':b})]);cb.textContent='Copied to clipboard';}catch(e){cb.textContent='Clipboard unavailable';}},'image/png');});`
        : "") +
      `});` +
      `</` +
      `script>`;

    if (tab.closed) return false;
    writeDoc(tab, POPUP_HEAD(name) + body + POPUP_FOOT);
    try {
      tab.focus();
    } catch {
      /* noop */
    }
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

export function extFor(blob: Blob): string {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("gif")) return "gif";
  if (blob.type.includes("zip")) return "zip";
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
  return { blob, filename: `editorial-rsf-session-${stamp}.zip`, saved, failed };
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
