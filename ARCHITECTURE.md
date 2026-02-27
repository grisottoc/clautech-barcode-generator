# Architecture

## Overview

The app uses Electron + React with a strict main/preload/renderer split:

- Main process (`electron/main.ts`): window lifecycle, persistence IPC, Save As and file writing.
- Preload (`electron/preload.ts`): typed and limited `window.api` bridge.
- Renderer (`renderer/App.tsx`): UI state, validation calls, raster generation, preview updates.
- Shared core (`shared/`): canonical contracts and deterministic unit math.

## Runtime Layers

## Main Process

Responsibilities:
- Create BrowserWindow (system theme defaults, secure webPreferences)
- Handle IPC routes:
  - `saveAsImage`, `saveAsPng`, `savePng`
  - `persistence:getPresets`, `savePreset`, `deletePreset`
  - `persistence:getHistory`, `addHistory`, `clearHistory`
- Convert output format:
  - PNG passthrough
  - PNG -> JPG using Electron `nativeImage`
  - PNG -> BMP using explicit 24-bit encoder with DPI metadata

## Preload Bridge

`electron/preload.ts` exposes only safe, typed APIs to renderer:
- No direct filesystem access in renderer
- All persistence and save operations are IPC-mediated

## Renderer

Main orchestration in `renderer/App.tsx`:
- Maintains `Job` state and UI control state
- Validates before generation (`validation/*`)
- Generates raster (`generator/*`)
- Converts raster to preview/export PNG bytes (`export/png.ts`)
- Manages presets/history user actions via `window.api`

## Core Data Contracts

Canonical types are in `shared/types.ts`:
- `Job`, `Preset`, `HistoryItem`
- `Symbology`, `Unit`, `ImageFormat`
- `SaveAsResult`, `AppError`

Unit conversions and pixel math are in `shared/units.ts`:
- `toPixels`, `computePixelSize`, `mmToIn`, `inToMm`
- Uses deterministic `Math.round`

## Generation Pipeline

For each preview/save:
1. UI updates `Job`.
2. Symbology validator runs.
3. Generator returns RGBA raster.
4. `renderMarginAndExport()` enforces monochrome + optional invert.
5. PNG bytes are used for preview and save flow.

Symbology implementations:
- `generator/qr.ts` uses `qrcode`
- `generator/datamatrix.ts` uses `bwip-js`
- `generator/code128.ts` uses `jsbarcode`

## Persistence Layer

Local storage:
- `persistence/store.ts`
- File: `store.json` in Electron userData path
- Atomic writes via temp-file rename
- Corrupt file recovery by rename + clean recreation
- History capped to 50 entries

## Export/Data Flow

Renderer never writes files directly.

Flow:
1. Renderer requests save via `window.api.saveAsImage(...)`.
2. Main opens native Save dialog.
3. Main encodes/writes file atomically.
4. Result returned as typed `SaveAsResult`.

## Security Posture

BrowserWindow options:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

No privileged Node APIs are exposed directly in renderer.

## Testing Strategy

Current suite is Vitest-based:
- Shared units and filename behavior
- Validation modules
- Generators
- Export module
- Persistence store

Primary current quality gate:
- `npm run test:run` (green)

Current known gap:
- `npm run build` fails due outstanding TypeScript strictness/type-definition issues tracked in `DEVELOPMENT_PLAN.md`.
