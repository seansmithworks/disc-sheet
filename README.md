# disc→sheet

A draggable disc that morphs into a modal sheet.

## What it is

A persistent circular control that sits at one of six viewport anchors (the
corners plus top-center and bottom-center), can be dragged and re-anchored,
and morphs into a modal sheet via a `layoutId` FLIP transition. It is a
generic React primitive with a compound-component API: you supply all
content, the package owns the morph.

There is no canonical design-system name for this pattern. Material has
SpeedDial, a FAB that expands into a radial menu of actions. Apple and Radix
both have sheets, but theirs enter from a screen edge rather than growing out
of a persistent trigger. Nobody has standardized "trigger morphs into
surface," so `disc-sheet` / `DiscSheet` names the shape directly rather than
reaching for an existing term.

## Install

```bash
npm install @seansmithworks/disc-sheet
```

`dist/` ships compiled ESM + `.d.ts` declarations, so the default import
needs no build-step config on the consumer's side — no `transpilePackages`,
no extra `tsc` target. CSS is bundled and auto-imported by the package's own
entry point; you don't need a separate stylesheet `<link>` or `import` for
the component to render styled. A manual stylesheet path,
`@seansmithworks/disc-sheet/styles.css`, also exists if you need to import
the CSS on its own (e.g. to inline it above the fold, or reference it from a
non-JS build step) — most consumers never need it.

### Installing from source

For a git-dependency install (e.g. testing an unreleased branch), the
package still ships raw TypeScript source in `src/`, but a source install
needs a build step on your side. Point Next.js at it via
`transpilePackages` in `next.config.ts`:

```ts
const nextConfig = {
  transpilePackages: ["@seansmithworks/disc-sheet"],
};
```

```bash
npm install @seansmithworks/disc-sheet@github:seansmithworks/disc-sheet
```

This mirrors how `@seansmithworks/device-frame` is consumed. Vite consumers
work with no config, but because a source install's `src/` isn't
precompiled, your own `tsc -b` typechecks it directly as part of `npm run
build` — so an unusually strict or `types`-restricted consumer
`tsconfig.json` typechecks our source too, not just yours. None of this
applies to the default npm install above, which ships compiled output.

### npx copy-in

If you'd rather own the files outright — no package dependency, no
`node_modules` indirection — copy the component source directly into your
project:

```bash
npx @seansmithworks/disc-sheet add
```

This drops all of `src/`'s components, hooks, and `styles.module.css` into
`./src/disc-sheet` (pass a different path as the first argument to change
the target). It skips the test file and, if your project already has a
`next-env.d.ts`, skips the `*.module.css` ambient type shim too (Next
already declares it — a duplicate `declare module` block is a TS error). It
refuses to overwrite existing files unless you pass `--force`.

The tradeoff: you own the copy from that point on. There's no update
channel — to pick up changes, re-run with `--force` (which overwrites
everything) or diff your copy against a fresh `add` in a scratch directory.
Peer dependencies aren't copied and still need installing:

```bash
npm install react react-dom motion
```

## Peer dependencies

- `react` >=19
- `react-dom` >=19
- `motion` >=12

None are bundled. Install them yourself if your app doesn't already have
them.

## Usage

```tsx
import { DiscSheet } from "@seansmithworks/disc-sheet";

function ContactDisc() {
  return (
    <DiscSheet.Root>
      <DiscSheet.Shadow />

      <DiscSheet.Disc aria-label="Open contact">
        <DiscSheet.Shared>
          <Avatar />
        </DiscSheet.Shared>
      </DiscSheet.Disc>

      <DiscSheet.Sheet aria-labelledby="sheet-title">
        <DiscSheet.Shared>
          <Avatar />
        </DiscSheet.Shared>

        <DiscSheet.Content>
          <DiscSheet.Close aria-label="Close" />
          <DiscSheet.Item>
            <h2 id="sheet-title">Sean Smith</h2>
          </DiscSheet.Item>
          <DiscSheet.Item>{/* links, etc. */}</DiscSheet.Item>
        </DiscSheet.Content>
      </DiscSheet.Sheet>
    </DiscSheet.Root>
  );
}
```

Nine exports total: eight components (`Root`, `Disc`, `Sheet`, `Shared`,
`Content`, `Item`, `Close`, `Shadow`) plus the `useDiscSheet()` hook. That is
the whole surface area.

In a Next.js App Router app, add `"use client"` at the top of the file where
you mount `DiscSheet` (as above). Server components can't resolve a property
access like `DiscSheet.Root` on a client-reference namespace — this is the
same constraint as Radix, MUI, and `motion/react` itself.

### The escape hatch

`useDiscSheet().collapseProgress` is the raw `MotionValue<number>` the
package's own radius, mask, and opacity transforms read: `0` at fully open
(sheet), `1` at fully closed (disc). Combined with `discRect` and
`sheetRect`, it is enough to rebuild any choreography the package doesn't
expose as a prop. See `example/CloseMask.tsx` for a worked example: it
rebuilds a trailing-paper close mask from *outside* the package using only
this hatch.

```tsx
function usePKG() {
  return useDiscSheet();
  // { open, setOpen, anchor, isDragging, discSize, collapseProgress, discRect, sheetRect }
}
```

## Theming

Two public styling surfaces: CSS custom properties and a DOM data-attribute
contract.

### `--disc-sheet-*` custom properties

Every visual token is a CSS custom property with a hardcoded fallback, so the
package renders correctly out of the box:

| Variable | Default |
| --- | --- |
| `--disc-sheet-surface` | `#faf7f2` |
| `--disc-sheet-surface-elevated` | `#f4f0e8` |
| `--disc-sheet-surface-border` | `#e6dfd2` |
| `--disc-sheet-text` | `#1a1610` |
| `--disc-sheet-accent` | `#b4512e` |
| `--disc-sheet-sheet-max-width` | `480px` |
| `--disc-sheet-shared-size` | matches `--disc-sheet-disc-size` |
| `--disc-sheet-sheet-radius` | `32px` |
| `--disc-sheet-disc-radius` | `9999px` |
| `--disc-sheet-sheet-padding` | `24px` |
| `--disc-sheet-shadow` | `0 1px 4px rgba(26,22,16,.14), 0 6px 24px rgba(0,0,0,.15)` |
| `--disc-sheet-sheet-shadow` | `0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)` |
| `--disc-sheet-z` | `100` |

The package writes `--disc-sheet-disc-size`, `--disc-sheet-disc-x/-y`,
`--disc-sheet-sheet-left/-top`, `--disc-sheet-collapse`, and
`--disc-sheet-shadow-x/-y/-w/-h/-radius`; read these, don't set them.

`npm run audit:vars` checks this table against `src/styles.module.css` and
`src/`: any `--disc-sheet-*` variable the CSS reads must be either written by
the package or documented here, or the audit fails.

### `data-disc-sheet-part` DOM contract

Every element the package renders carries `data-disc-sheet-part`, and this is
public, stable surface, not an accident of implementation you happen to be
able to reach. Use it for CSS overrides or, as `example/CloseMask.tsx` does,
to find the live element from outside the package via `useDiscSheet()` + a
`document.querySelector`.

| Value | Element |
| --- | --- |
| `disc-root` | The disc's fixed drag wrapper |
| `disc-trigger` | The disc's trigger `<button>` |
| `disc-surface` | The disc's circular seed surface (the FLIP source) |
| `shared` | `<DiscSheet.Shared>`, on both its disc- and sheet-side instances |
| `sheet` | `<DiscSheet.Sheet>`'s panel |
| `backdrop` | The invisible outside-click catcher (only when `dismissOnBackdrop`) |
| `content` | `<DiscSheet.Content>`'s scroll region |
| `item` | `<DiscSheet.Item>` |
| `close` | `<DiscSheet.Close>`'s button |
| `shadow` | `<DiscSheet.Shadow>`'s default div (also merged onto an `asChild` child) |

`<DiscSheet.Shared>` additionally carries `data-disc-sheet-slot="disc"` or
`"sheet"`, so consumer CSS (or the package's own
`.shared[data-disc-sheet-slot=…]` rules) can target either instance without
relying on className precedence.

## Motion

Three springs are props (`transition.open` / `.close` / `.shared`), each
accepting the `{ stiffness, damping, mass? }` shorthand or a full Motion
`Transition`. Everything else, hold fractions, delay gates, stagger
intervals, swipe thresholds, drag feel, is internal. These are fixes for
specific artifacts, not knobs; see `docs/PACKAGE-DESIGN.md` §3 and §7C in the
source repo for why.

## Accessibility

- Real `<button type="button">` trigger, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`.
- `role="dialog"` `aria-modal="true"` sheet; the `Labelled` union makes a
  missing accessible name a type error.
- Focus lands on the panel on open (not the first control); Escape closes
  unconditionally; focus restores to the trigger on exit-complete, not at
  state-change.
- Body scroll lock while open; Tab/Shift+Tab cycle within the panel.
- `<DiscSheet.Close>` is required in practice; Root logs a dev-only warning
  if the sheet opens with none registered.

**Known gap:** no `inert` on background content. `aria-modal="true"` covers
modern assistive tech; screen readers that ignore it can still navigate out
of the dialog.

## Known issues / status

- **Nothing consumes this package yet, including Sean's own site.** It is a
  clean-room extraction that has been gate-tested (see Development below) but
  not battle-tested in production.
- **Resize-mid-close transient.** Resizing the viewport while the sheet is
  closing produces a roughly 300-370px position-only desync between the
  shadow and the surface (`|Δheight|` stays around 2.5px). It is bounded and
  gated in the test suite at 450px. Two mechanisms are responsible:
  `sheetRect` is React state one render tick behind the surface's synchronous
  native reflow, and closing that gap fully would reintroduce a previously
  fixed teardown bug.
- **The dither shadow is deliberately not included.** `<Shadow asChild>` is
  the layering point; the visual treatment is the consumer's.

## What v0.1 cuts

Entrance choreography, `<DiscSheet.Backdrop>` as its own component (dismissal
still works via `Sheet`'s `dismissOnBackdrop`, which renders an invisible
click-catcher, no visual dim layer by default), controlled anchor, the
anchors-subset prop, and arrow-key repositioning between anchors. See
`docs/PACKAGE-DESIGN.md` §8 in the source repo for the reasoning behind each
cut.

## Development

```bash
npm install
npm run test           # vitest, unit tests for anchors.ts
npm run test:geometry  # Playwright, the geometry/motion gate
npm run audit:vars     # cross-check CSS vars against writers and docs
```

The geometry gate is `npm run test:geometry`, which points Playwright at
`example/playwright.config.ts`. A bare `npx playwright test` loads the
default config instead, silently runs zero tests, and still exits 0. Always
use the npm script, and check the reported test count, not just the exit
code.

## License

MIT. See `LICENSE` for the full text.
