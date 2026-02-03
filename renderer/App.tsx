import React from "react";

export default function App(): JSX.Element {
  const [pingResult, setPingResult] = React.useState<string>("(pending...)");

  React.useEffect(() => {
    let mounted = true;

    window.api
      .ping()
      .then((res) => {
        if (mounted) setPingResult(res);
        // Required smoke test visibility
        console.log("IPC ping →", res);
      })
      .catch((err) => {
        console.error("IPC ping failed:", err);
        if (mounted) setPingResult("(error)");
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      style={{
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
        padding: 24
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
        ClautechBarCodeGenerator
      </h1>

      <p style={{ marginTop: 10, marginBottom: 18, color: "#333" }}>
        Electron + React + Vite + TypeScript (offline scaffold)
      </p>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
          maxWidth: 520
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>IPC Smoke Test</div>
        <div style={{ color: "#111" }}>
          <span style={{ color: "#555" }}>window.api.ping():</span>{" "}
          <code>{pingResult}</code>
        </div>
        <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
          Check DevTools console for: <code>IPC ping → pong</code>
        </div>
      </div>
    </div>
  );
}
