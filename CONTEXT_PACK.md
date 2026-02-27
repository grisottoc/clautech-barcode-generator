# Context Pack

Repository snapshot for implementation and review alignment.

## Identity

- Repo: `clautech-barcode-generator`
- Owner: `grisottoc`
- Branch: `main`
- App type: Offline desktop generator (Electron + React + TypeScript)
- Purpose: Generate and export Data Matrix, Code128, and QR labels/codes

## Core Capabilities

- Live preview generation for:
  - Data Matrix
  - Code128
  - QR
- Validation before generation
- Save As export in:
  - PNG
  - JPG
  - BMP
- Presets and history persisted locally
- System-theme UI behavior

## Canonical Shared Contracts

Located in `shared/types.ts`:
- `Symbology = "qr" | "datamatrix" | "code128"`
- `Unit = "in" | "mm"`
- `ImageFormat = "png" | "jpg" | "bmp"`
- `Job`, `Preset`, `HistoryItem`, `SaveAsResult`, `AppError`

## Runtime Layers

- `electron/main.ts`
  - Window lifecycle
  - Save/export conversion
  - Persistence IPC handlers
- `electron/preload.ts`
  - Safe typed bridge (`window.api`)
- `renderer/App.tsx`
  - UI state orchestration and user workflows
- `generator/*`
  - Symbology-specific raster generation
- `validation/*`
  - Input and density checks
- `export/png.ts`
  - Monochrome export composition
- `persistence/*`
  - Local JSON storage

## Determinism Rules

- Pixel math uses shared unit conversion helpers from `shared/units.ts`
- Monochrome pipeline enforces strict black/white output values
- Save cancel is represented as typed non-error result

## Persistence Notes

- Local store file: `store.json` in Electron userData directory
- Atomic writes (temp file then rename)
- Corrupt store fallback handled by rename + recreate
- History capped at 50 entries

## Current Quality Gates

- Tests: `npm run test:run` (passing)
- Build: `npm run build` currently failing due known TypeScript issues

## Current Known Build Blockers

- Missing/strict typing around `bwip-js` usage
- ArrayBuffer typing mismatches in Data Matrix modules
- Strict null checks in selected renderer/generator code paths

See `DEVELOPMENT_PLAN.md` for tracked remediation order.
