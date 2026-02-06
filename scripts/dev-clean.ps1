# Dev-only helper to ensure Electron is not forced into Node mode
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run dev:raw
