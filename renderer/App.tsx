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
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { HistoryItem, ImageFormat, Job, Preset, Symbology } from "../shared/types";
import { validateCode128Job } from "../validation/code128";
import { generateCode128Raster } from "../generator/code128";
import { generateQrRaster } from "../generator/qr";
import { generateDatamatrixRaster } from "../generator/datamatrix";
import { renderMarginAndExport } from "../export/png";
import { validateDatamatrixJob } from "../validation/datamatrix";
import datamatrixIcon from "./assets/icons/matrix icon.png";
import code128Icon from "./assets/icons/barcode icon.png";
import qrIcon from "./assets/icons/qr code icon.png";
import presetIcon from "./assets/icons/diskette (1).png";
import historyIcon from "./assets/icons/history.png";
// (If you already have QR validation module, you can wire it similarly later.)

type AnimatedContentProps = {
  children: ReactNode;
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  duration?: number;
  delay?: number;
  className?: string;
};

function AnimatedContent({
  children,
  className,
}: AnimatedContentProps) {
  return <div className={className}>{children}</div>;
}

type ShinyTextProps = {
  text: string;
  speed?: number;
  className?: string;
};

function ShinyText({ text, className }: ShinyTextProps) {
  return <span className={`rb-local-shiny ${className ?? ""}`.trim()}>{text}</span>;
}

type BentoBoxProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function BentoBox({ title, subtitle, children }: BentoBoxProps) {
  return (
    <section className="rb-bento-card">
      <header className="rb-bento-head">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="rb-bento-body">{children}</div>
    </section>
  );
}

type DockIconName = "datamatrix" | "code128" | "qr" | "presets" | "history";

function DockIcon({ name }: { name: DockIconName }) {
  if (name === "datamatrix") {
    return <img src={datamatrixIcon} alt="" draggable={false} />;
  }
  if (name === "code128") {
    return <img src={code128Icon} alt="" draggable={false} />;
  }
  if (name === "qr") {
    return <img src={qrIcon} alt="" draggable={false} />;
  }
  if (name === "presets") {
    return <img src={presetIcon} alt="" draggable={false} />;
  }
  if (name === "history") {
    return <img src={historyIcon} alt="" draggable={false} />;
  }
  return null;
}

type ListPanelProps<T> = {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  emptyMessage: string;
  renderItem: (item: T, index: number) => ReactNode;
  unstyled?: boolean;
};

