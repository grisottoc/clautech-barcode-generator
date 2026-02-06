import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".",
  test: {
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
});
