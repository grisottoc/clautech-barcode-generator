# Changelog

## [Unreleased]
### Added
- Code128 UI and validation aligned to required physical range:
  - Width: 20-50 mm
  - Height: 3-10 mm
- Preset naming prefix behavior:
  - `DM-` for Data Matrix
  - `BC-` for Code128
  - `QR-` for QR
- Print Scan Test area for comparing scanner output with current payload
- Dock redesign with icon-only controls and hover titles
- Expanded and completed top-level repository documentation

### Changed
- Code128 defaults:
  - 30 mm width
  - 4 mm height
  - 1200 DPI
  - BMP save default in UI flow
- Data Matrix default size set to 9 mm x 9 mm
- QR and Code128 default payload placeholders updated
- Preset list labels now mirror payload naming strategy
- Window defaults updated to 1440 x 1080 and system-theme mode
- DevTools auto-open on startup disabled
- Renderer scrolling behavior tuned to show scrollbars only on overflow

### Fixed
- Code128 export path now uses zero margin normalization in UI flow to prevent side safe-space padding
- Preview container sizing transitions reduced across symbology switches

## [0.3.0] - 2026-02-10
### Added
- Data Matrix generator + validation (bwip-js), strict monochrome PNG output
- Data Matrix UI tab with live preview + Save As
- Rectangular label support via center-padded square symbol raster

## [0.2.0] - 2026-02-07
### Added
- Local persistence store (offline JSON) for Presets and History
- IPC APIs to list/save/delete presets and list/append/clear history
- Basic UI wiring for Presets + History

## [0.1.1] - 2026-02-06
### Fixed
- Build: correct renderer preview Blob typing for PNG bytes
- Build: unify window.api typing via renderer/global.d.ts (Save As available)

## [0.1.0] - 2026-02-04
### Added
- IPC Save As + atomic PNG write pipeline (cancel-safe)
- Deterministic PNG filename suggestion
- Monochrome PNG export pipeline (strict 0/255, alpha=255, margin composition)
- QR generator + live preview + Save As wiring

## [0.0.1] - 2026-02-03
### Added
- Electron + React + Vite + TypeScript offline scaffold
- Shared contracts and units conversion helpers
- Vitest coverage for shared/units conversions + pixel math
