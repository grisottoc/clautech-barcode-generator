import { useEffect, useMemo, useState } from "react";
import type { Job } from "../shared/types";
import { generateQrRaster } from "../generator/qr";
import { renderMarginAndExport } from "../export/png";

function nowISO() {
  return new Date().toISOString();
}

/**
 * UI-only job builder.
 * Keeps App.tsx clean and avoids leaking form state into generators.
 */
function buildJob(payload: string): Job {
  return {
    id: crypto.randomUUID(),
    symbology: "qr",
    payload,

    size: {
      unit: "in",
      width: 1,
      height: 1,
      dpi: 300,
    },

    margin: { value: 0.1 },

    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export default function App() {
  const [payload, setPayload] = useState("HELLO WORLD");
  const [pngBytes, setPngBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const job = useMemo(() => buildJob(payload), [payload]);

  // Generate preview whenever job changes
  useEffect(() => {
    let canceled = false;

    async function run() {
      try {
        setError(null);

        const code = await generateQrRaster(job);
        const png = await renderMarginAndExport(job, code);

        if (!canceled) setPngBytes(png);
      } catch (e) {
        if (!canceled) {
          setError(e instanceof Error ? e.message : String(e));
          setPngBytes(null);
        }
      }
    }

    run();
    return () => {
      canceled = true;
    };
  }, [job]);

  const previewUrl = useMemo(() => {
    if (!pngBytes) return null;
    const blob = new Blob(
      [pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength)],
      { type: "image/png" }
    );
    return URL.createObjectURL(blob);
  }, [pngBytes]);

  async function onSaveAs() {
    if (!pngBytes) return;

    const res = await window.api.saveAsPng(job, pngBytes);
    if (!res.ok && res.reason === "error") {
      alert(res.error.message);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>ClautechBarCodeGenerator</h1>

      <section style={{ marginBottom: 16 }}>
        <label>
          Payload:&nbsp;
          <input
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            style={{ width: 320 }}
          />
        </label>
      </section>

      {error && (
        <div style={{ color: "red", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {previewUrl && (
        <section style={{ marginBottom: 16 }}>
          <img
            src={previewUrl}
            alt="QR preview"
            style={{ border: "1px solid #ccc" }}
          />
        </section>
      )}

      <button onClick={onSaveAs} disabled={!pngBytes}>
        Save as PNG…
      </button>
    </div>
  );
}
