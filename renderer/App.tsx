// // /renderer/App.tsx
// import { useEffect, useState } from "react";
// import type { HistoryItem, Job, Preset } from "../shared/types";
// import { generateQrRaster } from "../generator/qr";
// import { renderMarginAndExport } from "../export/png";

// function nowISO() {
//   return new Date().toISOString();
// }

// function makeId() {
//   return (
//     globalThis.crypto?.randomUUID?.() ??
//     `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
//   );
// }

// /**
//  * UI-only job builder.
//  * Keeps App.tsx clean and avoids leaking form state into generators.
//  */
// function buildJob(payload: string): Job {
//   const ts = nowISO();
//   return {
//     id: makeId(),
//     symbology: "qr",
//     payload,

//     size: {
//       unit: "in",
//       width: 1,
//       height: 1,
//       dpi: 300,
//     },

//     margin: { value: 0.1 },

//     createdAt: ts,
//     updatedAt: ts,
//   };
// }

// export default function App() {
//   const [job, setJob] = useState<Job>(() => buildJob("HELLO WORLD"));
//   const [pngBytes, setPngBytes] = useState<Uint8Array | null>(null);
//   const [previewUrl, setPreviewUrl] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const [presets, setPresets] = useState<Preset[]>([]);
//   const [history, setHistory] = useState<HistoryItem[]>([]);

//   // Load persisted presets + history on mount
//   useEffect(() => {
//     let canceled = false;

//     (async () => {
//       try {
//         const p = await window.api.getPresets();
//         if (!canceled) setPresets(p);

//         const h = await window.api.getHistory();
//         if (!canceled) setHistory(h);
//       } catch (e) {
//         if (!canceled) setError(e instanceof Error ? e.message : String(e));
//       }
//     })();

//     return () => {
//       canceled = true;
//     };
//   }, []);

//   // Generate preview whenever job changes
//   useEffect(() => {
//     let canceled = false;

//     (async () => {
//       try {
//         setError(null);

//         const code = await generateQrRaster(job);
//         const png = await renderMarginAndExport(job, code);

//         if (!canceled) setPngBytes(png);
//       } catch (e) {
//         if (!canceled) {
//           setError(e instanceof Error ? e.message : String(e));
//           setPngBytes(null);
//         }
//       }
//     })();

//     return () => {
//       canceled = true;
//     };
//   }, [job]);

//   // Manage object URL lifecycle to avoid leaks
//   useEffect(() => {
//     if (!pngBytes) {
//       setPreviewUrl(null);
//       return;
//     }

//     const ab = pngBytes.slice().buffer as ArrayBuffer;
//     const blob = new Blob([ab], { type: "image/png" });
//     const url = URL.createObjectURL(blob);

//     setPreviewUrl(url);
//     return () => URL.revokeObjectURL(url);
//   }, [pngBytes]);

//   async function appendHistorySnapshot(savedPath?: string) {
//     const item: HistoryItem = {
//       id: makeId(),
//       timestamp: nowISO(),
//       jobSnapshot: job,
//       ...(savedPath ? { savedPath } : {}),
//     };

//     const next = await window.api.addHistory(item);
//     setHistory(next);
//   }

//   async function onSaveAs() {
//     if (!pngBytes) return;

//     try {
//       const res = await window.api.saveAsPng(job, pngBytes);
//       if (res.ok) {
//         await appendHistorySnapshot(res.path);
//       } else if (res.reason === "error") {
//         alert(res.error.message);
//       }
//       // canceled -> no-op
//     } catch (e) {
//       alert(e instanceof Error ? e.message : String(e));
//     }
//   }

//   async function onSavePreset() {
//     // NOTE: payload is optional in JobDefaults; keeping it allows payload-including presets.
//     // If you want "format-only" presets, remove payload from jobDefaults.
//     const preset: Preset = {
//       id: makeId(),
//       name: `Preset ${new Date().toLocaleString()}`,
//       jobDefaults: {
//         symbology: job.symbology,
//         payload: job.payload,
//         size: job.size,
//         margin: job.margin,
//       },
//       createdAt: nowISO(),
//       updatedAt: nowISO(),
//     };

//     const next = await window.api.savePreset(preset);
//     setPresets(next);
//   }

//   async function onDeletePreset(id: string) {
//     const next = await window.api.deletePreset(id);
//     setPresets(next);
//   }

//   function onApplyPreset(preset: Preset) {
//     setJob((prev) => ({
//       ...prev,
//       ...preset.jobDefaults,
//       payload: preset.jobDefaults.payload ?? prev.payload,
//       id: makeId(),
//       updatedAt: nowISO(),
//     }));
//   }

