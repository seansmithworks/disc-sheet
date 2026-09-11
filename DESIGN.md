---
version: alpha
name: "morph-sheet — Design System"
preset: refined-minimal
colors:
  # Package defaults (README theming table; consumers override via --morph-sheet-* vars)
  surface: "#faf7f2"
  surfaceElevated: "#f4f0e8"
  border: "#e6dfd2"
  textPrimary: "#1a1610"
  accent: "#b4512e"
  # Example pages (neutral override, example/example.css)
  exampleBackground: "#f5f5f7"
  exampleSurface: "#fafafa"
  exampleSurfaceElevated: "#ffffff"
  exampleBorder: "#e5e5e5"
  exampleTextPrimary: "#1d1d1f"
  exampleTextSecondary: "#6e6e73"
  exampleAccent: "#1d1d1f"
rounded:
  sheet: "32px"
  trigger: "9999px"
  close: "9999px"
shadows:
  silhouette: "0 1px 4px rgba(26,22,16,.14), 0 6px 24px rgba(0,0,0,.15)"
  sheetAtRest: "0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)"
motion:
  open: { stiffness: 375, damping: 42.5, mass: 1.75 }
  close: { stiffness: 375, damping: 32, mass: 1 }
  sharedOpen: { stiffness: 500, damping: 45 }
  sharedClose: { stiffness: 340, damping: 30, mass: 1 }
  snap: { stiffness: 700, damping: 52, mass: 1 }
  surfaceCloseLeadDelayMs: 35
  openContentRevealDelaySec: 0.2
  itemStaggerSec: 0.04
  contentFadeOutMs: 80
  closeRevealProgress: 0.01
---

# Design System: morph-sheet

Preset `refined-minimal`, with motion governed by §4 below instead of the preset's Motion section. Package tokens live in `README.md`'s theming table and are machine-checked by `npm run audit:vars`; this file explains the choices and holds the rules that table cannot.

## 1. Visual Theme

A bare disc that becomes a sheet. Everything else on screen is quiet so the morph is the only event. Warm paper by default (the seansmithdesign.com origin); the example pages go neutral so the motion, not the palette, is what a viewer reads.

- Near-monochrome. One accent, used only for focus rings.
- Whitespace and a hairline border carry structure; the sheet's one shadow is the only substantial shadow on the page.
- No gradients or decorative color inside the package. The demo's iridescent glow is a recording aid behind a toggle, never a default.

## 2. Color

| Role | Package default | Example pages |
| --- | --- | --- |
| Surface (trigger) | `#faf7f2` | `#fafafa` |
| Surface, elevated (sheet) | `#f4f0e8` | `#ffffff` |
| Border | `#e6dfd2` | `#e5e5e5` |
| Text | `#1a1610` | `#1d1d1f` |
| Accent (focus ring only) | `#b4512e` | `#1d1d1f` |
| Page background | consumer's | `#f5f5f7` |

Consumers override with `--morph-sheet-*` custom properties. Never add a hex to `src/styles.module.css` that is not a `var()` fallback.

## 3. Shape and Depth

- **Trigger:** a circle, always. `--morph-sheet-trigger-radius: 9999px`. It rests as a circle after every close path (gated by geometry test (o)).
- **Sheet:** `--morph-sheet-sheet-radius: 32px`. During the morph the radius is a pure function of `collapseProgress`, never its own spring.
- **Two shadow looks, one painter.** `<MorphSheet.Shadow>` paints both the thin disc shadow and the sheet's heavier resting shadow on its own silhouette, crossfaded by opacity as `collapseProgress` moves (2026-09-11). Nothing else paints a shadow.
- **Close button:** 44px hit area, transparent, circular focus ring.

## 4. Motion Principles

The morph is the product, so it gets the budget a modal normally does not. Everything else obeys Emil Kowalski's standards (`~/.claude/skills/review-animations/STANDARDS.md`).

1. **One surface, one clock.** Surface box, silhouette shadow, corner radius and close mask all derive from `collapseProgress`. Nothing has its own spring. A frame where the shadow and the surface disagree is a bug, not a tuning question. The shadow is painted by `<MorphSheet.Shadow>` and nowhere else: a second copy on any surface makes the shadow change intensity the frame that surface mounts or unmounts. *(Fixed 2026-09-11: `.triggerSurface` carried a duplicate, so the resting disc painted two shadows and the open's first frame halved them. Also fixed 2026-09-11: the sheet's own resting shadow, painted separately via `data-morph-sheet-settled`, was a second painter/second clock — `<MorphSheet.Shadow>` now paints that look too, crossfaded on `collapseProgress`.)*
2. **Nothing appears from nothing.** The sheet must never paint at a size the disc did not grow into. A stall that skips the first 30% of the morph is a defect even if every frame after it is perfect. *(Known, bounded: the first open after page load stalls ~50ms on Sean's GPU — one dropped frame of morph; every later open runs with no frame over 20ms. Measured 2026-09-11. Open only if a cold first open ever needs to be the recorded one.)*
3. **Transform and opacity only while the clock runs.** No filter, blur, box-shadow, width or height animates during a morph. The silhouette shadow resizes per frame today; moving it to a transform is the durable fix.
4. **Springs, dialled, never typed.** Open 375/42.5/1.75 · close 375/32/1 · shared.open 500/45 · shared.close 340/30/1 · lead delay 35 · snap 700/52/1. A change to any of these goes through the tuner (`/tune`) with a measured before/after, never a hand edit.
5. **Reveal after settle.** Content and the close control reveal once the surface is within 1% of rest. Items stagger at 40ms, inside the 30–80ms band. The close control's scale-from-0 spin is a deliberate exception to "start at 0.9+", chosen 2026-09-10 for the glyph's symmetry; if it ever reads as popping, that is the first thing to revisit.
6. **Exit faster than enter.** Content fades out in 80ms; the close control reverses in 200ms; the close spring is stiffer than the open.
7. **Reduced motion is a crossfade, not nothing.** No `layoutId`, no transforms, opacity only, 200ms. The close control stays visible and reachable.
8. **Judge with the instrument, not memory.** Every motion change ships with before/after frame measurement; acceptance is the pixel. Smoothness is a number (distinct rendered frames per open+close, warm browser). Recording aids (the glow toggle) are off when judging.

## 5. Agent Prompt Guide

- Read this file and `src/motion.ts` before any change to the morph.
- Run `npm run test:geometry` (expect 36 vitest / 76 Playwright) and never loosen a threshold to fit a feel change.
- Reviewer is never the builder; green tests written by the builder are not evidence.
- Two `test:geometry` runs race over the shared dev server. Never run it concurrently with anything.

## Reference Ceiling

- **Apple Dynamic Island** — `design/reference/apple-dynamic-island.png` — one shape becoming another, shadow and content on one clock.
- **Family wallet drawer** — `design/reference/family-wallet.png` — continuity and settle feel for sheets.
- **Vaul drawer (Emil Kowalski)** — `design/reference/vaul-drawer-open.png` — web-native open/close smoothness and gesture dismiss.
- **seansmithdesign.com ContactSheet** — `design/reference/seansmithdesign-contactsheet-closed.png` — the source this package was extracted from; the feel it must not lose.

Screenshots are first-pass captures of each site's landing state; replace with a mid-morph frame of each when one is available.
