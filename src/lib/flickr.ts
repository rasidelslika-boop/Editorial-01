import type { FormState, Generation } from "../types";
import { aiText } from "./aiTraits";
import { cameraText, lightingText } from "./promptBuilder";
import { extFor, fetchBlob, hashString } from "./utils";

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

/* ------------------------------------------------------------------ */
/*  Transport. Flickr's OAuth and upload endpoints send no CORS       */
/*  headers, so a browser page can NEVER reach them directly — the    */
/*  request is blocked before it leaves your machine. We try direct   */
/*  first (future-proofing), then walk a chain of public CORS relays. */
/*                                                                    */
/*  Public relays go down, rate-limit and change policy without       */
/*  notice, so resilience is structural:                              */
/*   • the OAuth token calls are signed as GETs and sent through      */
/*     GET-friendly relays (relays forward GETs far more reliably     */
/*     than POST bodies — this is what fixes "HTTP 403" from          */
/*     relays that gate POSTs by origin),                             */
/*   • uploads stay POST-capable through a separate chain,            */
/*   • every hop has a timeout and the chain reports exactly why it   */
/*     gave up.                                                       */
/*  Only signed params and photo bytes transit a relay; your API      */
/*  secret never does.                                                */
/* ------------------------------------------------------------------ */
const RELAYS_GET: ((u: string) => string)[] = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://proxy.corsfix.com/?${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