//   function onRestoreHistory(item: HistoryItem) {
//     // Restore snapshot but refresh instance identifiers/timestamps for determinism
//     setJob({
//       ...item.jobSnapshot,
//       id: makeId(),
//       updatedAt: nowISO(),
//     });
//   }

//   return (
//     <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
//       <h1>ClautechBarCodeGenerator</h1>

//       <section style={{ marginBottom: 16 }}>
//         <label>
//           Payload:&nbsp;
//           <input
//             value={job.payload}
//             onChange={(e) =>
//               setJob((prev) => ({
//                 ...prev,
//                 payload: e.target.value,
//                 updatedAt: nowISO(),
//               }))
//             }
//             style={{ width: 320 }}
//           />
//         </label>
//       </section>

//       {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

//       {previewUrl && (
//         <section style={{ marginBottom: 16 }}>
//           <img
//             src={previewUrl}
//             alt="QR preview"
//             style={{ border: "1px solid #ccc" }}
//           />
//         </section>
//       )}

//       <button onClick={onSaveAs} disabled={!pngBytes}>
//         Save as PNG...
//       </button>

//       <div
//         style={{
//           borderTop: "1px solid #ddd",
//           marginTop: 12,
//           paddingTop: 12,
//         }}
//       >
//         <h3>Presets</h3>
//         <button onClick={onSavePreset}>Save Preset</button>

//         <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
//           {presets.map((p) => (
//             <div
//               key={p.id}
//               style={{ display: "flex", gap: 8, alignItems: "center" }}
//             >
//               <button
//                 onClick={() => onApplyPreset(p)}
//                 style={{ flex: 1, textAlign: "left" }}
//               >
//                 {p.name ?? p.id}
//               </button>
//               <button
//                 onClick={() => onDeletePreset(p.id)}
//                 aria-label="Delete preset"
//               >
//                 x
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div
//         style={{
//           borderTop: "1px solid #ddd",
//           marginTop: 12,
//           paddingTop: 12,
//         }}
//       >
//         <h3>History</h3>

//         <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
//           {history.slice(0, 10).map((h) => (
//             <button
//               key={h.id}
//               onClick={() => onRestoreHistory(h)}
//               style={{ textAlign: "left" }}
//             >
//               {h.jobSnapshot.symbology.toUpperCase()} -{" "}
//               {String(h.jobSnapshot.payload).slice(0, 24)}
//             </button>
//           ))}
//         </div>

//         <button
//           onClick={async () => {
//             const next = await window.api.clearHistory();
//             setHistory(next);
//           }}
//           style={{ marginTop: 8 }}
//         >
//           Clear History
//         </button>
//       </div>
//     </div>
//   );
// }


// /renderer/App.tsx
import { useEffect, useState } from "react";
import type { HistoryItem, Job, Preset, Symbology } from "../shared/types";
import { validateCode128Job } from "../validation/code128";
import { generateCode128Raster } from "../generator/code128";
import { generateQrRaster } from "../generator/qr";
import { generateDatamatrixRaster } from "../generator/datamatrix";
import { renderMarginAndExport } from "../export/png";
import { validateDatamatrixJob } from "../validation/datamatrix";
// (If you already have QR validation module, you can wire it similarly later.)

function nowISO() {
  return new Date().toISOString();
}

function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/**
 * UI-only job builder.
 */
function buildJob(payload: string, symbology: Symbology = "qr"): Job {
  const ts = nowISO();
  return {
    id: makeId(),
    symbology,
    payload,

    size: {
      unit: "in",
      width: 1,
      height: 1,
      dpi: 300,
    },

    margin: { value: 0.1 },

    createdAt: ts,
    updatedAt: ts,
  };
}

