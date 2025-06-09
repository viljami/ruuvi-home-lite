import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2020",
    minify: "esbuild",
  },
  server: {
    port: 3000,
    host: true,
    open: false,
  },
  preview: {
    port: 4000,
    host: true,
  },
  resolve: {
    alias: {
      "@ruuvi-home/shared": resolve(__dirname, "../shared/src/index.ts"),
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "import.meta.vitest": "undefined",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["node_modules", "dist"],
  },
  esbuild: {
    target: "es2020",
  },
  optimizeDeps: {
    include: [],
  },
});
