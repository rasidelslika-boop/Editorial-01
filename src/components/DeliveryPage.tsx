import { motion } from "framer-motion";
import { Archive, Check, Clipboard, Download, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, extFor, type DeliveryMessage } from "../lib/utils";

const CHANNEL = "editorial-ai:delivery";

type Phase = "waiting" | "progress" | "received" | "saved" | "failed";

/**
 * The Darkroom Delivery page — served at the app's own URL (#delivery), so it
 * is a genuine top-level secure-context tab. Bytes arrive over a
 * BroadcastChannel and are saved from here, where embedded-preview download
 * restrictions simply don't apply.
 */
export function DeliveryPage() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [label, setLabel] = useState("Contacting the studio…");
  const [pct, setPct] = useState(0);
  const [payload, setPayload] = useState<{ kind: "image" | "zip"; name: string; blob: Blob } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);

  /* Announce readiness, then listen. */
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<DeliveryMessage>) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === "progress") {
        setPhase("progress");
        setLabel(msg.label);
        setPct(msg.pct);
      } else if (msg.type === "deliver") {
        setPayload({ kind: msg.kind, name: msg.name, blob: msg.blob });
        setPhase("received");
        setLabel("Bytes received");
        setPct(100);
        if (msg.kind === "image") {
          setPreview((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(msg.blob);
          });
        }
        // Attempt an automatic save — succeeds when the browser allows it;
        // the big button below covers every other case.
        attemptSave(msg.blob, msg.name);
      } else if (msg.type === "cancel") {
        setPhase("failed");
        setLabel(msg.reason);
      }
    };
    ch.postMessage({ type: "ready" } satisfies DeliveryMessage);
    return () => {
      ch.close();
    };
  }, []);

  const attemptSave = useCallback((blob: Blob, name: string): boolean => {
    try {
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
      return true;
    } catch {
      return false;
    }
  }, []);

  const onSave = () => {
    if (!payload) return;
    if (attemptSave(payload.blob, payload.name)) {
      setPhase("saved");
      setLabel("Handed to the browser");
    }
  };

  const onCopy = async () => {
    if (!payload || payload.kind !== "image") return;
    try {
      // The clipboard wants a PNG — convert through a canvas.
      const bitmap = await createImageBitmap(payload.blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      bitmap.close();
      if (!png) throw new Error("no png");
      const item = new ClipboardItem({ "image/png": png });
      await navigator.clipboard.write([item]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the other routes still work */
    }
  };

  const kb = payload ? Math.max(1, Math.round(payload.blob.size / 1024)) : 0;
  const isZip = payload?.kind === "zip";

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-[#121114] px-6 py-10 text-[#efedea]">
      {/* Ambient layers */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(50rem_32rem_at_-10%_-10%,rgba(140,42,64,0.16),transparent_60%),radial-gradient(40rem_30rem_at_110%_110%,rgba(176,141,87,0.14),transparent_60%)]" />
        <div className="grain absolute inset-0 opacity-[0.07]" />
        {phase === "waiting" || phase === "progress" ? (
          <div className="absolute left-0 h-px w-full bg-gradient-to-r from-transparent via-[#c6a465]/70 to-transparent animate-scan" />
        ) : null}
        <p className="font-display wonk text-outline absolute -bottom-20 -right-8 select-none text-[18rem] italic leading-none opacity-50">
          ↓
        </p>
      </div>

      <main className="relative z-10 w-full max-w-[440px]">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#c6a465]">EditorialAI · Darkroom delivery</p>
        <h1 className="font-display wonk mt-3 text-4xl font-semibold italic leading-tight">
          {phase === "saved" ? "On its way down." : phase === "failed" ? "Delivery stalled." : isZip ? "The archive is here." : "Your plate is here."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#efedea]/60">
          {phase === "waiting" && "This tab is a trusted top-level page — the studio is piping the bytes over. Your save will happen here, where no preview restriction can touch it."}
          {phase === "progress" && "The darkroom is still working. Bytes stream into this tab the moment they're ready."}
          {(phase === "received" || phase === "saved") &&
            "Saved files land in your Downloads folder. If the browser held back the automatic save, the button below is a fresh click — it always works."}
          {phase === "failed" && "The bytes couldn't be fetched — most likely the plate URL expired (DashScope links live ~24h). Regenerate the plate and try again."}
        </p>

        {/* Status line */}
        <div className="mt-6 flex items-center gap-3 border border-[#efedea]/12 bg-[#efedea]/[0.04] px-4 py-3">
          {phase === "waiting" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#c6a465]" />}
          {phase === "progress" && <span className="h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-[#c6a465]" />}
          {(phase === "received" || phase === "saved") && <Check className="h-4 w-4 shrink-0 text-[#c6a465]" />}
          {phase === "failed" && <XCircle className="h-4 w-4 shrink-0 text-[#a63a50]" />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] font-bold tracking-wide">{label}</p>
            {payload ? (
              <p className="font-mono text-[10px] text-[#efedea]/45">
                {payload.name} · {isZip ? "zip archive" : extFor(payload.blob).toUpperCase() + " image"} · {kb} KB
              </p>
            ) : null}
          </div>
        </div>

        {/* Progress bar */}
        {phase === "progress" ? (
          <div className="mt-3 h-px w-full bg-[#efedea]/10">
            <div className="h-px bg-[#c6a465] transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        ) : null}

        {/* Preview */}
        {preview && !isZip ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 border border-[#efedea]/15 bg-[#1b181e] p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]"
          >
            <img src={preview} alt="Editorial plate" className="max-h-[46vh] w-full object-contain" draggable />
          </motion.div>
        ) : null}
        {payload && isZip ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center justify-center border border-dashed border-[#c6a465]/40 px-6 py-10"
          >
            <Archive className="h-10 w-10 text-[#c6a465]" aria-hidden />
          </motion.div>
        ) : null}

        {/* Actions */}
        {payload ? (
          <div className="mt-6 space-y-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onSave}
              className="flex w-full items-center justify-center gap-2.5 bg-[#f1f0ec] px-6 py-4 font-mono text-[12px] font-bold uppercase tracking-[0.24em] text-[#121114] transition-colors duration-150 hover:bg-[#c6a465]"
            >
              <Download className="h-4 w-4" /> Save to Downloads
            </motion.button>
            {!isZip ? (
              <button
                onClick={() => void onCopy()}
                className="flex w-full items-center justify-center gap-2 border border-[#efedea]/20 px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#efedea]/70 transition-colors hover:border-[#c6a465] hover:text-[#c6a465]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                {copied ? "Copied to clipboard" : "Copy image to clipboard"}
              </button>
            ) : null}
            {!isZip ? (
              <p className="pt-1 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[#efedea]/35">
                You can also drag the image out, or right-click it → Save image as…
              </p>
            ) : null}
          </div>
        ) : phase === "failed" ? (
          <button
            onClick={() => window.close()}
            className="mt-6 flex w-full items-center justify-center gap-2 border border-[#efedea]/20 px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#efedea]/70 transition-colors hover:border-[#a63a50] hover:text-[#d98a97]"
          >
            <XCircle className="h-3.5 w-3.5" /> Close this tab
          </button>
        ) : null}
      </main>

      <p className="relative z-10 mt-auto pt-10 font-mono text-[9px] uppercase tracking-[0.26em] text-[#efedea]/25">
        This tab may be closed once the save completes
      </p>
    </div>
  );
}