function ListPanel<T>({
  items,
  getKey,
  emptyMessage,
  renderItem,
  unstyled = false,
}: ListPanelProps<T>) {
  return (
    <div className={`rb-bento-list ${unstyled ? "rb-bento-list-unstyled" : ""}`.trim()} role="list">
      {items.length > 0 ? (
        items.map((item, index) => (
          <div
            key={getKey(item, index)}
            role="listitem"
            className="rb-list-item"
          >
            {renderItem(item, index)}
          </div>
        ))
      ) : (
        <div className="rb-list-empty" role="note">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

const DPI_OPTIONS = [300, 600, 1200] as const;
const DATAMATRIX_MIN_MM = 8;
const DATAMATRIX_MAX_MM = 20;
const DATAMATRIX_STEP_MM = 0.5;
const DATAMATRIX_DEFAULT_MM = 9;
const DATAMATRIX_DEFAULT_PAYLOAD = "p/n: ; s/n: ; cage: 1mpt3";
const CODE128_MIN_WIDTH_MM = 20;
const CODE128_MAX_WIDTH_MM = 50;
const CODE128_WIDTH_STEP_MM = 1;
const CODE128_DEFAULT_WIDTH_MM = 30;
const CODE128_MIN_HEIGHT_MM = 3;
const CODE128_MAX_HEIGHT_MM = 10;
const CODE128_HEIGHT_STEP_MM = 0.5;
const CODE128_DEFAULT_HEIGHT_MM = 4;
const CODE128_DEFAULT_PAYLOAD = "Hello!! Type HERE to generate a BarCode";
const QR_DEFAULT_PAYLOAD = "Hello!! Type HERE to generate a QR Code";
const DATAMATRIX_SIZE_OPTIONS_MM = Array.from(
  { length: Math.round((DATAMATRIX_MAX_MM - DATAMATRIX_MIN_MM) / DATAMATRIX_STEP_MM) + 1 },
  (_, i) => Number((DATAMATRIX_MIN_MM + i * DATAMATRIX_STEP_MM).toFixed(1))
) as readonly number[];
const CODE128_WIDTH_OPTIONS_MM = Array.from(
  { length: Math.round((CODE128_MAX_WIDTH_MM - CODE128_MIN_WIDTH_MM) / CODE128_WIDTH_STEP_MM) + 1 },
  (_, i) => Number((CODE128_MIN_WIDTH_MM + i * CODE128_WIDTH_STEP_MM).toFixed(1))
) as readonly number[];
const CODE128_HEIGHT_OPTIONS_MM = Array.from(
  { length: Math.round((CODE128_MAX_HEIGHT_MM - CODE128_MIN_HEIGHT_MM) / CODE128_HEIGHT_STEP_MM) + 1 },
  (_, i) => Number((CODE128_MIN_HEIGHT_MM + i * CODE128_HEIGHT_STEP_MM).toFixed(1))
) as readonly number[];
const SYMBOLOGY_SWITCH_CARDS: ReadonlyArray<{
  symbology: Symbology;
  label: string;
  subtitle: string;
}> = [
  { symbology: "datamatrix", label: "Data Matrix", subtitle: "( ECC 200 DATA MATRIX )" },
  { symbology: "code128", label: "Barcode 128", subtitle: "Linear high-density barcode" },
  { symbology: "qr", label: "QR Code", subtitle: "General purpose matrix code" },
];
const DEFAULT_MODULE_CARD = {
  symbology: "datamatrix" as const,
  label: "Data Matrix",
  subtitle: "( ECC 200 DATA MATRIX )",
};

function isPresetDpi(value: number): boolean {
  return DPI_OPTIONS.includes(value as (typeof DPI_OPTIONS)[number]);
}

function isDatamatrixSizeOptionMm(value: number): boolean {
  const target = Number(value.toFixed(1));
  return DATAMATRIX_SIZE_OPTIONS_MM.some((v) => Math.abs(v - target) < 1e-9);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeDatamatrixMm(value: number): number {
  if (!Number.isFinite(value)) {
    return DATAMATRIX_DEFAULT_MM;
  }
  const clamped = clampNumber(value, DATAMATRIX_MIN_MM, DATAMATRIX_MAX_MM);
  const stepped = Math.round(clamped / DATAMATRIX_STEP_MM) * DATAMATRIX_STEP_MM;
  return Number(stepped.toFixed(1));
}

function isCode128WidthOptionMm(value: number): boolean {
  const target = Number(value.toFixed(1));
  return CODE128_WIDTH_OPTIONS_MM.some((v) => Math.abs(v - target) < 1e-9);
}

function isCode128HeightOptionMm(value: number): boolean {
  const target = Number(value.toFixed(1));
  return CODE128_HEIGHT_OPTIONS_MM.some((v) => Math.abs(v - target) < 1e-9);
}

function normalizeCode128WidthMm(value: number): number {
  if (!Number.isFinite(value)) {
    return CODE128_DEFAULT_WIDTH_MM;
  }
  const clamped = clampNumber(value, CODE128_MIN_WIDTH_MM, CODE128_MAX_WIDTH_MM);
  const stepped = Math.round(clamped / CODE128_WIDTH_STEP_MM) * CODE128_WIDTH_STEP_MM;
  return Number(stepped.toFixed(1));
}

function normalizeCode128HeightMm(value: number): number {
  if (!Number.isFinite(value)) {
    return CODE128_DEFAULT_HEIGHT_MM;
  }
  const clamped = clampNumber(value, CODE128_MIN_HEIGHT_MM, CODE128_MAX_HEIGHT_MM);
  const stepped = Math.round(clamped / CODE128_HEIGHT_STEP_MM) * CODE128_HEIGHT_STEP_MM;
  return Number(stepped.toFixed(1));
}

function formatMmLabel(value: number): string {
  return Number.isInteger(value) ? `${value.toFixed(0)} mm` : `${value.toFixed(1)} mm`;
}

function normalizeMarginForSymbology(sym: Symbology, margin: Job["margin"] | undefined): Job["margin"] {
  if (sym === "code128") {
    return { value: 0 };
  }
  const value = margin?.value;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return { value: 0.1 };
  }
  return { value };
}

function normalizeSizeForSymbology(sym: Symbology, size: Job["size"]): Job["size"] {
  if (sym === "datamatrix") {
    const sourceMm = size.unit === "mm" ? size.width : size.width * 25.4;
    const safeMm = normalizeDatamatrixMm(sourceMm);
    return { ...size, unit: "mm", width: safeMm, height: safeMm };
  }

  if (sym === "code128") {
    const sourceWidthMm = size.unit === "mm" ? size.width : size.width * 25.4;
    const sourceHeightMm = size.unit === "mm" ? size.height : size.height * 25.4;
    return {
      ...size,
      unit: "mm",
      width: normalizeCode128WidthMm(sourceWidthMm),
      height: normalizeCode128HeightMm(sourceHeightMm),
    };
  }

  if (sym === "qr") {
    return { ...size, width: size.width, height: size.width };
  }

  return size;
}

function getDatamatrixSizeMm(size: Job["size"]): number {
  const mm = size.unit === "mm" ? size.width : size.width * 25.4;
  return normalizeDatamatrixMm(mm);
}

function getCode128WidthMm(size: Job["size"]): number {
  const mm = size.unit === "mm" ? size.width : size.width * 25.4;
  return normalizeCode128WidthMm(mm);
}

function getCode128HeightMm(size: Job["size"]): number {
  const mm = size.unit === "mm" ? size.height : size.height * 25.4;
  return normalizeCode128HeightMm(mm);
}

function getCompactSizeLabel(sym: Symbology, size: Job["size"]): string {
  const precision = size.unit === "mm" ? 1 : 2;

  if (sym === "datamatrix") {
    return formatMmLabel(getDatamatrixSizeMm(size));
  }

  if (sym === "code128") {
    return `${size.width.toFixed(precision)} x ${size.height.toFixed(precision)} ${size.unit}`;
  }

  return `${size.width.toFixed(precision)} ${size.unit} square`;
}

function buildPresetNameFromJob(job: Job): string {
  const sizeLabel =
    job.symbology === "datamatrix"
      ? `${getDatamatrixSizeMm(job.size).toFixed(1)}mm`
      : `${job.size.width.toFixed(job.size.unit === "mm" ? 1 : 2)}x${job.size.height.toFixed(
          job.size.unit === "mm" ? 1 : 2
        )}${job.size.unit}`;
  const invertTag = job.invertOutput ? "_INV" : "";
  return `${job.symbology.toUpperCase()}_${sizeLabel}_${job.size.dpi}DPI${invertTag}`;
}

function getFileNameFromPath(savedPath?: string): string | null {
  if (!savedPath) return null;
  const parts = savedPath.split(/[\\/]/).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1] ?? null;
}

function buildHistoryLabel(item: HistoryItem): string {
  const savedName = getFileNameFromPath(item.savedPath);
  if (savedName) return savedName;
  return buildPresetNameFromJob(item.jobSnapshot);
}

function getPresetPayloadPrefix(symbology: Symbology): string {
  if (symbology === "datamatrix") return "DM- ";
  if (symbology === "code128") return "BC- ";
  return "QR- ";
}

function buildPrefixedPayloadName(symbology: Symbology, payload: string): string {
  return `${getPresetPayloadPrefix(symbology)}${payload}`;
}

function buildPresetLabel(preset: Preset): string {
  if (typeof preset.jobDefaults.payload === "string" && preset.jobDefaults.symbology) {
    return buildPrefixedPayloadName(preset.jobDefaults.symbology, preset.jobDefaults.payload);
  }
  return preset.name ?? preset.id;
}

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
  const defaultSize =
    symbology === "datamatrix"
      ? { unit: "mm" as const, width: DATAMATRIX_DEFAULT_MM, height: DATAMATRIX_DEFAULT_MM, dpi: 1200 }
      : symbology === "code128"
      ? {
          unit: "mm" as const,
          width: CODE128_DEFAULT_WIDTH_MM,
          height: CODE128_DEFAULT_HEIGHT_MM,
          dpi: 1200,
        }
      : { unit: "in" as const, width: 1, height: 1, dpi: 300 };
  return {
    id: makeId(),
    symbology,
    payload,

    size: defaultSize,

    margin: normalizeMarginForSymbology(symbology, { value: 0.1 }),
    invertOutput: symbology === "datamatrix",

    createdAt: ts,
    updatedAt: ts,
  };
}

export default function App() {
  const [job, setJob] = useState<Job>(() => buildJob(DATAMATRIX_DEFAULT_PAYLOAD, "datamatrix"));
  const [pngBytes, setPngBytes] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanTestText, setScanTestText] = useState("");
  const [saveFormat, setSaveFormat] = useState<ImageFormat>("bmp");
  const [showPresets, setShowPresets] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const moduleShellRef = useRef<HTMLDivElement | null>(null);
  const [sideStackHeightPx, setSideStackHeightPx] = useState<number | null>(null);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function generatePngForJob(sourceJob: Job): Promise<Uint8Array> {
    let raster: { width: number; height: number; data: Uint8Array };

    if (sourceJob.symbology === "qr") {
      raster = await generateQrRaster(sourceJob);
    } else if (sourceJob.symbology === "datamatrix") {
      const v = await validateDatamatrixJob(sourceJob);
      if (!v.ok) {
        throw new Error(v.error.message);
      }
      raster = await generateDatamatrixRaster(sourceJob);
    } else if (sourceJob.symbology === "code128") {
      const v = validateCode128Job(sourceJob);
      if (!v.ok) {
        throw new Error(v.error.message);
      }
      raster = await generateCode128Raster(sourceJob);
    } else {
      throw new Error("Barcode tab not implemented yet.");
    }

    return renderMarginAndExport(sourceJob, raster, {
      invert: sourceJob.invertOutput ?? false,
    });
  }

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
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (evt: MediaQueryListEvent) => {
      setIsSystemDark(evt.matches);
    };
    media.addEventListener("change", onChange);
    setIsSystemDark(media.matches);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        setError(null);
        const png = await generatePngForJob(job);

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

  useEffect(() => {
    const node = moduleShellRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      setSideStackHeightPx(null);
      return;
    }

    const syncHeight = () => {
      const next = Math.max(0, Math.round(node.getBoundingClientRect().height));
      setSideStackHeightPx((prev) => (prev === next ? prev : next));
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

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
      const png = await generatePngForJob(job);
      setPngBytes(png);
      const res = await window.api.saveAsImage(job, png, saveFormat);
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
      name: buildPrefixedPayloadName(job.symbology, job.payload),
      jobDefaults: {
        symbology: job.symbology,
        payload: job.payload,
        size: job.size,
        margin: normalizeMarginForSymbology(job.symbology, job.margin),
        invertOutput: job.invertOutput ?? false,
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
    setJob((prev) => {
      const mergedSymbology = preset.jobDefaults.symbology ?? prev.symbology;
      const mergedSize = preset.jobDefaults.size ?? prev.size;
      const mergedMargin = normalizeMarginForSymbology(
        mergedSymbology,
        preset.jobDefaults.margin ?? prev.margin
      );
      return {
        ...prev,
        ...preset.jobDefaults,
        size: normalizeSizeForSymbology(mergedSymbology, mergedSize),
        margin: mergedMargin,
        payload: preset.jobDefaults.payload ?? prev.payload,
        invertOutput: preset.jobDefaults.invertOutput ?? prev.invertOutput ?? false,
        id: makeId(),
        updatedAt: nowISO(),
      };
    });
  }

  function onRestoreHistory(item: HistoryItem) {
    setJob({
      ...item.jobSnapshot,
      size: normalizeSizeForSymbology(item.jobSnapshot.symbology, item.jobSnapshot.size),
      margin: normalizeMarginForSymbology(item.jobSnapshot.symbology, item.jobSnapshot.margin),
      invertOutput: item.jobSnapshot.invertOutput ?? false,
      id: makeId(),
      updatedAt: nowISO(),
    });
  }

  function setSymbology(sym: Symbology) {
    setJob((prev) => {
      const switched = sym !== prev.symbology;
      const defaultPayload =
        sym === "datamatrix"
          ? DATAMATRIX_DEFAULT_PAYLOAD
          : sym === "code128"
          ? CODE128_DEFAULT_PAYLOAD
          : QR_DEFAULT_PAYLOAD;
      const nextSize =
        switched && sym === "datamatrix"
          ? {
              unit: "mm" as const,
              width: DATAMATRIX_DEFAULT_MM,
              height: DATAMATRIX_DEFAULT_MM,
              dpi: 1200,
            }
          : switched && sym === "code128"
          ? {
              unit: "mm" as const,
              width: CODE128_DEFAULT_WIDTH_MM,
              height: CODE128_DEFAULT_HEIGHT_MM,
              dpi: 1200,
            }
          : switched && sym === "qr"
          ? {
              unit: "in" as const,
              width: 1,
              height: 1,
              dpi: 300,
            }
          : normalizeSizeForSymbology(sym, prev.size);

      return {
        ...prev,
        symbology: sym,
        payload: switched ? defaultPayload : prev.payload,
        size: nextSize,
        margin: normalizeMarginForSymbology(sym, prev.margin),
        updatedAt: nowISO(),
      };
    });
    if (sym === "code128") {
      setSaveFormat("bmp");
    }
  }

  const datamatrixSizeMm = getDatamatrixSizeMm(job.size);
  const code128WidthMm = getCode128WidthMm(job.size);
  const code128HeightMm = getCode128HeightMm(job.size);
  const isDatamatrix = job.symbology === "datamatrix";
  const isCode128 = job.symbology === "code128";
  const isQr = job.symbology === "qr";
  const activeModuleCard =
    SYMBOLOGY_SWITCH_CARDS.find((card) => card.symbology === job.symbology) ??
    DEFAULT_MODULE_CARD;
  const activePreviewBoxStyle: CSSProperties = isCode128
    ? { width: "min(690px, 100%)", aspectRatio: "690 / 342" }
    : { width: "min(342px, 100%)", aspectRatio: "1 / 1" };
  const resolvedTheme: "light" | "dark" = isSystemDark ? "dark" : "light";
  const trimmedScanTest = scanTestText.trim();
  const trimmedPayload = job.payload.trim();
  const scanTestStatus =
    trimmedScanTest.length === 0
      ? "idle"
      : trimmedScanTest === trimmedPayload
      ? "match"
      : "mismatch";
  const sideStackStyle = sideStackHeightPx
    ? ({ ["--side-stack-height" as string]: `${sideStackHeightPx}px` } as CSSProperties)
    : undefined;

  return (
    <div className={`app-shell ${resolvedTheme === "dark" ? "rb-theme-dark" : "rb-theme-light"}`}>
      <style>{`
        .app-shell {
          --generator-height: 620px;
          --container-gap: 30px;
          --side-container-gap: 30px;
          --dock-modules-gap: 30px;
          --halo-border: rgba(36, 210, 255, 0.78);
          --halo-ring-soft: 0 0 0 4px rgba(36, 210, 255, 0.24);
          --halo-ring-strong: 0 0 0 4px rgba(36, 210, 255, 0.32);
          min-height: 100%;
          height: 100%;
          padding: 16px 32px;
          box-sizing: border-box;
          overflow-y: auto;
          overflow-x: hidden;
          font-family: "Inter", "Segoe UI", "Trebuchet MS", sans-serif;
          color: var(--text-main);
          background: var(--app-bg);
        }

        .app-shell.rb-theme-dark {
          --app-bg: #0b1020;
          --card: #12192d;
          --card-border: rgba(255, 255, 255, 0.15);
          --text-main: #eef4fa;
          --text-dim: #9fb1c4;
          --accent: #2a7fff;
          --surface: #10172a;
          --surface-strong: #0f1628;
          --field-bg: #0d1425;
          --preview-bg: #0b1324;
          --panel-shadow: 0 14px 35px rgba(0, 0, 0, 0.3);
          --title-dim: #eef4fa;
          color-scheme: dark;
        }

        .app-shell.rb-theme-light {
          --app-bg: #f3f6fb;
          --card: #ffffff;
          --card-border: rgba(13, 36, 59, 0.28);
          --text-main: #081d31;
          --text-dim: #2b4866;
          --accent: #1f6fff;
          --surface: #e9eff8;
          --surface-strong: #f8fbff;
          --field-bg: #ffffff;
          --preview-bg: #eef3fb;
          --panel-shadow: 0 14px 35px rgba(16, 39, 61, 0.2);
          --title-dim: #102744;
          color-scheme: light;
        }

        .rb-panel {
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
          background: var(--card);
          box-shadow: var(--panel-shadow);
        }

        .rb-panel h3 {
          margin: 0 0 10px 0;
        }

        .rb-row {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .rb-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
          gap: var(--container-gap);
          margin-bottom: var(--dock-modules-gap);
          align-items: stretch;
        }

        .rb-toolbar-main {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .rb-toolbar-title {
          margin: 0;
          letter-spacing: 0.03em;
          font-size: clamp(1.1rem, 1.7vw, 1.55rem);
          font-weight: 700;
          color: var(--title-dim);
        }

        .rb-reactbits-title {
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .rb-local-shiny {
          color: var(--title-dim);
        }

        .rb-dock-controls {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(78px, 104px));
          justify-content: space-between;
          align-items: stretch;
          gap: 10px;
        }

        .rb-dock-button {
          width: 100%;
          min-height: 78px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          background: var(--surface-strong);
          color: var(--text-main);
          padding: 8px 10px;
          cursor: pointer;
          transition: border-color 0.18s ease, background-color 0.18s ease;
        }

        .rb-dock-button:hover {
          border-color: var(--card-border);
          box-shadow: none;
        }

        .rb-dock-button.rb-dock-active {
          border-color: var(--halo-border);
          box-shadow: none;
        }

        .rb-dock-icon {
          width: 28px;
          height: 28px;
          color: inherit;
          opacity: 1;
          transition: opacity 0.18s ease;
        }

        .rb-dock-icon svg {
          display: block;
          width: 100%;
          height: 100%;
          stroke: currentColor;
          fill: none;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .rb-dock-icon img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .rb-dock-button:hover .rb-dock-icon {
          opacity: 1;
        }

        .rb-dock-label {
          font-size: 0.7rem;
          font-weight: 600;
          line-height: 1;
          letter-spacing: 0.02em;
          color: var(--text-dim);
          text-align: center;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          max-width: 100%;
        }

        .rb-dock-button.rb-dock-active .rb-dock-label {
          color: var(--text-main);
        }

        .rb-test-panel {
          display: grid;
          gap: 6px;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          background: var(--surface);
          padding: 10px;
        }

        .rb-test-panel h4 {
          margin: 0;
          font-size: 0.8rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-dim);
        }

        .rb-textarea {
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: var(--field-bg);
          color: var(--text-main);
          padding: 8px 10px;
          min-height: 76px;
          resize: vertical;
          font: inherit;
          line-height: 1.3;
        }

        .rb-textarea:focus {
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          outline: none;
        }

        .rb-test-status {
          font-size: 0.78rem;
          color: var(--text-dim);
        }

        .rb-test-status.rb-match {
          color: #3ccf91;
          font-weight: 600;
        }

        .rb-test-status.rb-mismatch {
          color: #ff7171;
          font-weight: 600;
        }

        .rb-modules-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
        }

        .rb-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
          gap: var(--container-gap);
          align-items: stretch;
        }

        .rb-module-shell .rb-bento-card {
          min-height: var(--generator-height);
        }

        .rb-module-shell.rb-module-active .rb-bento-card {
          border-color: var(--halo-border);
          box-shadow: var(--halo-ring-strong), 0 14px 30px rgba(0, 0, 0, 0.3);
        }

        .rb-side-stack {
          display: grid;
          gap: var(--side-container-gap);
          align-content: stretch;
          min-height: var(--generator-height);
          height: var(--side-stack-height, var(--generator-height));
          grid-template-rows: minmax(0, 1fr);
        }

        .rb-side-stack.rb-side-stack-split {
          grid-template-rows: repeat(2, minmax(0, 1fr));
        }

        .rb-side-card {
          display: grid;
          min-height: 0;
          overflow: hidden;
        }

        .rb-side-card .rb-bento-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .rb-side-card .rb-bento-list {
          flex: 1;
          min-height: 0;
          max-height: none;
        }

        .rb-side-card .rb-bento-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          gap: 10px;
        }

        .rb-side-card.rb-side-card-unstyled .rb-bento-card {
          border: none;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          padding: 0;
        }

        .rb-side-card.rb-side-card-unstyled .rb-bento-head h3 {
          font-size: 1.35rem;
        }

        .rb-side-card.rb-side-card-unstyled .rb-bento-head p {
          margin-top: 2px;
        }

        .rb-side-card.rb-side-card-unstyled .rb-bento-body {
          margin-top: 8px;
        }

        .rb-side-card.rb-side-card-unstyled .rb-button {
          transition: none;
        }

        .rb-side-card.rb-side-card-unstyled .rb-button:hover,
        .rb-side-card.rb-side-card-unstyled .rb-button:focus,
        .rb-side-card.rb-side-card-unstyled .rb-button:focus-visible {
          border-color: var(--card-border);
          box-shadow: none;
        }

        .rb-module-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
        }

        .rb-module-body {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 10px;
          align-items: end;
        }

        .rb-module-field {
          display: grid;
          gap: 4px;
          font-size: 0.82rem;
          color: var(--text-dim);
        }

        .rb-module-field-wide {
          grid-column: 1 / -1;
        }

        .rb-module-check {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.88rem;
          color: var(--text-dim);
        }

        .rb-module-save {
          width: fit-content;
          align-self: end;
          transition: none;
          animation: none;
        }

        .rb-button.rb-module-save:hover,
        .rb-button.rb-module-save:focus,
        .rb-button.rb-module-save:focus-visible {
          box-shadow: none;
          transition: none;
          animation: none;
        }

        .rb-button.rb-module-save:active {
          filter: none;
          transition: none;
          animation: none;
        }

        .rb-module-preview {
          display: grid;
          gap: 6px;
          justify-items: start;
        }

        .rb-module-preview-label {
          font-size: 0.72rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--text-dim);
        }

        .rb-module-preview-frame {
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 10px;
          background: var(--preview-bg);
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .rb-module-preview-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }

        .rb-module-preview-empty {
          font-size: 0.76rem;
          color: var(--text-dim);
          padding: 8px;
          text-align: center;
        }

        .rb-input,
        .rb-select,
        .rb-button {
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: var(--field-bg);
          color: var(--text-main);
          padding: 6px 10px;
        }

        .rb-input:focus,
        .rb-select:focus {
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          outline: none;
        }

        .rb-button:hover,
        .rb-button:focus,
        .rb-button:focus-visible {
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          outline: none;
        }

        .rb-button:active {
          filter: brightness(0.98);
        }

        .rb-button-with-icon {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .rb-side-action {
          width: 168px;
          justify-content: center;
          align-self: start;
        }

        .rb-inline-icon {
          display: inline-flex;
          width: 16px;
          height: 16px;
          opacity: 0.9;
        }

        .rb-inline-icon svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .rb-inline-icon img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .rb-muted {
          color: var(--text-dim);
        }

        .rb-bento-card {
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.17);
          border-radius: 14px;
          min-height: 270px;
          padding: 14px;
          background: var(--card);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.26);
        }

        .rb-bento-head,
        .rb-bento-body {
          position: relative;
        }

        .rb-bento-head h3 {
          margin: 0;
          font-size: 1.05rem;
        }

        .rb-bento-head p {
          margin: 4px 0 0 0;
          color: var(--text-dim);
          font-size: 0.84rem;
        }

        .rb-bento-body {
          margin-top: 12px;
          display: grid;
          gap: 8px;
        }

        .app-shell,
        .rb-bento-list,
        .rb-textarea {
          scrollbar-width: thin;
          scrollbar-color: rgba(36, 210, 255, 0.52) rgba(255, 255, 255, 0.08);
        }

        .rb-bento-list {
          display: grid;
          gap: 6px;
          max-height: 224px;
          overflow: auto;
          padding-right: 2px;
          outline: none;
        }

        .app-shell::-webkit-scrollbar,
        .rb-bento-list::-webkit-scrollbar,
        .rb-textarea::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .app-shell::-webkit-scrollbar-track,
        .rb-bento-list::-webkit-scrollbar-track,
        .rb-textarea::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 999px;
        }

        .app-shell::-webkit-scrollbar-thumb,
        .rb-bento-list::-webkit-scrollbar-thumb,
        .rb-textarea::-webkit-scrollbar-thumb {
          background: rgba(36, 210, 255, 0.55);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .rb-list-item {
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 2px;
          transition: none;
        }

        .rb-list-item:hover,
        .rb-list-item:focus-within {
          border-color: rgba(36, 210, 255, 0.42);
          box-shadow: 0 0 0 1px rgba(36, 210, 255, 0.18);
        }

        .rb-list-empty {
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 10px;
          color: var(--text-dim);
          font-size: 0.86rem;
          background: rgba(255, 255, 255, 0.03);
        }

        .rb-list-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .rb-list-main {
          flex: 1;
          text-align: left;
        }

        .rb-list-action {
          min-width: 36px;
        }

        .rb-bento-list.rb-bento-list-unstyled {
          gap: 8px;
          padding-right: 0;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .rb-bento-list.rb-bento-list-unstyled::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .rb-bento-list.rb-bento-list-unstyled .rb-list-item {
          border: none;
          border-radius: 0;
          padding: 0;
          box-shadow: none;
          transition: none;
        }

        .rb-bento-list.rb-bento-list-unstyled .rb-list-item:hover,
        .rb-bento-list.rb-bento-list-unstyled .rb-list-item:focus-within {
          border-color: transparent;
          box-shadow: none;
        }

        .rb-bento-list.rb-bento-list-unstyled .rb-list-row .rb-button {
          transition: none;
        }

        .rb-bento-list.rb-bento-list-unstyled .rb-list-row .rb-button:hover,
        .rb-bento-list.rb-bento-list-unstyled .rb-list-row .rb-button:focus,
        .rb-bento-list.rb-bento-list-unstyled .rb-list-row .rb-button:focus-visible {
          border-color: var(--card-border);
          box-shadow: none;
        }

        .rb-bento-list.rb-bento-list-unstyled .rb-list-empty {
          border: none;
          background: transparent;
          padding: 2px 0;
        }

        @media (max-width: 720px) {
          .app-shell {
            padding: 12px 16px;
          }

          .rb-toolbar {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 16px;
          }

          .rb-dock-controls {
            gap: 8px;
            grid-template-columns: repeat(auto-fit, minmax(72px, 94px));
            justify-content: space-between;
          }

          .rb-workspace {
            grid-template-columns: 1fr;
          }

          .rb-side-stack {
            height: auto;
            gap: 20px;
          }

          .rb-side-stack.rb-side-stack-split {
            grid-template-rows: none;
          }

          .rb-module-body {
            grid-template-columns: 1fr;
          }

          .rb-modules-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      {/* Modules */}
      <AnimatedContent>
        <div className="rb-panel">
          <div className="rb-toolbar">
            <div className="rb-toolbar-main">
              <h1 className="rb-toolbar-title">
                <ShinyText
                  text="ClautechBarCodeGenerator"
                  className="rb-reactbits-title"
                />
              </h1>
              <div className="rb-dock-controls" role="toolbar" aria-label="Module dock">
                {SYMBOLOGY_SWITCH_CARDS.map((card) => (
                  <button
                    key={card.symbology}
                    type="button"
                    className={`rb-dock-button ${job.symbology === card.symbology ? "rb-dock-active" : ""}`}
                    onClick={() => setSymbology(card.symbology)}
                    aria-pressed={job.symbology === card.symbology}
                    aria-label={card.label}
                    title={card.label}
                  >
                    <span className="rb-dock-icon" data-icon={card.symbology}>
                      <DockIcon name={card.symbology} />
                    </span>
                    <span className="rb-dock-label">{card.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`rb-dock-button ${showPresets ? "rb-dock-active" : ""}`}
                  onClick={() => setShowPresets((prev) => !prev)}
                  aria-pressed={showPresets}
                  aria-label="Presets"
                  title="Presets"
                >
                  <span className="rb-dock-icon" data-icon="presets">
                    <DockIcon name="presets" />
                  </span>
                  <span className="rb-dock-label">Presets</span>
                </button>
                <button
                  type="button"
                  className={`rb-dock-button ${showHistory ? "rb-dock-active" : ""}`}
                  onClick={() => setShowHistory((prev) => !prev)}
                  aria-pressed={showHistory}
                  aria-label="History"
                  title="History"
                >
                  <span className="rb-dock-icon" data-icon="history">
                    <DockIcon name="history" />
                  </span>
                  <span className="rb-dock-label">History</span>
                </button>
              </div>
            </div>

            <section className="rb-test-panel" aria-label="Print scan test area">
              <h4>Print Scan Test</h4>
              <textarea
                className="rb-textarea"
                value={scanTestText}
                onChange={(e) => setScanTestText(e.target.value)}
                placeholder="Paste scanned text after printing..."
              />
              <div
                className={`rb-test-status ${
                  scanTestStatus === "match"
                    ? "rb-match"
                    : scanTestStatus === "mismatch"
                    ? "rb-mismatch"
                    : ""
                }`.trim()}
              >
                {scanTestStatus === "idle"
                  ? "Waiting for scanner input."
                  : scanTestStatus === "match"
                  ? "Match: scanned text equals current payload."
                  : "Mismatch: scanned text differs from current payload."}
              </div>
            </section>
          </div>

          <div className="rb-workspace">
            <div className="rb-modules-grid">
              <div
                ref={moduleShellRef}
                className="rb-module-shell rb-module-active"
                aria-label={`${activeModuleCard.label} module`}
              >
                <BentoBox title={activeModuleCard.label} subtitle={activeModuleCard.subtitle}>
                  <div className="rb-module-top">
                    <label className="rb-module-field rb-module-field-wide">
                      Payload
                      <input
                        className="rb-input"
                        value={job.payload}
                        onChange={(e) =>
                          setJob((prev) => ({
                            ...prev,
                            payload: e.target.value,
                            updatedAt: nowISO(),
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="rb-module-body">
                    <div className="rb-module-preview rb-module-field-wide">
                      <span className="rb-module-preview-label">Preview</span>
                      <div className="rb-module-preview-frame" style={activePreviewBoxStyle}>
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={`${job.symbology} preview`}
                            className="rb-module-preview-image"
                          />
                        ) : (
                          <span className="rb-module-preview-empty">Generating preview...</span>
                        )}
                      </div>
                    </div>

                    <label className="rb-module-field">
                      {isDatamatrix ? "Size (8-20 mm)" : isCode128 ? "Width (20-50 mm)" : "Width"}
                      <select
                        className="rb-select"
                        disabled={isQr}
                        value={
                          isDatamatrix
                            ? datamatrixSizeMm.toFixed(1)
                            : isCode128
                            ? code128WidthMm.toFixed(1)
                            : "na"
                        }
                        onChange={(e) => {
                          if (isDatamatrix) {
                            const nextMm = Number(e.target.value);
                            if (!Number.isFinite(nextMm)) return;
                            const safeMm = normalizeDatamatrixMm(nextMm);
                            setJob((prev) => ({
                              ...prev,
                              size: { ...prev.size, unit: "mm", width: safeMm, height: safeMm },
                              updatedAt: nowISO(),
                            }));
                            return;
                          }
                          if (isCode128) {
                            const nextWidthMm = Number(e.target.value);
                            if (!Number.isFinite(nextWidthMm)) return;
                            const safeWidthMm = normalizeCode128WidthMm(nextWidthMm);
                            setJob((prev) => {
                              const prevHeightMm =
                                prev.size.unit === "mm" ? prev.size.height : prev.size.height * 25.4;
                              return {
                                ...prev,
                                size: {
                                  ...prev.size,
                                  unit: "mm",
                                  width: safeWidthMm,
                                  height: normalizeCode128HeightMm(prevHeightMm),
                                },
                                updatedAt: nowISO(),
                              };
                            });
                          }
                        }}
                      >
                        {isDatamatrix &&
                          !isDatamatrixSizeOptionMm(datamatrixSizeMm) && (
                            <option value={datamatrixSizeMm.toFixed(1)}>
                              {formatMmLabel(datamatrixSizeMm)}
                            </option>
                          )}
                        {isDatamatrix &&
                          DATAMATRIX_SIZE_OPTIONS_MM.map((mm) => (
                            <option key={mm.toFixed(1)} value={mm.toFixed(1)}>
                              {formatMmLabel(mm)}
                            </option>
                          ))}
                        {isCode128 &&
                          !isCode128WidthOptionMm(code128WidthMm) && (
                            <option value={code128WidthMm.toFixed(1)}>
                              {formatMmLabel(code128WidthMm)}
                            </option>
                          )}
                        {isCode128 &&
                          CODE128_WIDTH_OPTIONS_MM.map((mm) => (
                            <option key={mm.toFixed(1)} value={mm.toFixed(1)}>
                              {formatMmLabel(mm)}
                            </option>
                          ))}
                        {isQr && <option value="na">Auto</option>}
                      </select>
                    </label>

                    <label className="rb-module-field">
                      {isCode128 ? "Height (3-10 mm)" : "Height"}
                      <select
                        className="rb-select"
                        disabled={!isCode128}
                        value={
                          isCode128
                            ? code128HeightMm.toFixed(1)
                            : isDatamatrix
                            ? datamatrixSizeMm.toFixed(1)
                            : "na"
                        }
                        onChange={(e) => {
                          if (!isCode128) return;
                          const nextHeightMm = Number(e.target.value);
                          if (!Number.isFinite(nextHeightMm)) return;
                          const safeHeightMm = normalizeCode128HeightMm(nextHeightMm);
                          setJob((prev) => {
                            const prevWidthMm =
                              prev.size.unit === "mm" ? prev.size.width : prev.size.width * 25.4;
                            return {
                              ...prev,
                              size: {
                                ...prev.size,
                                unit: "mm",
                                width: normalizeCode128WidthMm(prevWidthMm),
                                height: safeHeightMm,
                              },
                              updatedAt: nowISO(),
                            };
                          });
                        }}
                      >
                        {isCode128 &&
                          !isCode128HeightOptionMm(code128HeightMm) && (
                            <option value={code128HeightMm.toFixed(1)}>
                              {formatMmLabel(code128HeightMm)}
                            </option>
                          )}
                        {isCode128 &&
                          CODE128_HEIGHT_OPTIONS_MM.map((mm) => (
                            <option key={mm.toFixed(1)} value={mm.toFixed(1)}>
                              {formatMmLabel(mm)}
                            </option>
                          ))}
                        {!isCode128 && <option value={isDatamatrix ? datamatrixSizeMm.toFixed(1) : "na"}>Auto</option>}
                      </select>
                    </label>

                    <label className="rb-module-field">
                      DPI
                      <select
                        className="rb-select"
                        value={String(job.size.dpi)}
                        onChange={(e) => {
                          const nextDpi = Number(e.target.value);
                          if (!Number.isInteger(nextDpi) || nextDpi <= 0) return;
                          setJob((prev) => ({
                            ...prev,
                            size: { ...prev.size, dpi: nextDpi },
                            updatedAt: nowISO(),
                          }));
                        }}
                      >
                        {!isPresetDpi(job.size.dpi) && <option value={job.size.dpi}>{job.size.dpi}</option>}
                        {DPI_OPTIONS.map((dpi) => (
                          <option key={dpi} value={dpi}>
                            {dpi}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="rb-module-check">
                      <input
                        type="checkbox"
                        checked={job.invertOutput ?? false}
                        onChange={(e) =>
                          setJob((prev) => ({
                            ...prev,
                            invertOutput: e.target.checked,
                            updatedAt: nowISO(),
                          }))
                        }
                      />
                      Invert output
                    </label>

                    <label className="rb-module-field">
                      Save format
                      <select
                        className="rb-select"
                        value={saveFormat}
                        onChange={(e) => setSaveFormat(e.target.value as ImageFormat)}
                      >
                        <option value="png">PNG</option>
                        <option value="jpg">JPG</option>
                        <option value="bmp">BMP</option>
                      </select>
                    </label>

                    <button className="rb-button rb-module-save" onClick={onSaveAs} disabled={!pngBytes}>
                      Save Image...
                    </button>
                  </div>
                </BentoBox>
              </div>
            </div>

            {(showPresets || showHistory) && (
              <div
                className={`rb-side-stack ${
                  showPresets && showHistory ? "rb-side-stack-split" : ""
                }`.trim()}
                style={sideStackStyle}
              >
                {showPresets && (
                  <div className="rb-side-card rb-side-card-unstyled">
                    <BentoBox title="Presets">
                      <button className="rb-button rb-button-with-icon rb-side-action" onClick={onSavePreset}>
                        <span className="rb-inline-icon" aria-hidden="true">
                          <DockIcon name="presets" />
                        </span>
                        Save Preset
                      </button>
                      <ListPanel
                        items={presets}
                        getKey={(p) => p.id}
                        emptyMessage="No presets saved yet."
                        unstyled
                        renderItem={(p) => (
                          <div className="rb-list-row">
                            <button
                              className="rb-button rb-list-main"
                              onClick={() => onApplyPreset(p)}
                              style={{ textAlign: "left" }}
                            >
                              {buildPresetLabel(p)}
                            </button>
                            <button
                              className="rb-button rb-list-action"
                              onClick={() => onDeletePreset(p.id)}
                              aria-label="Delete preset"
                            >
                              x
                            </button>
                          </div>
                        )}
                      />
                    </BentoBox>
                  </div>
                )}

                {showHistory && (
                  <div className="rb-side-card rb-side-card-unstyled">
                    <BentoBox title="History">
                      <button
                        className="rb-button rb-button-with-icon rb-side-action"
                        onClick={async () => {
                          const next = await window.api.clearHistory();
                          setHistory(next);
                        }}
                      >
                        <span className="rb-inline-icon" aria-hidden="true">
                          <DockIcon name="history" />
                        </span>
                        Clear History
                      </button>
                      <ListPanel
                        items={history.slice(0, 10)}
                        getKey={(h) => h.id}
                        emptyMessage="No history yet."
                        unstyled
                        renderItem={(h) => (
                          <div className="rb-list-row">
                            <button
                              className="rb-button rb-list-main"
                              onClick={() => onRestoreHistory(h)}
                              style={{ textAlign: "left" }}
                            >
                              {buildHistoryLabel(h)}
                            </button>
                          </div>
                        )}
                      />
                    </BentoBox>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </AnimatedContent>

      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
    </div>
  );
}
