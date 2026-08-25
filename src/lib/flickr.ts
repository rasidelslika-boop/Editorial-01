import type { Generation } from "../types";
import { ENGINES } from "./presets";
import { bodySilhouette, cameraText, lightingText } from "./promptBuilder";
import { extFor, fetchBlob } from "./utils";

/* ------------------------------------------------------------------ */
/*  Flickr publishing — fully client-side.                            */
/*                                                                    */
/*  Your API key + secret live only in your browser (localStorage).   */
/*  The secret is NEVER transmitted: it's used locally to compute an  */
/*  OAuth 1.0a HMAC-SHA1 signature, and only that signature is sent   */
/*  to Flickr. No relay, no server, nothing to deploy.                */
/* ------------------------------------------------------------------ */

const LS = {
  key: "rsflickr-api-key",
  secret: "rsflickr-api-secret",
  token: "rsflickr-access-token",
  tokenSecret: "rsflickr-access-token-secret",
  nsid: "rsflickr-nsid",
  user: "rsflickr-user",
  reqToken: "rsflickr-request-token",
  reqSecret: "rsflickr-request-secret",
};

const REQUEST_TOKEN_URL = "https://www.flickr.com/services/oauth/request_token";
const AUTHORIZE_URL = "https://www.flickr.com/services/oauth/authorize";
const ACCESS_TOKEN_URL = "https://www.flickr.com/services/oauth/access_token";
const UPLOAD_URL = "https://up.flickr.com/services/upload/";

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}
function lsDel(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* private mode */
  }
}

/* ------------------------------ Credentials ------------------------------ */

export function storeCredentials(key: string, secret: string) {
  lsSet(LS.key, key.trim());
  lsSet(LS.secret, secret.trim());
}

export function storedKey(): string | null {
  return lsGet(LS.key);
}

export function hasCredentials(): boolean {
  return Boolean(lsGet(LS.key) && lsGet(LS.secret));
}

export function clearCredentials() {
  lsDel(LS.key);
  lsDel(LS.secret);
  disconnect();
}

export interface FlickrSession {
  token: string;
  tokenSecret: string;
  nsid: string;
  user: string;
}

export function getSession(): FlickrSession | null {
  const token = lsGet(LS.token);
  const tokenSecret = lsGet(LS.tokenSecret);
  if (!token || !tokenSecret) return null;
  return { token, tokenSecret, nsid: lsGet(LS.nsid) ?? "", user: lsGet(LS.user) ?? "connected" };
}

export function isReady(): boolean {
  return hasCredentials() && getSession() !== null;
}

export function disconnect() {
  lsDel(LS.token);
  lsDel(LS.tokenSecret);
  lsDel(LS.nsid);
  lsDel(LS.user);
  lsDel(LS.reqToken);
  lsDel(LS.reqSecret);
}

/* ---------------------------- OAuth 1.0a core ---------------------------- */

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function nonce(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function timestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function sign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<Record<string, string>> {
  const keys = Object.keys(params).sort();
  const paramString = keys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
  const baseString = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = await hmacSha1Base64(signingKey, baseString);
  return { ...params, oauth_signature: signature };
}

function parseFormEncoded(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of text.split("&")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = decodeURIComponent(pair.slice(0, idx));
    const v = decodeURIComponent(pair.slice(idx + 1));
    out[k] = v;
  }
  return out;
}

async function postSigned(
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<Record<string, string>> {
  const signed = await sign("POST", url, params, consumerSecret, tokenSecret);
  const body = Object.entries(signed)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  } catch {
    throw new Error(
      "Couldn't reach Flickr from the browser (network/CORS). Flickr's token endpoint may be blocking this page — see the note below the button."
    );
  }
  const text = await res.text();
  return parseFormEncoded(text);
}

/* ------------------------------- Auth flow ------------------------------- */

export function isAwaitingVerifier(): boolean {
  return Boolean(lsGet(LS.reqToken));
}

export function cancelAuth() {
  lsDel(LS.reqToken);
  lsDel(LS.reqSecret);
}

/** Step 1 — fetch a request token and return the Flickr authorisation URL. */
export async function beginAuth(): Promise<{ authUrl: string }> {
  const key = lsGet(LS.key);
  const secret = lsGet(LS.secret);
  if (!key || !secret) throw new Error("Enter your API key and secret first.");

  const resp = await postSigned(
    REQUEST_TOKEN_URL,
    {
      oauth_callback: "oob",
      oauth_consumer_key: key,
      oauth_nonce: nonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp(),
      oauth_version: "1.0",
    },
    secret,
    ""
  );

  if (!resp.oauth_token || !resp.oauth_token_secret) {
    throw new Error("Flickr rejected the request — double-check your API key and secret.");
  }
  lsSet(LS.reqToken, resp.oauth_token);
  lsSet(LS.reqSecret, resp.oauth_token_secret);
  return { authUrl: `${AUTHORIZE_URL}?oauth_token=${resp.oauth_token}&perms=write` };
}

