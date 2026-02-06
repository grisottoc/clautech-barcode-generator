import { useEffect, useMemo, useState } from "react";
import type { Job } from "../shared/types";
import { generateQrRaster } from "../generator/qr";
import { renderMarginAndExport } from "../export/png";

export default function App() {
  const [status, setStatus] = useState<string>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pngBytes, setPngBytes] = useState<Uint8Array | null>(null);

  const job: Job = useMemo(() => {
    const now = new Date().toISOString();
    return {
      id: "smoke-qr-1",
      symbology: "qr",
      payload: "https://example.com",
      size: { unit: "in", width: 1, height: 1, dpi: 600 },
      // ~1mm expressed in inches (1mm / 25.4)
      margin: { value: 1 / 25.4 },
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  useEffect(() => {
    // cleanup blob URL
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function generateAndPreview() {
    try {
      setStatus("Generating QR raster...");
      const raster = await generateQrRaster(job);

      setStatus("Rendering margin + exporting PNG...");
      const bytes = await renderMarginAndExport(job, raster);
      setPngBytes(bytes);

      // Create preview URL
      // const blob = new Blob([bytes], { type: "image/png" });
      // const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], { type: "image/png" });
      const ab = bytes instanceof Uint8Array ? bytes.slice().buffer : new Uint8Array(bytes as any).slice().buffer;
      const blob = new Blob([ab], { type: "image/png" });


      const url = URL.createObjectURL(blob);

      // Revoke old URL to avoid leaks
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      setStatus(`Ready (PNG bytes: ${bytes.length})`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  }

  async function saveAs() {
    if (!pngBytes) {
      setStatus("Generate first.");
      return;
    }

    setStatus("Opening Save As...");
    // const res = await window.api.saveAsPng(job, pngBytes);
    const res = await (window.api as any).saveAsPng(job, pngBytes);


    if (res.ok) {
      setStatus(`Saved: ${res.path}`);
    } else if (res.reason === "canceled") {
      setStatus("Save canceled.");
    } else {
      setStatus(`Save failed: ${res.error.code} — ${res.error.message}`);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>QR Smoke Test</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={generateAndPreview}>Generate + Preview</button>
        <button onClick={saveAs} disabled={!pngBytes}>
          Save As PNG
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Status:</strong> {status}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div>
          <div style={{ marginBottom: 6 }}>
            <strong>Job</strong>
          </div>
          <pre style={{ fontSize: 12, background: "#f4f4f4", padding: 12, borderRadius: 8 }}>
            {JSON.stringify(job, null, 2)}
          </pre>
        </div>

        <div>
          <div style={{ marginBottom: 6 }}>
            <strong>Preview</strong>
          </div>
          <div
            style={{
              width: 320,
              height: 320,
              border: "1px solid #ddd",
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              background: "#fff",
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="QR preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  imageRendering: "pixelated",
                }}
              />
            ) : (
              <span style={{ color: "#666" }}>No preview yet</span>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            Tip: Click <em>Generate + Preview</em> then <em>Save As PNG</em>.
          </div>
        </div>
      </div>
    </div>
  );
}
