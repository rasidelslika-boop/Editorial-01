import { Check, Link2, LogOut, Save } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildFlickrMetadata,
  disconnectFlickr,
  flickrIdentity,
  flickrWorkerUrl,
  setFlickrWorkerUrl,
} from "../lib/flickr";
import { useUIStore } from "../stores/ui";
import type { Generation } from "../types";
import { cn } from "../lib/utils";
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
  const [workerInput, setWorkerInput] = useState(flickrWorkerUrl() ?? "");
  const [savedWorker, setSavedWorker] = useState(flickrWorkerUrl());
  const [identity, setIdentity] = useState(flickrIdentity());

  const meta = useMemo(() => (gen ? buildFlickrMetadata(gen) : null), [gen, open]);

  const saveWorker = () => {
    if (!/^https?:\/\//.test(workerInput.trim())) {
      toast("That doesn't look like a URL", { description: "Paste the full https://…workers.dev address.", tone: "error" });
      return;
    }
    setFlickrWorkerUrl(workerInput);
    setSavedWorker(workerInput.trim().replace(/\/+$/, ""));
    toast("Relay saved", { tone: "success" });
  };

  const connect = () => {
    const worker = savedWorker ?? flickrWorkerUrl();
    if (!worker) {
      toast("Save the relay URL first", { tone: "error" });
      return;
    }
    const app = window.location.origin + window.location.pathname;
    window.open(`${worker}/auth/start?app=${encodeURIComponent(app)}`, "_blank", "noopener");
    toast("Authorise on Flickr", {
      description: "A tab opened — approve the app, and you'll land back here connected.",
      tone: "info",
    });
  };

  const disconnect = () => {
    disconnectFlickr();
    setIdentity(null);
    toast("Disconnected from Flickr", { tone: "info" });
  };

  const refresh = () => setIdentity(flickrIdentity());

  return (
    <Dialog open={open} onClose={onClose} kicker="08 · Distribution" title="Post to Flickr" wide>
      {/* Relay */}
      <div className="border border-ink/12 p-3.5 dark:border-paper/12">
        <Label>Signing relay (holds the key & secret — never the browser)</Label>
        <div className="flex gap-1.5">
          <input
            aria-label="Flickr relay worker URL"
            value={workerInput}
            onChange={(e) => setWorkerInput(e.target.value)}
            placeholder="https://rsfashionphoto-flickr.you.workers.dev"
            className={cn(inputCls, "font-mono text-xs")}
          />
          <Button variant="outline" size="md" onClick={saveWorker} className="shrink-0" aria-label="Save relay URL">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink/45 dark:text-paper/40">
          Deploy once: <span className="text-wine-700 dark:text-gilt-300">wrangler deploy worker/flickr-relay.js --name rsfashionphoto-flickr</span> — the
          API key & secret are coded into the worker (see README).
        </p>
      </div>

      {/* Connection */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border border-ink/12 p-3.5 dark:border-paper/12">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 bg-ink/[0.03] dark:border-paper/15 dark:bg-paper/[0.05]">
          <FlickrMark className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {identity ? (
            <>
              <p className="font-display text-base font-semibold italic leading-tight">Connected as @{identity.user}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45 dark:text-paper/40">nsid {identity.nsid || "—"}</p>
            </>
          ) : (
            <>
              <p className="font-display text-base font-semibold italic leading-tight">Not connected yet</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45 dark:text-paper/40">one-time authorisation on Flickr</p>
            </>
          )}
        </div>
        {identity ? (
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={refresh} aria-label="Refresh connection">
              <Check className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={disconnect} aria-label="Disconnect from Flickr">
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
        ) : (
          <Button variant="accent" size="md" onClick={connect} aria-label="Connect to Flickr">
            <Link2 className="h-3.5 w-3.5" /> Connect to Flickr
          </Button>
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
        One click of the Flickr button under the plate fetches the image, names it{" "}
        <span className="text-ink/70 dark:text-paper/65">IMG_xxxx</span>, writes the title, description and 30 tags above, and posts it public to your
        photostream.
      </p>
    </Dialog>
  );
}