/** Step 2 — exchange the code Flickr showed you for a permanent access token. */
export async function completeAuth(verifier: string): Promise<{ user: string }> {
  const key = lsGet(LS.key);
  const secret = lsGet(LS.secret);
  const reqToken = lsGet(LS.reqToken);
  const reqSecret = lsGet(LS.reqSecret);
  if (!key || !secret) throw new Error("Enter your API key and secret first.");
  if (!reqToken || !reqSecret) throw new Error("Press “Connect to Flickr” first, then paste the code it shows.");

  const resp = await postSigned(
    ACCESS_TOKEN_URL,
    {
      oauth_consumer_key: key,
      oauth_nonce: nonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp(),
      oauth_token: reqToken,
      oauth_verifier: verifier.trim(),
      oauth_version: "1.0",
    },
    secret,
    reqSecret
  );

  if (!resp.oauth_token || !resp.oauth_token_secret) {
    throw new Error("That code didn't work — copy the 9-digit code Flickr displayed and try again.");
  }
  lsSet(LS.token, resp.oauth_token);
  lsSet(LS.tokenSecret, resp.oauth_token_secret);
  lsSet(LS.nsid, resp.user_nsid ?? "");
  lsSet(LS.user, resp.username ?? resp.fullname ?? "connected");
  lsDel(LS.reqToken);
  lsDel(LS.reqSecret);
  return { user: resp.username ?? "connected" };
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
  const clean = s.split(/[,—-]/)[0].replace(/^(a|an|the|in|set in|wearing)\s+/i, "").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
};

/** "IMG_xxxx" with a fresh random number, per the house convention. */
export function flickrFilename(): string {
  return `IMG_${String(1000 + Math.floor(Math.random() * 9000))}`;
}

function composeTitle(gen: Generation): string {
  const s = gen.settings;
  const muse = s.muse;
  const who = muse?.museVibe ? cap(muse.museVibe.replace(/^an?\s+/i, "")) : firstClause(s.model, 34) || "The Muse";
  const where = s.location ? firstClause(s.location) : "the studio";
  const no = `№${String(gen.seed).slice(0, 5)}`;
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
  const key = lsGet(LS.key);
  const secret = lsGet(LS.secret);
  const session = getSession();
  if (!key || !secret) throw new Error("Enter your API key and secret in the Flickr panel first.");
  if (!session) throw new Error("Connect to Flickr first.");

  onStage?.("Fetching the plate");
  const blob = await fetchBlob(gen.url);
  if (!blob) throw new Error("Couldn't fetch the plate bytes — it may have expired.");

  onStage?.("Composing caption & tags");
  const meta = buildFlickrMetadata(gen);

  onStage?.("Signing & uploading to Flickr");
  const apiParams: Record<string, string> = {
    title: meta.title,
    description: meta.description,
    tags: meta.tags.join(" "),
    is_public: "1",
    is_friend: "0",
    is_family: "0",
    content_type: "1",
  };
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: key,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp(),
    oauth_token: session.token,
    oauth_version: "1.0",
  };
  // The photo binary is excluded from the signature — only text params are signed.
  const signed = await sign("POST", UPLOAD_URL, { ...oauthParams, ...apiParams }, secret, session.tokenSecret);

  const form = new FormData();
  for (const [k, v] of Object.entries(signed)) form.append(k, v);
  form.append("photo", blob, `${meta.filename}.${extFor(blob)}`);

  let res: Response;
  try {
    res = await fetch(UPLOAD_URL, { method: "POST", body: form });
  } catch {
    throw new Error("Couldn't reach Flickr's upload endpoint from the browser (network/CORS).");
  }
  const xml = await res.text();
  const statMatch = xml.match(/stat="(\w+)"/);
  if (!statMatch || statMatch[1] !== "ok") {
    const errMatch = xml.match(/msg="([^"]*)"/);
    throw new Error(errMatch ? `Flickr: ${errMatch[1]}` : "Flickr upload failed.");
  }
  const photoidMatch = xml.match(/<photoid>(\d+)<\/photoid>/);
  if (!photoidMatch) throw new Error("Flickr didn't return a photo id.");
  const photoid = photoidMatch[1];
  const url = session.nsid
    ? `https://www.flickr.com/photos/${session.nsid}/${photoid}/`
    : `https://www.flickr.com/photo.gne?id=${photoid}`;
  return { photoid, url };
}
