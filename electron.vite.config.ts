import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/electron",
      emptyOutDir: false,
      rollupOptions: {
        // ✅ REQUIRED: tells electron-vite what the main entry is
        input: resolve(__dirname, "electron/main.ts"),
        output: {
          entryFileNames: "main.js"
        }
      }
    }
  },

    preload: {
        build: {
        outDir: "dist/electron",
        emptyOutDir: false,
        rollupOptions: {
            input: resolve(__dirname, "electron/preload.ts"),
            output: {
            // ✅ force stable name
            entryFileNames: "preload.js",
            format: "cjs"
            }
        }
        }
    },

  

    renderer: {
    root: "renderer",
    plugins: [react()],
    build: {
      outDir: "dist/renderer",
      emptyOutDir: true,
      rollupOptions: {
        // ✅ REQUIRED: tells electron-vite where renderer HTML entry is
        input: resolve(__dirname, "renderer/index.html")
      }
    }
  }

});
