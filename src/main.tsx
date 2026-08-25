import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/**
 * Last line of defense — a render error anywhere in the tree lands here and
 * shows the real message instead of a blank screen.
 */
class BootBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      window.__rsBootError?.(`Render error: ${this.state.error.message}`);
      return null;
    }
    return this.props.children;
  }
}

declare global {
  interface Window {
    __rsBootError?: (msg: string) => void;
  }
}

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <BootBoundary>
      <App />
    </BootBoundary>
  );
} catch (err) {
  window.__rsBootError?.(err instanceof Error ? err.message : "React failed to mount.");
}
