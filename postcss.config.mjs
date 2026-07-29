// Empty, package-local PostCSS config. Without this, Vite/vitest walks up the
// filesystem tree from disc-sheet/ and finds the parent worktree's
// postcss.config.mjs (Tailwind), whose plugin isn't installed here — this
// package has no PostCSS/Tailwind dependency of its own.
export default {
  plugins: {},
};
