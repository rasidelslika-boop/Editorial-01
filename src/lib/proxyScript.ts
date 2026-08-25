/**
 * The bundled local transport proxy, inlined as a plain string.
 *
 * It used to be embedded via a `?raw` file import, but this preview host
 * serves that as a live module URL — the browser then tries to execute the
 * .mjs (which has no exports) and the whole app dies at boot. A string
 * constant in source has no such failure mode.
 *
 * Keep `server/flickr-proxy.mjs` byte-identical to this.
 */

/**
 * A single paste-and-run installer for Terminal: writes the script via a
 * quoted heredoc (no shell expansion, safe with backticks/quotes) and then
 * starts it. One clipboard operation — nothing can get out of order.
 */
export function proxyInstallCommand(): string {
  return (
    `mkdir -p ~/rsfashionphoto && cat > ~/rsfashionphoto/flickr-proxy.mjs <<'RSF_PROXY_EOF'\n` +
    FLICKR_PROXY_SCRIPT.trimEnd() +
    `\nRSF_PROXY_EOF\nnode ~/rsfashionphoto/flickr-proxy.mjs`
  );
}

export const FLICKR_PROXY_SCRIPT = `/**
 * RSFASHIONPHOTO — local Flickr transport proxy (zero dependencies).
 *
 * This is the same trick every full-stack app builder uses: put the Flickr
 * call behind a server so CORS never applies. The browser keeps doing the
 * OAuth signing; this proxy only forwards bytes and adds CORS headers.
 * It stores NOTHING and speaks only to Flickr.
 *
 * Run (Node 18+):
 *   node server/flickr-proxy.mjs
 *
 * Then in the app, press "Connect to Flickr" — it auto-detects the proxy at
 * http://127.0.0.1:7427 and prefers it over the public relays.
 */
import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT || 7427);
const TARGET = \`http://127.0.0.1:\${PORT}\`;
const ALLOWED = ["https://www.flickr.com/services/", "https://up.flickr.com/services/"];

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let target = "";
  try {
    const u = new URL(req.url ?? "/", TARGET);
    target = u.searchParams.get("url") ?? "";
  } catch {
    /* malformed */
  }

  if (!target || !ALLOWED.some((p) => target.startsWith(p))) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "missing or disallowed ?url= (only Flickr service URLs are proxied)" }));
    return;
  }

  const forward = https.request(
    target,
    {
      method: req.method,
      headers: {
        ...(req.headers["content-type"] ? { "content-type": String(req.headers["content-type"]) } : {}),
        ...(req.headers["content-length"] ? { "content-length": String(req.headers["content-length"]) } : {}),
        "user-agent": "RSFASHIONPHOTO local transport",
      },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, {
        "Content-Type": upstream.headers["content-type"] ?? "text/plain",
      });
      upstream.pipe(res);
    }
  );

  forward.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message) }));
  });

  req.pipe(forward);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("RSFASHIONPHOTO Flickr transport running");
  console.log(\`  → \${TARGET}/proxy?url=<flickr-url>\`);
  console.log("  The studio detects this automatically — go press “Connect to Flickr”.");
});
`;
