# Changelog

## [Unreleased]
- (placeholder)

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
