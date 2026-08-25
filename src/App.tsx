import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useUIStore } from "./stores/ui";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { Header } from "./components/Header";
import { ControlPanel } from "./components/ControlPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { QuickActionModal } from "./components/QuickActionModal";
import { CompareOverlay } from "./components/CompareOverlay";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { Toasts } from "./components/Toasts";

/** Layered ambient backdrop: grain, soft tints, and an oversized folio mark. */
function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_-10%_-10%,rgba(140,42,64,0.07),transparent_60%),radial-gradient(50rem_36rem_at_110%_115%,rgba(176,141,87,0.09),transparent_60%)]" />
      <div className="grain absolute inset-0 opacity-[0.05] dark:opacity-[0.07]" />
      <p className="text-outline font-display wonk absolute -bottom-16 -right-6 select-none text-[26rem] italic leading-none opacity-60 sm:text-[34rem]">
        №1
      </p>
    </div>
  );
}

export default function App() {
  const theme = useUIStore((s) => s.theme);
  useKeyboardShortcuts();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBackground />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <Header />

        <main className="mx-auto w-full max-w-[1600px] flex-1 lg:grid lg:min-h-0 lg:grid-cols-[430px_minmax(0,1fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
          {/* 01 — The form, styled as the left column of an editorial spread */}
          <div className="relative border-b border-ink/15 dark:border-paper/15 lg:h-[calc(100dvh-97px)] lg:border-b-0 lg:border-r">
            <div className="px-5 pb-2 pt-5 sm:px-6 lg:hidden">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-wine-700 dark:text-gilt-400">
                01 — Direction
              </p>
              <h2 className="font-display wonk text-2xl font-semibold italic leading-none sm:text-3xl">The Shot List</h2>
            </div>
            <ControlPanel />
          </div>

          {/* 02 — The lightbox */}
          <div className="relative lg:h-[calc(100dvh-97px)]">
            <ResultsPanel />
            <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.22em] text-ink/25 dark:text-paper/20 lg:block">
              Mock darkroom · wire VITE_OPENAI_API_KEY or VITE_BFL_API_KEY to shoot live — see README
            </p>
          </div>
        </main>
      </div>

      <QuickActionModal />
      <CompareOverlay />
      <HistoryDrawer />
      <Toasts />
    </div>
  );
}
