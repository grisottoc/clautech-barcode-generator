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
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM15 15h2v2h-2zM18 15h2v2h-2zM15 18h5v2h-5z" />
        <circle className="accent" cx="20" cy="20" r="2" />
      </svg>
    );
  }
  if (name === "code128") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h1v16H4zM6 4h2v16H6zM9 4h1v16H9zM11 4h3v16h-3zM15 4h1v16h-1zM17 4h2v16h-2zM20 4h1v16h-1z" />
        <path className="accent" d="M3 21h18" />
      </svg>
    );
  }
  if (name === "qr") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 3.5h8v8h-8zM12.5 3.5h8v8h-8zM3.5 12.5h8v8h-8zM14 14h2v2h-2zM17 14h3v2h-3zM14 17h6v3h-6z" />
        <circle className="accent" cx="8" cy="8" r="1.4" />
      </svg>
    );
  }
  if (name === "presets") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h4" />
        <path className="accent" d="M6 3.5h12v4H6z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v7l5 3M5 12a7 7 0 1014 0 7 7 0 10-14 0z" />
      <circle className="accent" cx="12" cy="12" r="1.5" />
    </svg>
  );
}

type AnimatedListProps<T> = {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  emptyMessage: string;
  renderItem: (item: T, index: number) => ReactNode;
  fadeItems?: boolean;
  keyboardNavigation?: boolean;
  showScrollbar?: boolean;
};

