import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "dist/",
        "**/*.d.ts",
        "vite.config.ts",
        "vitest.config.ts",
      ],
    },
    deps: {
      inline: ["@ruuvi-home/shared"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@ruuvi-home/shared": resolve(__dirname, "../shared/src"),
    },
  },
  define: {
    global: "globalThis",
  },
});
