# Development Plan

## Scope

Deliver a production-grade offline barcode generator desktop app with:
- Reliable generation quality
- Deterministic exports
- Stable persistence
- Clean build/release pipeline

## Current State (as of 2026-02-27)

Done:
- Multi-symbology generation (Data Matrix, Code128, QR)
- Validation flow per symbology
- Presets/history persistence
- PNG/JPG/BMP Save As pipeline
- System-theme aligned UI
- Dock redesign + scan test text area

Open:
- TypeScript build errors block `npm run build`
- Documentation was previously incomplete (now filled)

## Priority Backlog

## P0 - Build Reliability

Goal: make `npm run build` pass.

Tasks:
1. Add or fix `bwip-js` TypeScript declarations (generator + validation imports).
2. Resolve strict-null errors in:
   - `renderer/App.tsx`
   - `generator/code128.ts`
3. Resolve ArrayBuffer typing mismatches in Data Matrix paths.
4. Remove stale `@ts-expect-error` comments that are now unused.
5. Re-run `npm run build` and keep green.

Exit criteria:
- Build succeeds locally with no TS errors.

## P1 - Quality and UX Hardening

Tasks:
1. Add more integration-style tests for:
   - Save format conversion edge cases
   - Preset/history round-trip behavior
2. Add explicit docs for export quality expectations (scanner acceptance matrix).
3. Validate UI behavior at common display scales (100/125/150 percent).

Exit criteria:
- No major regressions in generation, save, or UI sizing transitions.

## P2 - Release Readiness

Tasks:
1. Add packaging/signing guidance and CI build workflow.
2. Introduce release checklist for versioning/changelog/tagging.
3. Add automated lint/type checks in CI.

Exit criteria:
- Repeatable build artifact generation and documented release process.

## Suggested Execution Order

1. Close P0 (`build` gate).
2. Run full test pass and manual integration checklist.
3. Implement P1 quality additions.
4. Establish P2 release automation.
