# Clautech Barcode Generator

Offline Electron desktop app for generating and exporting:
- Data Matrix (ECC200)
- Code 128
- QR Code

Outputs are deterministic, monochrome-first rasters with support for `PNG`, `JPG`, and `BMP` export.

## Current Status

The app is actively developed and usable for local generation/export workflows.

Implemented:
- Symbology switcher with live preview
- Data Matrix, Code128, QR generation and validation
- Presets and history persistence
- Multi-format save (`png`, `jpg`, `bmp`) with Save As dialog
- Scan test text area to compare scanner output vs current payload
- System-theme driven UI (no manual theme switch)

## Requirements

- Node.js 20+ recommended
- npm 10+ recommended
- Windows/macOS/Linux supported by Electron runtime (team currently develops on Windows)

## Quick Start

```bash
npm install
npm run dev
```

Test suite:

```bash
npm run test:run
```

## Scripts

- `npm run dev`  
  Runs `scripts/dev-clean.ps1` then starts Electron-Vite.
- `npm run dev:raw`  
  Direct `electron-vite dev` (no env cleanup).
- `npm run test:run`  
  Runs Vitest once.
- `npm run build`  
  Type-check + production build.

## App Behavior and Defaults

## Data Matrix
- Default payload: `p/n: ; s/n: ; cage: 1mpt3`
- Size range: `8.0 mm` to `20.0 mm` (step `0.5 mm`)
- Default size: `9.0 mm x 9.0 mm`
- Default DPI: `1200`

## Code 128
- Default payload: `Hello!! Type HERE to generate a BarCode`
- Width range: `20 mm` to `50 mm` (step `1 mm`)
- Height range: `3 mm` to `10 mm` (step `0.5 mm`)
- Default size: `30 mm x 4 mm`
- Default DPI: `1200`
- Margin is forced to zero for exact barcode-only export area

## QR
- Default payload: `Hello!! Type HERE to generate a QR Code`
- Size is square-constrained in UI flow
- Default base size: `1 in x 1 in` at `300 DPI` for new QR job state

## Shared UI
- DPI options: `300`, `600`, `1200`
- Save format options: `PNG`, `JPG`, `BMP`
- Dock controls include icon tooltips on hover

## Presets and History

- Preset labels use payload prefix by symbology:
  - `DM- ` for Data Matrix
  - `BC- ` for Code128
  - `QR- ` for QR
- History stores newest-first snapshots, capped at 50 entries
- Persistence file is `store.json` under Electron `userData` directory

## Export Notes

- Generation is strict monochrome in core pipeline (0 or 255 RGB values, alpha 255)
- PNG is native output format in renderer pipeline
- JPG and BMP are converted in main process from PNG bytes
- BMP embeds DPI via pixels-per-meter fields

## Security Model

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- Renderer filesystem access is blocked; all file writes go through IPC

## Project Structure

```text
electron/      Main process, preload bridge, save pipeline
renderer/      React UI
generator/     Symbology raster generators
validation/    Input and density checks per symbology
export/        Monochrome export composition
persistence/   Local JSON store for presets/history
shared/        Shared types + deterministic unit math
```

## Known Issues

- `npm run build` currently fails due existing TypeScript issues (validation/generator typing and a few strict-null checks).
- `npm run test:run` passes and is the current stability gate while those build issues are being fixed.

## Internal Notes

This repository is private/internal. If you want release-grade packaging docs (installer, code signing, CI), add them in a follow-up docs pass after build issues are closed.