export default function App() {
  const [job, setJob] = useState<Job>(() => buildJob("p/n: ; s/n: ; cage: 1mpt3", "qr"));
  const [pngBytes, setPngBytes] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const p = await window.api.getPresets();
        if (!canceled) setPresets(p);

        const h = await window.api.getHistory();
        if (!canceled) setHistory(h);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        setError(null);

        // Validate + generate raster by symbology
        let raster: { width: number; height: number; data: Uint8Array };

        if (job.symbology === "qr") {
          raster = await generateQrRaster(job);
        } else if (job.symbology === "datamatrix") {
          const v = await validateDatamatrixJob(job);
          if (!v.ok) {
            throw new Error(v.error.message);
          }
          raster = await generateDatamatrixRaster(job);
          
        } else if (job.symbology === "code128") {
          const v = validateCode128Job(job);
          if (!v.ok) {
            throw new Error(v.error.message);
          }
          raster = await generateCode128Raster(job);

        } else {
          throw new Error("Barcode tab not implemented yet.");
        }

        const png = await renderMarginAndExport(job, raster);

        if (!canceled) setPngBytes(png);
      } catch (e) {
        if (!canceled) {
          setError(e instanceof Error ? e.message : String(e));
          setPngBytes(null);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [job]);

  useEffect(() => {
    if (!pngBytes) {
      setPreviewUrl(null);
      return;
    }

    const ab = pngBytes.slice().buffer as ArrayBuffer;
    const blob = new Blob([ab], { type: "image/png" });
    const url = URL.createObjectURL(blob);

    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pngBytes]);

  async function appendHistorySnapshot(savedPath?: string) {
    const item: HistoryItem = {
      id: makeId(),
      timestamp: nowISO(),
      jobSnapshot: job,
      ...(savedPath ? { savedPath } : {}),
    };

    const next = await window.api.addHistory(item);
    setHistory(next);
  }

  async function onSaveAs() {
    if (!pngBytes) return;

    try {
      const res = await window.api.saveAsPng(job, pngBytes);
      if (res.ok) {
        await appendHistorySnapshot(res.path);
      } else if (res.reason === "error") {
        alert(res.error.message);
      }
      // canceled -> no-op
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function onSavePreset() {
    const preset: Preset = {
      id: makeId(),
      name: `Preset ${new Date().toLocaleString()}`,
      jobDefaults: {
        symbology: job.symbology,
        payload: job.payload,
        size: job.size,
        margin: job.margin,
      },
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    const next = await window.api.savePreset(preset);
    setPresets(next);
  }

  async function onDeletePreset(id: string) {
    const next = await window.api.deletePreset(id);
    setPresets(next);
  }

  function onApplyPreset(preset: Preset) {
    setJob((prev) => ({
      ...prev,
      ...preset.jobDefaults,
      payload: preset.jobDefaults.payload ?? prev.payload,
      id: makeId(),
      updatedAt: nowISO(),
    }));
  }

  function onRestoreHistory(item: HistoryItem) {
    setJob({
      ...item.jobSnapshot,
      id: makeId(),
      updatedAt: nowISO(),
    });
  }

  function setSymbology(sym: Symbology) {
    setJob((prev) => ({
      ...prev,
      symbology: sym,
      // Smart defaults: keep square for QR/DataMatrix
      size:
        sym === "qr" || sym === "datamatrix"
          ? { ...prev.size, width: prev.size.width, height: prev.size.width }
          : prev.size,
      updatedAt: nowISO(),
    }));
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>ClautechBarCodeGenerator</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setSymbology("qr")}
          aria-pressed={job.symbology === "qr"}
        >
          QR
        </button>
        <button
          onClick={() => setSymbology("datamatrix")}
          aria-pressed={job.symbology === "datamatrix"}
        >
          Data Matrix
        </button>
        <button
          onClick={() => setSymbology("code128")}
          aria-pressed={job.symbology === "code128"}
        >
          Barcode
        </button>
      </div>

      <section style={{ marginBottom: 16 }}>
        <label>
          Payload:&nbsp;
          <input
            value={job.payload}
            onChange={(e) =>
              setJob((prev) => ({
                ...prev,
                payload: e.target.value,
                updatedAt: nowISO(),
              }))
            }
            style={{ width: 320 }}
          />
        </label>
      </section>

      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

      {previewUrl && (
        <section style={{ marginBottom: 16 }}>
          <img
            src={previewUrl}
            alt={`${job.symbology} preview`}
            style={{ border: "1px solid #ccc" }}
          />
        </section>
      )}

      <button onClick={onSaveAs} disabled={!pngBytes}>
        Save as PNG...
      </button>

      <div style={{ borderTop: "1px solid #ddd", marginTop: 12, paddingTop: 12 }}>
        <h3>Presets</h3>
        <button onClick={onSavePreset}>Save Preset</button>

        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {presets.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => onApplyPreset(p)} style={{ flex: 1, textAlign: "left" }}>
                {p.name ?? p.id}
              </button>
              <button onClick={() => onDeletePreset(p.id)} aria-label="Delete preset">
                x
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #ddd", marginTop: 12, paddingTop: 12 }}>
        <h3>History</h3>

        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {history.slice(0, 10).map((h) => (
            <button
              key={h.id}
              onClick={() => onRestoreHistory(h)}
              style={{ textAlign: "left" }}
            >
              {h.jobSnapshot.symbology.toUpperCase()} -{" "}
              {String(h.jobSnapshot.payload).slice(0, 24)}
            </button>
          ))}
        </div>

        <button
          onClick={async () => {
            const next = await window.api.clearHistory();
            setHistory(next);
          }}
          style={{ marginTop: 8 }}
        >
          Clear History
        </button>
      </div>
    </div>
  );
}