const RELAYS_POST: ((u: string) => string)[] = [
  (u) => `https://proxy.corsfix.com/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

async function guardedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** True for statuses worth handing back to the caller for inspection. */
function usableStatus(status: number): boolean {
  return status === 200 || status === 400 || status === 401;
}

const RELAY_DOWN_MSG =
  "None of the public CORS relays could reach Flickr right now. Public relays go down or rate-limit from time to time — wait a moment and try again.";

/** GET transport — used by the signed OAuth token calls. */
async function transportGet(url: string): Promise<Response> {
  try {
    const direct = await guardedFetch(url, { method: "GET" }, 10_000);
    if (usableStatus(direct.status)) return direct;
  } catch {
    /* direct is blocked by CORS — expected */
  }
  let lastStatus = "";
  for (const relay of RELAYS_GET) {
    try {
      const res = await guardedFetch(relay(url), { method: "GET" }, 15_000);
      if (usableStatus(res.status)) return res;
      lastStatus = `HTTP ${res.status}`;
    } catch {
      lastStatus = "unreachable";
      continue;
    }
  }
  throw new Error(RELAY_DOWN_MSG + (lastStatus ? ` (${lastStatus})` : ""));
}

/** POST transport — used for the multipart upload. */
async function transportFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    const direct = await guardedFetch(url, init, 30_000);
    if (usableStatus(direct.status)) return direct;
  } catch {
    /* direct is blocked by CORS — expected */
  }
  let lastStatus = "";
  for (const relay of RELAYS_POST) {
    try {
      const res = await guardedFetch(relay(url), init, 60_000);
      if (usableStatus(res.status)) return res;
      lastStatus = `HTTP ${res.status}`;
    } catch {
      lastStatus = "unreachable";
      continue;
    }
  }
  throw new Error(RELAY_DOWN_MSG + (lastStatus ? ` (${lastStatus})` : ""));
}

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

/** Flickr's machine codes, translated into something a photographer can act on. */
const OAUTH_PROBLEM_HINTS: Record<string, string> = {
  consumer_key_unknown:
    "Flickr doesn't recognise that API key. Re-check it in the Flickr App Garden — it may be mistyped, revoked, or belong to a deleted app.",
  consumer_key_rejected:
    "That API key has been disabled or lacks permission for this. Verify it in the Flickr App Garden.",
  signature_invalid:
    "Flickr rejected the request signature. This usually means the request was altered in transit by a public relay — press Connect again to retry. If it persists, your device clock may be off.",
  signature_method_rejected: "Flickr rejected the signing method.",
  timestamp_refused:
    "Your device's clock is too far from Flickr's time. Sync your system clock and retry.",
  nonce_used: "A duplicate request was detected — press Connect again to retry.",
  parameter_absent:
    "A required parameter never arrived — the relay likely dropped the request body. Wait a moment and retry.",
  parameter_rejected: "Flickr rejected a parameter in the request.",
  token_rejected: "That token was rejected — start the connection over from the top.",
  token_expired: "The token expired — start the connection over from the top.",
  token_not_authorized: "The token wasn't authorised — reconnect and approve it again.",
  callback_uri_invalid:
    "Your app's callback settings reject this flow. In the Flickr App Garden, leave the callback URL blank so it runs out-of-band.",
  permission_unknown: "The requested permission isn't valid.",
  permission_denied: "The app doesn't have the required permission.",
};

function describeOAuthProblem(resp: Record<string, string>): string | null {
  const problem = resp.oauth_problem;
  if (!problem) return null;
  const hint = OAUTH_PROBLEM_HINTS[problem];
  return hint ? `${hint} (Flickr code: ${problem})` : `Flickr returned an OAuth error: ${problem}.`;
}

/**
 * OAuth 1.0a allows the token calls as signed GETs — and a signed GET whose
 * parameters live in the query string survives public CORS relays far better
 * than a POST body (several relays strip, gate or 403 POSTs by origin, which
 * is exactly the "HTTP 403" this flow hit).
 */
async function getSigned(
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<Record<string, string>> {
  const signed = await sign("GET", url, params, consumerSecret, tokenSecret);
  const query = Object.entries(signed)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const res = await transportGet(`${url}?${query}`);
  const text = await res.text();

  // A public relay that's down or rate-limited returns its own HTML error page
  // instead of Flickr's form-encoded reply — call that out, don't blame Flickr.
  const trimmed = text.trim();
  const isHtml = trimmed.startsWith("<") || (res.headers.get("content-type") ?? "").includes("text/html");
  if (isHtml || (!res.ok && !trimmed.includes("oauth_"))) {
    throw new Error(
      `The connection relay returned an error page, not Flickr (HTTP ${res.status}). Public relays go down or rate-limit from time to time — wait a moment and press Connect again.`
    );
  }

  const parsed = parseFormEncoded(text);
  const problem = describeOAuthProblem(parsed);
  if (problem) throw new Error(problem);
  if (!res.ok) throw new Error(`Flickr responded with HTTP ${res.status}.`);
  return parsed;
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

  const resp = await getSigned(
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
    const problem = describeOAuthProblem(resp);
    throw new Error(
      problem ??
        "Flickr sent back an empty or unreadable reply — that's usually the public relay, not your key. Wait a moment and press Connect again. If it keeps happening, re-check your key and secret in the Flickr App Garden."
    );
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

  const resp = await getSigned(
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
    const problem = describeOAuthProblem(resp);
    throw new Error(
      problem ?? "That code didn't work — copy the 9-digit code Flickr displayed and try again."
    );
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
  const s = gen.settings ?? ({} as FormState);
  const muse = s.muse;
  const who = muse?.museVibe ? cap(muse.museVibe.replace(/^an?\s+/i, "")) : firstClause(s.model ?? "", 34) || "The Muse";
  const where = s.location ? firstClause(s.location) : "the studio";
  const no = `№${String(gen?.seed ?? 0).slice(0, 5)}`;
  return `${who} · ${where} — ${no}`.slice(0, 92);
}

/* ------------------------- Artistic caption craft ------------------------- */

const ART_OPENERS = [
  "She holds the frame the way a secret holds a room.",
  "Caught between one breath and the next,",
  "There is a stillness here that fashion rarely permits.",
  "Light finds her first —",
  "Somewhere between posing and being,",
  "The camera waits; she does not.",
  "A study in grace under glass.",
  "She wears the silence like couture.",
] as const;

const ART_CLOSERS = [
  "What remains is not a picture but a temperature.",
  "For one frame, fashion stops performing and simply is.",
  "The plate remembers what the moment tried to leave.",
  "It is less a portrait than a held breath.",
  "Here, beauty is a verb.",
  "Everything in the frame leans quietly toward her.",
  "The image ends; the mood does not.",
] as const;

/**
 * An elegant gallery-wall caption of a few lines, written from the plate's
 * own direction. Deterministic per plate — the same photograph always speaks
 * in the same voice.
 */
export function composeArtisticDescription(gen: Generation): string {
  const s = gen.settings ?? ({} as FormState);
  const muse = s.muse;
  const seedHash = hashString(`${gen?.seed ?? 0}:${gen?.prompt ?? ""}`);
  const pickAt = (pool: readonly string[], salt: number) => pool[Math.abs(seedHash + salt) % pool.length];

  const subject = muse?.museVibe
    ? `a ${muse.museVibe.replace(/^an?\s+/i, "")}`
    : firstClause(s.model ?? "", 40) || "the muse";
  const hair = muse?.hairstyle ? muse.hairstyle.toLowerCase() : "";
  const eyes = muse?.eyeColor ? `${muse.eyeColor.toLowerCase()} eyes` : "";
  const outfit = firstClause(s.outfit ?? "", 70);
  const place = firstClause(s.location ?? "", 60);
  const light = lightingText({ ...(s as FormState) }).toLowerCase();

  const portrait = [subject, hair, eyes].filter(Boolean).join(", ");
  const scene = outfit
    ? `${cap(outfit)}${place ? `, adrift in ${place}` : ""} — ${light}.`
    : place
      ? `Set adrift in ${place} — ${light}.`
      : `${cap(light)}.`;

  return `${pickAt(ART_OPENERS, 0)}\n${cap(portrait)}.\n${scene}\n${pickAt(ART_CLOSERS, 3)}`;
}

/**
 * Ask the live text model for a few elegant, artsy lines about this exact
 * photograph — and fall back to the local composer if it can't answer.
 */
export async function aiArtisticDescription(gen: Generation): Promise<string> {
  try {
    const s = gen.settings ?? ({} as FormState);
    const brief = [
      s.model,
      s.muse?.museVibe ? `overall vibe: ${s.muse.museVibe}` : "",
      s.outfit ? `wearing ${s.outfit}` : "",
      s.location ? `in ${s.location}` : "",
      lightingText({ ...(s as FormState) }),
      s.pose ?? "",
    ]
      .filter(Boolean)
      .join("; ");
    const text = await aiText(
      `Write an elegant, artsy gallery caption of 2 to 4 short lines for this fashion editorial photograph — ${brief}. Lyrical, present tense, evocative. No hashtags, no quotation marks, no technical camera terms, never mention AI.`
    );
    if (text) return text;
  } catch {
    /* the local composer takes over */
  }
  return composeArtisticDescription(gen);
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
  // Caption composition can never crash the studio — fall back gracefully.
  try {
    return {
      filename: flickrFilename(),
      title: composeTitle(gen),
      description: composeArtisticDescription(gen),
      tags: composeTags(gen),
    };
  } catch {
    return {
      filename: flickrFilename(),
      title: "Untitled Study in Light",
      description:
        "A quiet study of light and silhouette — composed in the stillness between poses, where fashion becomes feeling.",
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

  onStage?.("Writing the caption");
  const meta = buildFlickrMetadata(gen);
  // The posted description is AI-written; the local artistic composer is the fallback.
  meta.description = await aiArtisticDescription(gen);

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

  const res = await transportFetch(UPLOAD_URL, { method: "POST", body: form });
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
