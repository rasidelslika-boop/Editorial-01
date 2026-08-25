import type { Generation } from "../types";
import { ENGINES } from "./presets";
import { bodySilhouette, cameraText, lightingText } from "./promptBuilder";
import { blobToDataUri, extFor, fetchBlob } from "./utils";

/* ------------------------------------------------------------------ */
/*  Flickr publishing — the consumer key/secret live in the relay     */
/*  worker (worker/flickr-relay.js); the browser only ever holds its  */
/*  own OAuth access token.                                           */
/* ------------------------------------------------------------------ */

const LS = {
  worker: "rsfashionphoto-flickr-worker",
  token: "rsfashionphoto-flickr-token",
  secret: "rsfashionphoto-flickr-secret",
  nsid: "rsfashionphoto-flickr-nsid",
  user: "rsfashionphoto-flickr-user",
};

export interface FlickrIdentity {
  token: string;
  secret: string;
  nsid: string;
  user: string;
}

export function flickrWorkerUrl(): string | null {
  try {
    return localStorage.getItem(LS.worker);
  } catch {
    return null;
  }
}

export function setFlickrWorkerUrl(url: string) {
  try {
    localStorage.setItem(LS.worker, url.trim().replace(/\/+$/, ""));
  } catch {
    /* private mode */
  }
}

export function flickrIdentity(): FlickrIdentity | null {
  try {
    const token = localStorage.getItem(LS.token);
    const secret = localStorage.getItem(LS.secret);
    if (!token || !secret) return null;
    return {
      token,
      secret,
      nsid: localStorage.getItem(LS.nsid) ?? "",
      user: localStorage.getItem(LS.user) ?? "connected",
    };
  } catch {
    return null;
  }
}

export function disconnectFlickr() {
  try {
    localStorage.removeItem(LS.token);
    localStorage.removeItem(LS.secret);
    localStorage.removeItem(LS.nsid);
    localStorage.removeItem(LS.user);
  } catch {
    /* private mode */
  }
}

/**
 * The relay redirects back to `origin/path#flickr_token=…` after the user
 * authorises on Flickr. Capture it once at boot, then clean the hash.
 */
export function captureFlickrAuth(): boolean {
  if (typeof window === "undefined" || !window.location.hash.includes("flickr_")) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("flickr_token");
  const secret = params.get("flickr_secret");
  if (!token || !secret) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return false;
  }
  try {
    localStorage.setItem(LS.token, token);
    localStorage.setItem(LS.secret, secret);
    localStorage.setItem(LS.nsid, params.get("flickr_nsid") ?? "");
    localStorage.setItem(LS.user, params.get("flickr_user") ?? "connected");
  } catch {
    /* private mode */
  }
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

/* ------------------------------- Caption craft ------------------------------- */

export interface FlickrMetadata {
  filename: string;
  title: string;
  description: string;
  tags: string[];
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const firstClause = (s: string, max = 46) => {
  const clean = (s ?? "").split(/[,—-]/)[0].replace(/^(a|an|the|in|set in|wearing)\s+/i, "").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
};

/** "IMG_xxxx" with a fresh random number, per the house convention. */
export function flickrFilename(): string {
  return `IMG_${String(1000 + Math.floor(Math.random() * 9000))}`;
}

/** A fitting title, drawn from the plate's own direction. */
function composeTitle(gen: Generation): string {
  const s = gen.settings ?? ({} as Generation["settings"]);
  const muse = s.muse;
  const who = muse?.museVibe ? cap(muse.museVibe.replace(/^an?\s+/i, "")) : firstClause(s.model ?? "", 34) || "The Muse";
  const where = s.location ? firstClause(s.location) : "the studio";
  const no = `№${String(gen.seed ?? 0).slice(0, 5)}`;
  return `${who} · ${where} — ${no}`.slice(0, 92);
}



function composeDescription(gen: Generation): string {
  const s = gen.settings;
  const muse = s.muse;
  const silhouette = muse ? bodySilhouette(muse) : "";
  const lines: string[] = [];

  lines.push(
    `One frame from an ongoing fashion editorial — ${s.model.trim() || "an enigmatic high-fashion muse"}${
      silhouette ? `, ${silhouette}` : ""
    }.`
  );
  lines.push("");
  if (s.outfit.trim()) lines.push(`Wardrobe — ${cap(s.outfit.trim())}.`);
  if (s.location.trim()) lines.push(`Scene — ${cap(s.location.trim())}, ${lightingText(s)}.`);
  lines.push(`Glass — ${cameraText(s)} · ${gen.ratio} frame · seed ${gen.seed}.`);
  if (s.pose.trim()) lines.push(`Direction — ${cap(s.pose.trim())}${s.expression.trim() ? `, ${s.expression.trim()}` : ""}.`);
  lines.push("");
  const engineLabel = ENGINES.find((e) => e.id === gen.engine)?.label ?? gen.engine;
  lines.push(`Developed in the RSFASHIONPHOTO darkroom · rendered by ${engineLabel} · plate ${gen.ratio}.`);
  lines.push(`© RSFASHIONPHOTO — cast, scouted and graded by machine, art-directed by hand.`);
  return lines.join("\n");
}

const CURATED_TAGS = [
  "fashion",
  "editorial",
  "fashionphotography",
  "editorialphotography",
  "portrait",
  "portraitphotography",
  "model",
  "fashionmodel",
  "photoshoot",
  "couture",
  "style",
  "beauty",
  "glamour",
  "artphotography",
  "aesthetic",
  "muse",
  "lookbook",
  "vogue",
  "fashioneditorial",
  "styling",
  "makeup",
  "hairstyle",
  "lighting",
  "photographer",
  "creative",
  "inspiration",
  "moodboard",
  "fashionista",
  "ootd",
  "beautyphotography",
  "aifashion",
  "aigenerated",
  "aiart",
  "digitalart",
  "rsfashionphoto",
];

function tagify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .join("");
}

