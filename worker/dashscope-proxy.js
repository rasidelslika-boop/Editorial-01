/**
 * EditorialAI — DashScope relay worker (Cloudflare Workers).
 *
 * DashScope's OpenAI-compatible API does not send browser CORS headers, so the
 * studio cannot call it directly from the client. This tiny worker mirrors the
 * API with CORS enabled.
 *
 * Deploy:
 *   npm i -g wrangler && wrangler login
 *   wrangler deploy worker/dashscope-proxy.js --name editorial-ai-dashscope
 *
 * Then in `.env.local`:
 *   VITE_DASHSCOPE_RELAY=https://editorial-ai-dashscope.<you>.workers.dev
 *
 * The worker mirrors paths, so `/compatible-mode/v1/images/generations` on the
 * worker hits `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/...`.
 *
 * Hardening (recommended for production): store the API key as a Worker secret
 * (`wrangler secret put DASHSCOPE_API_KEY`) and inject it here instead of
 * trusting the client's Authorization header.
 */
const UPSTREAM = "https://dashscope-intl.aliyuncs.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    try {
      const url = new URL(request.url);
      const target = `${UPSTREAM}${url.pathname}${url.search}`;
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("content-length");
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: request.body,
      });
      const out = new Headers(upstream.headers);
      for (const [k, v] of Object.entries(CORS)) out.set(k, v);
      return new Response(upstream.body, { status: upstream.status, headers: out });
    } catch (err) {
      return new Response(`Relay error: ${err.message}`, { status: 502, headers: CORS });
    }
  },
};
