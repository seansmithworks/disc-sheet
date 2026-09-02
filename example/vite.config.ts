import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "./example",
  resolve: {
    alias: {
      // tuner/page.tsx imports the package by its published specifier (so a
      // consumer who copies the file out via `npx morph-sheet add tuner`
      // needs zero edits). This alias is what lets that same, unmodified
      // file also run here against live local source.
      "@seansmithworks/morph-sheet": resolve(__dirname, "../src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        flagship: resolve(__dirname, "flagship.html"),
        tune: resolve(__dirname, "tune.html"),
      },
    },
  },
});
