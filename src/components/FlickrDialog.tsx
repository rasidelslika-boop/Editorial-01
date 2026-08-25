import { motion } from "framer-motion";
import { Check, Copy, ExternalLink, KeyRound, Link2, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  beginAuth,
  buildFlickrMetadata,
  cancelAuth,
  clearCredentials,
  completeAuth,
  disconnect,
  getSession,
  hasCredentials,
  isAwaitingVerifier,
  storeCredentials,
  storedKey,
} from "../lib/flickr";
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
              <Label>Step 1 — authorise RSFASHIONPHOTO on Flickr</Label>
              <div className="flex flex-wrap items-stretch gap-1.5">
                {authUrl ? (
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
                ) : null}
                {authUrl ? (
                  <Button variant="outline" size="md" onClick={() => void copyLink()} aria-label="Copy the authorisation link">
                    {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {linkCopied ? "Copied" : "Copy link"}
                  </Button>
                ) : null}
              </div>
              <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink/45 dark:text-paper/40">
                {authUrl ? (
                  <>
                    Opens Flickr in a new tab — press{" "}
                    <span className="text-ink/70 dark:text-paper/65">“OK, I'LL AUTHORIZE IT”</span>. If your browser refuses to open
                    it, use Copy link and paste it into a tab yourself.
                  </>
                ) : (
                  <>The page reloaded mid-connection — cancel below for a fresh link, or paste your code if Flickr already gave you one.</>
                )}
              </p>

              <Label htmlFor="flickr-verifier" className="!mt-3">
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
