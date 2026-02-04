Here is the **entire `CONTEXT_PACK.md` file content**, **verbatim**, ready to copy-paste into a single file at the repo root.

---

```md
# CONTEXT_PACK.md
ClautechBarCodeGenerator — Authoritative Repo Context

---

## 1) Repository Identity

- **Repo:** clautech-barcode-generator
- **Owner:** grisottoc
- **Purpose:** Internal, offline desktop app to generate **high-resolution, monochrome PNG**
  QR codes, Data Matrix codes, and barcodes for professional label/design workflows.
- **Visibility:** Private
- **Primary branch:** main
- **Target release:** v0.1.0 (non-breaking feature release)

---

## 2) Locked Folder Structure (DO NOT CHANGE)

This structure is canonical and enforced.

```

/electron
main.ts
preload.ts
fileSave.ts
filename.ts

/renderer
index.html
main.tsx
App.tsx
assets/

/shared
types.ts
units.ts
constants.ts

/export
/generator
/validation
/persistence
/shortcuts

README.md
ARCHITECTURE.md
DEVELOPMENT_PLAN.md
INTEGRATION_CHECKLIST.md
CONTEXT_PACK.md

````

---

## 3) Locked Shared Contracts (DO NOT REDEFINE)

### Core unions
```ts
export type Symbology = "qr" | "datamatrix" | "code128";
export type Unit = "in" | "mm";
````

### Job (canonical)

```ts
export interface Job {
  id: string;
  symbology: Symbology;
  payload: string;

  size: {
    unit: Unit;
    width: number;
    height: number;
    dpi: number;
  };

  margin: {
    value: number; // physical, same unit as size.unit
  };

  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```

### Error contract

```ts
export type AppErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_SYMBOLOGY"
  | "GENERATION_FAILED"
  | "EXPORT_FAILED"
  | "INTERNAL_ERROR";

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
```

### Save As result (IPC)

```ts
export type SaveAsResult =
  | { ok: true; path: string }
  | { ok: false; reason: "canceled" }
  | { ok: false; reason: "error"; error: AppError };
```

**Rules**

* Cancel is not an error.
* Cancel must never throw.
* Shared contract changes are breaking by default unless explicitly approved.

---

## 4) Locked IPC APIs (Renderer → Main)

Exposed via `preload.ts` as `window.api`:

```ts
ping(): Promise<string>

saveAsPng(
  job: Job,
  pngData: Uint8Array
): Promise<SaveAsResult>

savePng(
  path: string,
  pngData: Uint8Array
): Promise<void>
```

**Renderer must never touch filesystem APIs.**

---

## 5) Locked Filename Policy (PNG Export)

### Format

```
TYPE_payloadSlug_WxHunit_dpipi_m<margin><unit>.png
```

### Examples

* `QR_httpsexample.com_1x1in_600dpi_m0.04in.png`
* `DM_PART123_25.4x25.4mm_300dpi_m1mm.png`
* `C128_ABC-001_2x1in_203dpi_m1mm.png`

### Rules

* Windows-safe (illegal characters removed)
* Reserved device names avoided (CON, NUL, COM1, etc.)
* No trailing dot or space
* Aggressive length clamping
* Behavior locked by tests

---

## 6) Pixel Math (LOCKED)

* Physical size + DPI → pixels via `/shared/units.ts`
* Rounding uses `Math.round`
* Margin is physical and converted using the same math
* No module may re-implement mm/in → px logic

---

## 7) Completed Modules (LOCKED)

* Repo Skeleton & Build ✅
* Shared Types & Units ✅
* IPC Save As & File Write Pipeline ✅

---

## 8) Active / Upcoming Modules

* PNG Monochrome Export Pipeline ⏳
* QR Generator ⏳
* Validation Layer ⏳
* Presets & History ⏳
* Templates ⏳
* Shortcuts ⏳

---

## 9) Mandatory Rules for All Module Chats

When opening a new module chat:

1. Paste this file (or reference it verbatim).
2. Paste the current commit SHA (`git rev-parse HEAD`).
3. Paste full source of any shared files the module depends on.
4. The module may ONLY modify files listed in its Deliverables.
5. Do not change:

   * Electron security flags
   * Folder structure
   * Shared contracts
     unless explicitly approved in the master chat.

---

## 10) Quality Bar (NON-NEGOTIABLE)

* Offline only
* Deterministic outputs
* PNG only
* True monochrome (RGB = 0 or 255 only)
* No image smoothing
* Cancel never throws
* Tests must remain green

---

**This file is the single source of truth for repo context.**
If it is not included in a module chat, that chat is invalid.

```

---

### Next step (do this now)
1. Create `CONTEXT_PACK.md` at repo root  
2. Paste this content  
3. Commit + push  
4. Come back and say:

> **“CONTEXT_PACK committed.”**

I will then proceed cleanly with the **PNG Monochrome Export Pipeline** without losing time or re-correcting files.
```