function AnimatedList<T>({
  items,
  getKey,
  emptyMessage,
  renderItem,
  fadeItems = true,
  keyboardNavigation = true,
  showScrollbar = true,
}: AnimatedListProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusVisible, setFocusVisible] = useState(false);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hasItems = items.length > 0;

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  function focusItem(index: number) {
    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    setActiveIndex(safeIndex);
    itemRefs.current[safeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function activateItem(index: number) {
    const node = itemRefs.current[index];
    if (!node) return;
    const actionTarget = node.querySelector("button, [role='button']") as HTMLElement | null;
    actionTarget?.click();
  }

  return (
    <div
      className={[
        "rb-bento-list",
        fadeItems ? "rb-fade-items" : "",
        showScrollbar ? "rb-show-scrollbar" : "",
        focusVisible ? "rb-list-focus-visible" : "",
      ]
        .join(" ")
        .trim()}
      tabIndex={keyboardNavigation ? 0 : -1}
      role="listbox"
      aria-activedescendant={
        keyboardNavigation && hasItems ? `rb-animated-item-${activeIndex}` : undefined
      }
      onFocus={() => setFocusVisible(true)}
      onBlur={() => setFocusVisible(false)}
      onKeyDown={(e) => {
        if (!keyboardNavigation || !hasItems) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          focusItem(activeIndex + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          focusItem(activeIndex - 1);
        } else if (e.key === "Home") {
          e.preventDefault();
          focusItem(0);
        } else if (e.key === "End") {
          e.preventDefault();
          focusItem(items.length - 1);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateItem(activeIndex);
        }
      }}
    >
      {hasItems ? (
        items.map((item, index) => (
          <div
            key={getKey(item, index)}
            id={`rb-animated-item-${index}`}
            role="option"
            aria-selected={keyboardNavigation ? activeIndex === index : undefined}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            className={`rb-animated-list-item ${
              keyboardNavigation && activeIndex === index ? "rb-item-active" : ""
            }`}
            onMouseEnter={() => {
              if (keyboardNavigation) {
                setActiveIndex(index);
              }
            }}
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
  return parts.length > 0 ? parts[parts.length - 1] : null;
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
    SYMBOLOGY_SWITCH_CARDS[0];
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

  return (
    <div className={`app-shell ${resolvedTheme === "dark" ? "rb-theme-dark" : "rb-theme-light"}`}>
      <style>{`
        .app-shell {
          --generator-height: 620px;
          --dock-accent: #ff8a3d;
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
          gap: 20px;
          margin-bottom: 20px;
          align-items: stretch;
        }

        .rb-dock {
          display: grid;
          gap: 12px;
          align-items: stretch;
          padding: 10px 16px;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          background: var(--surface);
        }

        .rb-dock-title {
          margin: 0;
          text-align: center;
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
          display: flex;
          flex-wrap: wrap;
          justify-content: space-evenly;
          align-items: stretch;
          gap: 8px;
        }

        .rb-dock-button {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid var(--card-border);
          border-radius: 10px;
          background: var(--surface-strong);
          color: var(--text-main);
          padding: 0;
          cursor: pointer;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }

        .rb-dock-button:hover {
          border-color: rgba(36, 210, 255, 0.72);
          transform: translateY(-1px);
        }

        .rb-dock-button.rb-dock-active {
          border-color: rgba(36, 210, 255, 0.92);
          box-shadow: 0 0 0 2px rgba(36, 210, 255, 0.24);
        }

        .rb-dock-icon {
          width: 24px;
          height: 24px;
          color: inherit;
          opacity: 0.9;
          transition: transform 0.18s ease, opacity 0.18s ease;
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

        .rb-dock-icon svg .accent {
          fill: var(--dock-accent);
          stroke: var(--dock-accent);
        }

        .rb-dock-button:hover .rb-dock-icon {
          opacity: 1;
          transform: scale(1.06);
        }

        .rb-dock-button.rb-dock-active .rb-dock-icon {
          animation: rb-dock-breathe 1.7s ease-in-out infinite;
        }

        @keyframes rb-dock-breathe {
          0% { transform: scale(1); }
          50% { transform: scale(1.06); }
          100% { transform: scale(1); }
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
          border-color: var(--accent);
          box-shadow: 0 0 0 2px rgba(36, 210, 255, 0.2);
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
          gap: 20px;
          align-items: stretch;
        }

        .rb-module-shell .rb-bento-card {
          min-height: var(--generator-height);
        }

        .rb-module-shell.rb-module-active .rb-bento-card {
          border-color: rgba(36, 210, 255, 0.78);
          box-shadow: 0 0 0 4px rgba(36, 210, 255, 0.32), 0 14px 30px rgba(0, 0, 0, 0.3);
        }

        .rb-side-stack {
          display: grid;
          gap: 20px;
          align-content: start;
        }

        .rb-side-stack.rb-side-stack-split {
          height: var(--generator-height);
          grid-template-rows: repeat(2, minmax(0, 1fr));
          align-content: stretch;
        }

        .rb-side-stack.rb-side-stack-split .rb-side-card {
          display: grid;
          min-height: 0;
          overflow: hidden;
        }

        .rb-side-stack.rb-side-stack-split .rb-side-card .rb-bento-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .rb-side-card .rb-bento-card {
          min-height: 230px;
          border-color: rgba(36, 210, 255, 0.78);
          box-shadow: 0 0 0 4px rgba(36, 210, 255, 0.32), 0 14px 30px rgba(0, 0, 0, 0.3);
        }

        .rb-side-card .rb-bento-list {
          max-height: 160px;
        }

        .rb-side-card .rb-bento-body {
          gap: 8px;
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
        .rb-select:focus,
        .rb-button:hover {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px rgba(36, 210, 255, 0.2);
          outline: none;
        }

        .rb-button:active {
          filter: brightness(0.98);
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

        .rb-bento-list {
          display: grid;
          gap: 6px;
          max-height: 224px;
          overflow: auto;
          padding-right: 2px;
          outline: none;
        }

        .rb-bento-list.rb-show-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(36, 210, 255, 0.52) rgba(255, 255, 255, 0.08);
        }

        .rb-bento-list.rb-show-scrollbar::-webkit-scrollbar {
          width: 10px;
        }

        .rb-bento-list.rb-show-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 999px;
        }

        .rb-bento-list.rb-show-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(36, 210, 255, 0.55);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .rb-bento-list.rb-list-focus-visible {
          box-shadow: inset 0 0 0 1px rgba(36, 210, 255, 0.4);
          border-radius: 10px;
        }

        .rb-animated-list-item {
          opacity: 1;
          transform: none;
        }

        .rb-animated-list-item:hover {
          transform: none;
        }

        .rb-animated-list-item.rb-item-active {
          box-shadow: 0 0 0 1px rgba(36, 210, 255, 0.34);
          border-radius: 10px;
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

        @media (max-width: 720px) {
          .app-shell {
            padding: 12px 16px;
          }

          .rb-toolbar {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 12px;
          }

          .rb-dock {
            padding: 10px 12px;
          }

          .rb-workspace {
            grid-template-columns: 1fr;
          }

          .rb-side-stack.rb-side-stack-split {
            height: auto;
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
            <div className="rb-dock" role="toolbar" aria-label="Module dock">
              <h1 className="rb-dock-title">
                <ShinyText
                  text="ClautechBarCodeGenerator"
                  className="rb-reactbits-title"
                />
              </h1>
              <div className="rb-dock-controls">
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
              <div className="rb-module-shell rb-module-active" aria-label={`${activeModuleCard.label} module`}>
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
              >
                {showPresets && (
                  <div className="rb-side-card">
                    <BentoBox title="Presets">
                      <button className="rb-button" onClick={onSavePreset}>
                        Save Preset
                      </button>
                      <AnimatedList
                        items={presets}
                        getKey={(p) => p.id}
                        emptyMessage="No presets saved yet."
                        fadeItems
                        keyboardNavigation
                        showScrollbar
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
                  <div className="rb-side-card">
                    <BentoBox title="History">
                      <button
                        className="rb-button"
                        onClick={async () => {
                          const next = await window.api.clearHistory();
                          setHistory(next);
                        }}
                        style={{ width: "fit-content" }}
                      >
                        Clear History
                      </button>
                      <AnimatedList
                        items={history.slice(0, 10)}
                        getKey={(h) => h.id}
                        emptyMessage="No history yet."
                        fadeItems
                        keyboardNavigation
                        showScrollbar
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
