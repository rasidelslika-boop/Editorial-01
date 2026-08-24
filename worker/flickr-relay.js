/**
 * RSFASHIONPHOTO — Flickr publishing relay (Cloudflare Worker).
 *
 * Holds the OAuth 1.0a consumer credentials server-side and signs every
 * request to Flickr, so the secret never ships to the browser. The app's
 * "Post to Flickr" button talks to this worker.
 *
 * Deploy (one command):
 *   npm i -g wrangler && wrangler login
 *   wrangler deploy worker/flickr-relay.js --name rsfashionphoto-flickr
 *
 * Then paste the printed URL (https://rsfashionphoto-flickr.<you>.workers.dev)
 * into the app's Flickr dialog once. For production, move the credentials
 * into Worker secrets:  wrangler secret put FLICKR_API_KEY / FLICKR_API_SECRET
 */

/* Credentials are baked in per the studio's zero-config setup — env secrets win when set. */
const KEY = (env) => env.FLICKR_API_KEY || "b08f77f369f6987ec08f713e386a79a0";
const SECRET = (env) => env.FLICKR_API_SECRET || "a95fc371853ea740";

const FLICKR = {
  requestToken: "https://www.flickr.com/services/oauth/request_token",
  authorize: "https://www.flickr.com/services/oauth/authorize",
  accessToken: "https://www.flickr.com/services/oauth/access_token",
  upload: "https://up.flickr.com/services/upload/",
};

/* ------------------------------- WebCrypto kit ------------------------------- */

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sha256(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
}

async function aesKey(secret) {
  return crypto.subtle.importKey("raw", await sha256(secret), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Hide the request-token secret inside the callback URL. */
async function encrypt(secret, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(secret),
    new TextEncoder().encode(plaintext)
  );
  const merged = new Uint8Array(iv.length + ct.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ct), iv.length);
  return b64url(merged);
}

async function decrypt(secret, payload) {
  const raw = unb64(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(secret), ct);
  return new TextDecoder().decode(pt);
}

async function hmacSha1B64(key, message) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  return b64(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message)));
}

/* ------------------------------- OAuth signing ------------------------------- */

