import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Note: electron-vite will use this for the renderer build.
export default defineConfig({
  plugins: [react()],
  root: "renderer",
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: [
      // normal renderer tests
      "**/*.{test,spec}.?(c|m)[jt]s?(x)",

      // shared tests live outside the Vite root ("renderer"), so include them explicitly
      "../shared/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  },
});