/** Thirty appropriate tags, drawn from the plate's own direction first. */
export function composeTags(gen: Generation): string[] {
  const s = gen.settings;
  const muse = s.muse;
  const dynamic: string[] = [];

  if (muse) {
    if (muse.museVibe) dynamic.push(tagify(muse.museVibe));
    if (muse.hairColor) dynamic.push(tagify(muse.hairColor.split("·")[0]));
    if (muse.hairstyle) dynamic.push(tagify(muse.hairstyle));
    if (muse.eyeColor) dynamic.push(tagify(muse.eyeColor));
    if (muse.skinTone) dynamic.push(tagify(muse.skinTone));
    if (muse.bodyType) dynamic.push(tagify(muse.bodyType));
  }
  if (s.location) dynamic.push(...s.location.split(/[,—]/).slice(0, 3).map(tagify));
  if (s.lighting) dynamic.push(tagify(lightingText(s)));
  dynamic.push(tagify(cameraText(s).split(",")[0]));
  dynamic.push(gen.engine === "dalle3" ? "dalle" : gen.engine.replace(/[^a-z0-9]/g, ""));
  dynamic.push(gen.ratio === "1:1" ? "square" : Number(gen.ratio.split(":")[0]) > Number(gen.ratio.split(":")[1]) ? "landscape" : "portraitmode");

  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...dynamic, ...CURATED_TAGS]) {
    const clean = t.replace(/[^a-z0-9-]/g, "");
    if (clean.length < 3 || clean.length > 40 || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 30) break;
  }
  return out;
}

export function buildFlickrMetadata(gen: Generation): FlickrMetadata {
  // Never let caption composition crash the studio — fall back gracefully.
  try {
    return {
      filename: flickrFilename(),
      title: composeTitle(gen),
      description: composeDescription(gen),
      tags: composeTags(gen),
    };
  } catch {
    return {
      filename: flickrFilename(),
      title: `Editorial plate №${String(gen?.seed ?? 0).slice(0, 5)}`,
      description: "A fashion editorial plate developed in the RSFASHIONPHOTO darkroom.",
      tags: CURATED_TAGS.slice(0, 30),
    };
  }
}

/* --------------------------------- Publish --------------------------------- */

export async function publishToFlickr(
  gen: Generation,
  onStage?: (stage: string) => void
): Promise<{ photoid: string; url: string }> {
  const worker = flickrWorkerUrl();
  const id = flickrIdentity();
  if (!worker) throw new Error("Set the relay worker URL first.");
  if (!id) throw new Error("Connect to Flickr first.");

  onStage?.("Fetching the plate");
  const blob = await fetchBlob(gen.url);
  if (!blob) throw new Error("Couldn't fetch the plate bytes — it may have expired.");

  const meta = buildFlickrMetadata(gen);
  onStage?.("Composing caption & tags");
  const dataUri = await blobToDataUri(blob);
  const imageBase64 = dataUri.split(",")[1] ?? "";

  onStage?.("Posting to Flickr");
  const res = await fetch(`${worker}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      oauth_token: id.token,
      oauth_token_secret: id.secret,
      user_nsid: id.nsid,
      title: meta.title,
      description: meta.description,
      tags: meta.tags.join(" "),
      filename: `${meta.filename}.${extFor(blob)}`,
      mime: blob.type || "image/jpeg",
      imageBase64,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.photoid) {
    throw new Error(data?.error ?? `Flickr upload failed (${res.status}).`);
  }
  return { photoid: data.photoid, url: data.url };
}
