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
      // Self-contained recovery card — the boot guard only covers pre-mount
      // failures, so a mid-session render error must not blank the studio.
      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#121114",
            color: "#efedea",
            fontFamily: "Georgia, 'Times New Roman', serif",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 460,
              width: "100%",
              border: "1px solid #3a3733",
              padding: "36px 32px",
              textAlign: "center",
              background: "#161419",
            }}
          >
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                letterSpacing: ".3em",
                color: "#b08d57",
                textTransform: "uppercase",
                margin: "0 0 14px",
              }}
            >
              Editorial-RSF · Darkroom
            </p>
            <h1 style={{ fontStyle: "italic", fontWeight: 600, fontSize: 27, margin: "0 0 12px" }}>
              The studio hit a snag
            </h1>
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                lineHeight: 1.75,
                color: "#9a958e",
                margin: "0 0 22px",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message || "A render error occurred."}
            </p>
            <button
              onClick={() => location.reload()}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                background: "#b08d57",
                color: "#121114",
                border: "1px solid #b08d57",
                padding: "10px 18px",
                cursor: "pointer",
                marginRight: 10,
              }}
            >
              Reload the studio
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("editorial-ai:v4");
                  localStorage.removeItem("editorial-ai-ui:v1");
                } catch {
                  /* storage may already be unavailable */
                }
                location.reload();
              }}
              title="Clears the saved archive and settings in this browser, then reloads."
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                background: "transparent",
                color: "#c25a6e",
                border: "1px solid #742033",
                padding: "10px 18px",
                cursor: "pointer",
                marginRight: 10,
              }}
            >
              Reset & reload
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                background: "transparent",
                color: "#9a958e",
                border: "1px solid #3a3733",
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              Try to continue
            </button>
          </div>
        </div>
      );
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