function penc(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

async function sign(method, url, params, consumerSecret, tokenSecret) {
  const sorted = [...params].sort((a, b) => (a[0] === b[0] ? penc(a[1]) < penc(b[1]) ? -1 : 1 : a[0] < b[0] ? -1 : 1));
  const base = `${method}&${penc(url)}&${penc(sorted.map(([k, v]) => `${penc(k)}=${penc(v)}`).join("&"))}`;
  return hmacSha1B64(`${penc(consumerSecret)}&${penc(tokenSecret || "")}`, base);
}

function oauthBase(key, token) {
  return [
    ["oauth_consumer_key", key],
    ["oauth_nonce", crypto.randomUUID().replace(/-/g, "").slice(0, 16)],
    ["oauth_signature_method", "HMAC-SHA1"],
    ["oauth_timestamp", String(Math.floor(Date.now() / 1000))],
    ["oauth_version", "1.0"],
    ...(token ? [["oauth_token", token]] : []),
  ];
}

function parseForm(text) {
  return Object.fromEntries(new URLSearchParams(text).entries());
}

/* -------------------------------- Multipart -------------------------------- */

function multipart(fields, filename, mime, bytes) {
  const boundary = "----RSFP" + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const chunks = [];
  for (const [k, v] of fields) {
    chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  chunks.push(
    enc.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
    )
  );
  chunks.push(new Uint8Array(bytes));
  chunks.push(enc.encode(`\r\n--${boundary}--\r\n`));
  let len = 0;
  for (const c of chunks) len += c.byteLength;
  const body = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    body.set(c, off);
    off += c.byteLength;
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

/* -------------------------------- Handlers -------------------------------- */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const key = KEY(env);
    const secret = SECRET(env);

    try {
      /* --- Step 1: begin OAuth — get a request token, send the user to Flickr --- */
      if (url.pathname === "/auth/start") {
        const app = url.searchParams.get("app");
        if (!/^https?:\/\//.test(app || "")) return json({ error: "missing app origin" }, 400);

        const callback = `${url.origin}/auth/callback?rts=${await encrypt(secret, "pending")}`;
        const params = [...oauthBase(key), ["oauth_callback", callback]];
        params.push(["oauth_signature", await sign("POST", FLICKR.requestToken, params, secret, "")]);

        const res = await fetch(FLICKR.requestToken, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(Object.fromEntries(params)).toString(),
        });
        const data = parseForm(await res.text());
        if (!data.oauth_token || !data.oauth_token_secret) {
          return json({ error: "Flickr refused the request token", detail: data }, 502);
        }

        // Carry the request-token secret, encrypted, through the round trip.
        const rts = await encrypt(secret, data.oauth_token_secret);
        const cb = `${url.origin}/auth/callback?rts=${penc(rts)}&app=${penc(app)}`;

        // Re-request the token with the real callback so Flickr honours it.
        const params2 = [...oauthBase(key), ["oauth_callback", cb]];
        params2.push(["oauth_signature", await sign("POST", FLICKR.requestToken, params2, secret, "")]);
        const res2 = await fetch(FLICKR.requestToken, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(Object.fromEntries(params2)).toString(),
        });
        const data2 = parseForm(await res2.text());
        if (!data2.oauth_token) return json({ error: "Flickr refused the request token", detail: data2 }, 502);

        return Response.redirect(
          `${FLICKR.authorize}?oauth_token=${penc(data2.oauth_token)}&perms=write`,
          302
        );
      }

      /* --- Step 2: Flickr sends the user back with a verifier — trade it in --- */
      if (url.pathname === "/auth/callback") {
        const app = url.searchParams.get("app") || "";
        const denied = () => Response.redirect(`${app}#flickr_error=denied`, 302);
        const verifier = url.searchParams.get("oauth_verifier");
        const token = url.searchParams.get("oauth_token");
        const rts = url.searchParams.get("rts");
        if (!verifier || !token || !rts) return denied();

        let tokenSecret;
        try {
          tokenSecret = await decrypt(secret, rts);
        } catch {
          return denied();
        }

        const params = [...oauthBase(key, token), ["oauth_verifier", verifier]];
        params.push(["oauth_signature", await sign("POST", FLICKR.accessToken, params, secret, tokenSecret)]);
        const res = await fetch(FLICKR.accessToken, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(Object.fromEntries(params)).toString(),
        });
        const data = parseForm(await res.text());
        if (!data.oauth_token || !data.oauth_token_secret) return denied();

        const hash = [
          `flickr_token=${penc(data.oauth_token)}`,
          `flickr_secret=${penc(data.oauth_token_secret)}`,
          `flickr_nsid=${penc(data.user_nsid || "")}`,
          `flickr_user=${penc(data.username || "connected")}`,
        ].join("&");
        return Response.redirect(`${app}#${hash}`, 302);
      }

      /* --- Step 3: upload — sign and forward the plate to Flickr --- */
      if (url.pathname === "/upload" && req.method === "POST") {
        const body = await req.json();
        const { oauth_token, oauth_token_secret, title, description, tags, filename, mime, imageBase64 } = body;
        if (!oauth_token || !oauth_token_secret || !imageBase64) return json({ error: "missing fields" }, 400);

        const apiParams = [
          ["title", title || ""],
          ["description", description || ""],
          ["tags", tags || ""],
          ["is_public", "1"],
          ["safety_level", "1"],
          ["content_type", "1"],
        ];
        const params = [...oauthBase(key, oauth_token), ...apiParams];
        params.push(["oauth_signature", await sign("POST", FLICKR.upload, params, secret, oauth_token_secret)]);

        const bytes = unb64(imageBase64);
        const { body: form, contentType } = multipart(params, filename || "IMG_0000.jpg", mime || "image/jpeg", bytes);

        const res = await fetch(FLICKR.upload, {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: form,
        });
        const xml = await res.text();
        const photoid = xml.match(/<photoid>(\d+)<\/photoid>/)?.[1];
        const fail = xml.match(/code="(\d+)"\s+msg="([^"]*)"/);
        if (!photoid) {
          return json({ error: fail ? `Flickr error ${fail[1]}: ${fail[2]}` : "upload failed", detail: xml.slice(0, 300) }, 502);
        }
        return json({ photoid, url: `https://www.flickr.com/photos/${body.user_nsid || "me"}/${photoid}` });
      }

      if (url.pathname === "/") {
        return new Response("RSFASHIONPHOTO Flickr relay — endpoints: /auth/start · /auth/callback · /upload", {
          headers: CORS,
        });
      }
      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "relay failure" }, 500);
    }
  },
};
