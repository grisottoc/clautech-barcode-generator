# Integration Checklist

Use this checklist before pushing release or milestone commits.

## Environment

1. `npm install` completes successfully.
2. `npm run test:run` passes.
3. `npm run dev` launches app window.

## Launch and Window Behavior

1. App opens with default size (1440 x 1080).
2. No forced scrollbar when content fits.
3. Scrollbar appears only when window is resized smaller than content.
4. Theme follows OS/system theme automatically.

## Dock and Navigation

1. Dock title appears inside dock container.
2. Dock controls are icon-only and same size.
3. Icon hover tooltips are visible.
4. Active icon state is visually distinct.
5. Switching symbologies updates module controls without layout breakage.

## Generator Modules

## Data Matrix

1. Default payload and default 9mm size load correctly.
2. Size selector enforces 8mm-20mm range.
3. Preview updates immediately after payload/size/DPI changes.
4. Saved output contains only symbol area expected by current generator/export behavior.

## Code128

1. Default payload loads correctly.
2. Width selector enforces 20mm-50mm.
3. Height selector enforces 3mm-10mm.
4. Preview updates without dense-bar false positives for normal payload lengths.
5. Output has no extra quiet-zone margins from export path (margin forced to zero in UI logic).

## QR

1. Default payload loads correctly.
2. Preview renders centered and without distortion.
3. Density validation triggers clear error for too-dense combinations.

## Save Flow

1. Save format switcher supports PNG/JPG/BMP.
2. Save As cancel returns cleanly (no crash/no error modal).
3. Saved filename defaults are payload-based and valid.
4. BMP exports include proper DPI metadata.

## Persistence

1. Save Preset creates entry with symbology prefix (`DM-`, `BC-`, `QR-`).
2. Applying preset restores relevant job fields.
3. Delete preset removes only selected preset.
4. History records save/generation snapshots newest first.
5. Clear History empties history list.

## Scan Test Area

1. Print Scan Test textarea accepts scanner input.
2. Status shows:
   - Waiting (empty)
   - Match (same as payload)
   - Mismatch (different from payload)

## Stability

1. Repeated symbology switching does not resize/jump major containers unexpectedly.
2. No renderer crashes while rapidly editing payload and saving.
3. Persistence survives app restart.

## Known Blocking Item

- `npm run build` currently fails due TypeScript issues already identified in `DEVELOPMENT_PLAN.md`.
