import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { libInjectCss } from "vite-plugin-lib-inject-css";
import dts from "vite-plugin-dts";

// Library build: compiles src/ to a distributable ESM bundle with a single
// entry point (src/index.ts). Peer deps (react, react-dom, motion) are left
// external — the consumer supplies them, we don't bundle them.
//
// libInjectCss makes the emitted JS entry `import` its own extracted CSS.
// Plain Vite lib mode extracts CSS to a file but never wires an import for
// it, which would silently ship an unstyled component.
//
// The process.env.NODE_ENV define is a passthrough, not a substitution: it
// rewrites the literal `process.env.NODE_ENV` in src/Sheet.tsx to itself, so
// esbuild's minifier/definePlugin leaves it untouched in dist/index.js for
// the CONSUMER's bundler to substitute at their own build time. Without
// this, Vite inlines the value at OUR build time (always "production" here)
// and the dev-only warning in Sheet.tsx is dead code in every consumer,
// regardless of their own NODE_ENV. See commit 973cc2f.
export default defineConfig({
  plugins: [
    react(),
    libInjectCss(),
    dts({
      rollupTypes: false,
      entryRoot: "src",
      tsconfigPath: "./tsconfig.build.json",
    }),
  ],
  define: {
    "process.env.NODE_ENV": "process.env.NODE_ENV",
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "motion",
        "motion/react",
      ],
      // Rollup drops module-level directives when bundling (every src/
      // entry point declares "use client" — Rollup 4 discards them with a
      // "Module level directives cause errors when bundled" warning). The
      // bundle is a single entry whose every export is a client component,
      // so a file-level banner is the correct replacement: it re-adds the
      // RSC client boundary the built dist/index.js otherwise ships without,
      // which breaks the default Next.js App Router import (review #2).
      output: {
        banner: '"use client";',
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
