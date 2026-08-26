/**
 * Editorial-RSF — DashScope / Alibaba MaaS relay (Cloudflare Worker)
 *
 * DashScope and the regional MaaS workspace gateways don't send browser CORS
 * headers, so a page can't call them directly. This tiny worker adds them.
 * The Authorization header rides through unchanged, so you can either let the
 * app send its baked key or hold the real key here as a secret:
 *
 *   wrangler secret put DASHSCOPE_API_KEY   # stored encrypted, never in code
 *
 * Deploy:
 *   npm i -g wrangler && wrangler login
 *   wrangler deploy worker/dashscope-proxy.js --name rsfashionphoto-dashscope
 *
 * Then in the app's .env.local:
 *   VITE_DASHSCOPE_RELAY=https://rsfashionphoto-dashscope.<you>.workers.dev
 */

const UPSTREAM = "https://ws-ou063af90w6dlklj.ap-southeast-1.maas.aliyuncs.com";
// Generic accounts:  "https://dashscope-intl.aliyuncs.com"
// China mainland:    "https://dashscope.aliyuncs.com"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(req.url);
    const target = new URL(url.pathname + url.search, UPSTREAM);

    const headers = new Headers(req.headers);
    // Optionally inject a worker-side secret instead of trusting the client key.
    if (env.DASHSCOPE_API_KEY) {
      headers.set("Authorization", `Bearer ${env.DASHSCOPE_API_KEY}`);
    }

    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    });

    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },
};
