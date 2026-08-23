import { useEffect } from "react";
import { useGenerate } from "./useGenerate";

/** ⌘/Ctrl + Enter shoots from anywhere in the studio. */
export function useKeyboardShortcuts() {
  const { generate, generating } = useGenerate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!generating) void generate({ count: 1 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [generate, generating]);
}
