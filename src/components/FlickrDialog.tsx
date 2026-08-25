import { motion } from "framer-motion";
import { Check, Copy, ExternalLink, KeyRound, Link2, Loader2, LogOut, PlugZap, ShieldCheck } from "lucide-react";
import QRCode from "react-qr-code";
import { useEffect, useMemo, useState } from "react";
import {
  beginAuth,
  buildFlickrMetadata,
  cancelAuth,
  checkLocalProxy,
  clearCredentials,
  completeAuth,
  disconnect,
  forceLocalProxy,
  getSession,
  hasCredentials,
  isAwaitingVerifier,
  proxyProbeError,
  storeCredentials,
  storedKey,
} from "../lib/flickr";
import { FLICKR_PROXY_SCRIPT, proxyInstallCommand } from "../lib/proxyScript";
import { useUIStore } from "../stores/ui";
import type { Generation } from "../types";
import { cn, copyText } from "../lib/utils";
import { Button, Dialog, Label, inputCls } from "./ui";

/** The Flickr mark — two dots, in the house palette. */
export function FlickrMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="7" cy="12" r="4.2" className="fill-wine-600 dark:fill-wine-400" />
      <circle cx="17" cy="12" r="4.2" className="fill-gilt-500 dark:fill-gilt-400" />
    </svg>
  );
}

export function FlickrDialog({ open, onClose, gen }: { open: boolean; onClose: () => void; gen: Generation | null }) {
  const toast = useUIStore((s) => s.toast);

  const [keyInput, setKeyInput] = useState(storedKey() ?? "");
  const [secretInput, setSecretInput] = useState("");
  const [credsSaved, setCredsSaved] = useState(hasCredentials());
  const [session, setSession] = useState(getSession());
  const [awaiting, setAwaiting] = useState(isAwaitingVerifier());
  const [verifier, setVerifier] = useState("");
  const [busy, setBusy] = useState<"connect" | "verify" | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [proxyUp, setProxyUp] = useState(false);
  const [forcedProxy, setForcedProxy] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [scriptCopied, setScriptCopied] = useState(false);
  const [cmdCopied, setCmdCopied] = useState(false);

  /** The lamp: green on a real probe, or when the user vouches for it. */
  const proxyLive = proxyUp || forcedProxy;

  // Live status lamp for the bundled local proxy — re-probes while the dialog
  // is open so the moment it's running in Terminal, this turns green and the
  // next "Connect" uses it.
  useEffect(() => {
    if (!open) return;
    let stopped = false;
    const probe = async () => {
      const up = await checkLocalProxy();
      if (stopped) return;
      setProxyUp(up);
      setProbeError(proxyProbeError());
    };
    void probe();
    const id = window.setInterval(probe, 3000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [open]);

  /** Some browsers hide loopback servers from HTTPS pages entirely. */
  const vouchForProxy = () => {
    forceLocalProxy();
    setForcedProxy(true);
    setProbeError("");
    toast("Local proxy enabled", {
      description: "Requests will route through 127.0.0.1:7427. Make sure it's still running in Terminal.",
      tone: "success",
    });
  };

  /**
   * ONE clipboard operation: the command embeds the whole script, so there's
   * nothing to copy second and nothing to get out of order.
   */
  const copyInstaller = async () => {
    if (await copyText(proxyInstallCommand())) {
      setCmdCopied(true);
      setTimeout(() => setCmdCopied(false), 1800);
      toast("Install command copied", {
        description: "Open Terminal and paste it (⌘V, Return) — the proxy starts itself.",
        tone: "success",
      });
    }
  };

  const copyProxyScript = async () => {
    if (await copyText(FLICKR_PROXY_SCRIPT)) {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 1800);
      toast("Script copied", { description: "For saving manually — most people only need the install command.", tone: "info" });
    }
  };

  // Preview only while open, and never let a bad plate throw during render.
  const meta = useMemo(() => {
    if (!open || !gen) return null;
    try {
      return buildFlickrMetadata(gen);
    } catch {
      return null;
    }
  }, [gen, open]);

  const saveCreds = () => {
    if (!keyInput.trim() || !secretInput.trim()) {
      toast("Both fields are needed", { description: "Paste your Flickr API key and its secret.", tone: "error" });
      return;
    }
    storeCredentials(keyInput, secretInput);
    setCredsSaved(true);
    setSecretInput("");
    toast("Credentials saved", { description: "They stay in this browser only — never sent anywhere but Flickr.", tone: "success" });
  };

  const connect = async () => {
    if (!credsSaved && (!keyInput.trim() || !secretInput.trim())) {
      toast("Enter your key & secret first", { tone: "error" });
      return;
    }
    if (!credsSaved) saveCreds();
    setBusy("connect");
    try {
      const { authUrl } = await beginAuth();
      // No window.open — browsers with a Cross-Origin-Opener-Policy (Firefox,
      // and this preview pane) block programmatic popups to cross-origin
      // pages. The link below is a real anchor the user clicks instead, which
      // every browser honours.
      setAuthUrl(authUrl);
      setAwaiting(true);
      setLinkCopied(false);
      toast("Authorisation link ready", {
        description: "Click “Authorise on Flickr” below — it opens in a new tab.",
        tone: "success",
      });
    } catch (err) {
      toast("Couldn't start the connection", {
        description: err instanceof Error ? err.message : "Something went wrong.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!authUrl) return;
    if (await copyText(authUrl)) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
      toast("Link copied", { description: "Paste it into a new tab if the link won't open.", tone: "info" });
    }
  };

  const verify = async () => {
    if (!verifier.trim()) {
      toast("Paste the code first", { tone: "error" });
      return;
    }
    setBusy("verify");
    try {
      const { user } = await completeAuth(verifier);
      setSession(getSession());
      setAwaiting(false);
      setVerifier("");
      toast("Connected to Flickr", { description: `Posting as @${user}. The Flickr button is now live.`, tone: "success" });
    } catch (err) {
      toast("Verification failed", {
        description: err instanceof Error ? err.message : "That code didn't work.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => {
    cancelAuth();
    setAwaiting(false);
    setVerifier("");
    setAuthUrl(null);
    setLinkCopied(false);
  };

  const disconnectAll = () => {
    disconnect();
    setSession(null);
    toast("Disconnected from Flickr", { tone: "info" });
  };

  const forgetCreds = () => {
    clearCredentials();
    setCredsSaved(false);
    setKeyInput("");
    setSecretInput("");
    setSession(null);
    toast("Credentials removed", { tone: "info" });
  };

  return (
    <Dialog open={open} onClose={onClose} kicker="08 · Distribution" title="Post to Flickr" wide>
      {/* Credentials */}
      <div className="border border-ink/12 p-3.5 dark:border-paper/12">
        <div className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-wine-700 dark:text-gilt-400" />
          <Label className="!mb-0">Flickr API credentials</Label>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="flickr-key" className="!mb-1">API key</Label>
            <input
              id="flickr-key"
              aria-label="Flickr API key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="e.g. b08f77f369f6…"
              autoComplete="off"
              spellCheck={false}
              className={cn(inputCls, "font-mono text-xs")}
            />
          </div>
          <div>
            <Label htmlFor="flickr-secret" className="!mb-1">API secret</Label>
            <input
              id="flickr-secret"
              aria-label="Flickr API secret"
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder={credsSaved ? "••••••••••••••••" : "paste your secret"}
              autoComplete="off"
              spellCheck={false}
              className={cn(inputCls, "font-mono text-xs")}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={saveCreds} aria-label="Save Flickr credentials">
            Save credentials
          </Button>
          {credsSaved ? (
            <button
              onClick={forgetCreds}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 underline-offset-4 hover:text-wine-700 hover:underline dark:text-paper/40 dark:hover:text-gilt-300"
            >
              Remove stored credentials
            </button>
          ) : null}
        </div>
        <p className="mt-2 flex items-start gap-1.5 font-mono text-[10px] leading-relaxed text-ink/45 dark:text-paper/40">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-gilt-500" />
          Your secret never leaves this browser — it's only used locally to sign each request. Because Flickr blocks direct
          browser calls, the signed request (and photo, when posting) may route through a public CORS relay — the relay never
          sees your key or secret.
        </p>
      </div>

      {/* Connection */}
      <div className="mt-3 border border-ink/12 p-3.5 dark:border-paper/12">
        {session ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 bg-ink/[0.03] dark:border-paper/15 dark:bg-paper/[0.05]">
              <FlickrMark className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold italic leading-tight">Connected as @{session.user}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45 dark:text-paper/40">
                nsid {session.nsid || "—"} · ready to post
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={disconnectAll} aria-label="Disconnect from Flickr">
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
        ) : awaiting ? (
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Label>Step 1 — authorise Editorial-RSF on Flickr</Label>

              {authUrl ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {/* QR tile — scanning happens on your phone, so no browser policy can block it. */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.08, type: "spring", stiffness: 380, damping: 26 }}
                    className="flex shrink-0 flex-col items-center gap-1.5 self-start border border-ink/15 bg-[#f5f4f0] p-2.5 dark:border-paper/20"
                  >
                    <QRCode value={authUrl} size={112} bgColor="#f5f4f0" fgColor="#121114" level="M" />
                    <p className="font-mono text-[8.5px] font-bold uppercase tracking-[0.18em] text-ink/50">Scan · phone</p>
                  </motion.div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-stretch gap-1.5">
                      <motion.a
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        href={authUrl}
                        target="_blank"
                        rel="noopener"
                        className="flex h-10 flex-1 items-center justify-center gap-2 bg-wine-700 px-4 font-sans text-sm font-semibold uppercase tracking-[0.1em] text-wine-50 shadow-[0_2px_16px_-4px_rgba(140,42,64,0.5)] transition-colors hover:bg-wine-600 dark:bg-gilt-500 dark:text-ink dark:hover:bg-gilt-400"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Authorise on Flickr
                        <span className="ml-1 h-1.5 w-1.5 animate-pulse-dot rounded-full bg-gilt-300 dark:bg-ink/70" aria-hidden />
                      </motion.a>
                      <Button variant="outline" size="md" onClick={() => void copyLink()} aria-label="Copy the authorisation link">
                        {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {linkCopied ? "Copied" : "Copy link"}
                      </Button>
                    </div>

                    <ol className="mt-2.5 space-y-1.5">
                      <li className="flex gap-2 font-mono text-[10px] leading-relaxed text-ink/55 dark:text-paper/50">
                        <span className="font-bold text-wine-700 dark:text-gilt-400">A.</span>
                        Scan the QR with your phone — or open a{" "}
                        <span className="text-ink/80 dark:text-paper/75">fresh browser tab</span> (Ctrl/Cmd+T) and paste the copied
                        link into its <span className="text-ink/80 dark:text-paper/75">address bar</span>.
                      </li>
                      <li className="flex gap-2 font-mono text-[10px] leading-relaxed text-ink/55 dark:text-paper/50">
                        <span className="font-bold text-wine-700 dark:text-gilt-400">B.</span>
                        On Flickr, press <span className="text-ink/80 dark:text-paper/75">“OK, I'LL AUTHORIZE IT”</span>.
                      </li>
                      <li className="flex gap-2 font-mono text-[10px] leading-relaxed text-ink/55 dark:text-paper/50">
                        <span className="font-bold text-wine-700 dark:text-gilt-400">C.</span>
                        Bring the 9-digit code back here ↓
                      </li>
                    </ol>

                    <p className="mt-2 border-l-2 border-gilt-500/60 pl-2 font-mono text-[9.5px] leading-relaxed text-ink/40 dark:text-paper/35">
                      Why the detour? Your browser seals this page with a Cross-Origin-Opener-Policy, so links it opens get
                      blocked — the QR and a fresh-tab paste sidestep the seal entirely.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink/50 dark:text-paper/45">
                  The page reloaded mid-connection — cancel below for a fresh link, or paste your code if Flickr already gave you
                  one.
                </p>
              )}

              <Label htmlFor="flickr-verifier" className="!mt-3.5">
                Step 2 — paste the code Flickr shows you
              </Label>
            </motion.div>
            <div className="flex gap-1.5">
              <input
                id="flickr-verifier"
                aria-label="Flickr verification code"
                value={verifier}
                onChange={(e) => setVerifier(e.target.value)}
                placeholder="9-digit code, e.g. 123-456-789"
                autoComplete="off"
                className={cn(inputCls, "font-mono text-xs")}
              />
              <Button variant="accent" size="md" onClick={() => void verify()} disabled={busy === "verify"} aria-label="Verify and connect">
                {busy === "verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Verify & connect
              </Button>
            </div>
            <button
              onClick={cancel}
              className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 underline-offset-4 hover:text-ink hover:underline dark:text-paper/40 dark:hover:text-paper"
            >
              Cancel and start over
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 bg-ink/[0.03] dark:border-paper/15 dark:bg-paper/[0.05]">
              <FlickrMark className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold italic leading-tight">Not connected yet</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45 dark:text-paper/40">one-time authorisation</p>
            </div>
            <Button variant="accent" size="md" onClick={() => void connect()} disabled={busy === "connect"} aria-label="Connect to Flickr">
              {busy === "connect" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Connect to Flickr
            </Button>
          </div>
        )}
      </div>

      {/* Local proxy — the guaranteed connection */}
      <div className="mt-3 border border-ink/12 p-3.5 dark:border-paper/12">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-wine-700 dark:text-gilt-400">
            <PlugZap className="h-3.5 w-3.5" />
            Local proxy · guaranteed connection
          </p>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em]",
              proxyLive
                ? "border-gilt-500/60 bg-gilt-500/10 text-gilt-600 dark:text-gilt-300"
                : "border-ink/20 text-ink/45 dark:border-paper/20 dark:text-paper/40"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", proxyLive ? "animate-pulse-dot bg-gilt-500" : "bg-ink/30 dark:bg-paper/25")} aria-hidden />
            {proxyLive ? (forcedProxy && !proxyUp ? "Forced on" : "Running") : "Not running"}
          </span>
        </div>

        {proxyLive ? (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-gilt-600 dark:text-gilt-300">
            The proxy is live on 127.0.0.1:7427 — press <span className="font-bold">Connect to Flickr</span> and it will route
            through it. Public relays are bypassed entirely.
          </p>
        ) : (
          <>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink/55 dark:text-paper/50">
              Public relays come and go. For a connection that always works, run the bundled proxy on your Mac — one copy, one
              paste, about ten seconds:
            </p>
            <ol className="mt-2.5 space-y-2">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink font-mono text-[9px] font-bold text-paper dark:bg-paper dark:text-ink">1</span>
                <div className="min-w-0">
                  <Button variant="outline" size="sm" onClick={() => void copyInstaller()} className="!h-7">
                    {cmdCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {cmdCopied ? "Install command copied" : "Copy the install command"}
                  </Button>
                  <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink/40 dark:text-paper/35">
                    The whole script is embedded in the command — nothing else to copy.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink font-mono text-[9px] font-bold text-paper dark:bg-paper dark:text-ink">2</span>
                <p className="pt-1 font-mono text-[10px] leading-relaxed text-ink/55 dark:text-paper/50">
                  Open <span className="font-bold text-ink dark:text-paper">Terminal</span> and paste once (⌘V, Return). It saves
                  the script and starts the proxy on 127.0.0.1:7427.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink font-mono text-[9px] font-bold text-paper dark:bg-paper dark:text-ink">3</span>
                <p className="pt-1 font-mono text-[10px] leading-relaxed text-ink/55 dark:text-paper/50">
                  This lamp turns green the moment it's up — then press{" "}
                  <span className="font-bold text-ink dark:text-paper">Connect to Flickr</span>.
                </p>
              </li>
            </ol>
            <button
              onClick={() => void copyProxyScript()}
              className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40 underline-offset-4 hover:text-ink hover:underline dark:text-paper/35 dark:hover:text-paper"
            >
              {scriptCopied ? "Script copied ✓" : "Just want the script file? Copy it"}
            </button>

            {/* The lamp can stay grey even when Terminal shows it running —
                some browsers hide loopback servers from HTTPS pages. */}
            <div className="mt-3 border-t border-dashed border-ink/15 pt-2.5 dark:border-paper/15">
              {probeError ? (
                <p className="font-mono text-[9px] leading-relaxed text-ink/40 dark:text-paper/35">
                  Last check — {probeError}
                </p>
              ) : null}
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink/55 dark:text-paper/50">
                Proxy running in Terminal but the lamp stays grey? Some browsers block this page from seeing 127.0.0.1 —{" "}
                <button
                  onClick={vouchForProxy}
                  className="font-bold text-wine-700 underline-offset-4 hover:underline dark:text-gilt-300"
                >
                  force-enable it anyway
                </button>
                . Requests will route through it; if it's truly down, you'll get a fast, clear error.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Caption preview */}
      {gen && meta ? (
        <div className="mt-3 border border-ink/12 p-3.5 dark:border-paper/12">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-wine-700 dark:text-gilt-400">
            What will be posted · plate №{String(gen.seed).slice(0, 5)}
          </p>
          <p className="mt-2 font-mono text-[11px] text-ink/55 dark:text-paper/50">
            File — <span className="font-bold text-ink dark:text-paper">{meta.filename}.jpg</span>
          </p>
          <p className="mt-1.5 font-display text-lg font-semibold italic leading-snug">{meta.title}</p>
          <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-line font-mono text-[11px] leading-relaxed text-ink/65 dark:text-paper/60">
            {meta.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {meta.tags.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-sm border border-gilt-500/40 bg-gilt-500/10 px-1.5 py-0.5 font-mono text-[9px] text-gilt-600 dark:text-gilt-300"
              >
                #{t}
              </span>
            ))}
          </div>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/35 dark:text-paper/30">
            {meta.tags.length} tags · generated from this plate's direction
          </p>
        </div>
      ) : (
        <p className="mt-3 font-mono text-[11px] text-ink/45 dark:text-paper/40">Load a plate in the lightbox to preview its caption.</p>
      )}

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink/40 dark:text-paper/35">
        Once connected, the <span className="text-ink/70 dark:text-paper/65">Flickr</span> button under the plate names the image{" "}
        <span className="text-ink/70 dark:text-paper/65">IMG_xxxx</span>, writes the title, description and 30 tags above, and posts it
        public to your photostream.
      </p>
    </Dialog>
  );
}
