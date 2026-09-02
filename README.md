# trigger→sheet

A draggable trigger that morphs into a modal sheet.

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
surface," so `morph-sheet` / `MorphSheet` names the shape directly rather than
reaching for an existing term.

## Install

```bash
npm install @seansmithworks/morph-sheet
```

`dist/` ships compiled ESM + `.d.ts` declarations, so the default import
needs no build-step config on the consumer's side — no `transpilePackages`,
no extra `tsc` target. CSS is bundled and auto-imported by the package's own
entry point; you don't need a separate stylesheet `<link>` or `import` for
the component to render styled. A manual stylesheet path,
`@seansmithworks/morph-sheet/styles.css`, also exists if you need to import
the CSS on its own (e.g. to inline it above the fold, or reference it from a
non-JS build step) — most consumers never need it.

### Installing from source

For a git-dependency install (e.g. testing an unreleased branch), the
package still ships raw TypeScript source in `src/`, but a source install
needs a build step on your side. Point Next.js at it via
`transpilePackages` in `next.config.ts`:

```ts
const nextConfig = {
  transpilePackages: ["@seansmithworks/morph-sheet"],
};
```

```bash
npm install @seansmithworks/morph-sheet@github:seansmithworks/morph-sheet
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
npx @seansmithworks/morph-sheet add
```

This drops all of `src/`'s components, hooks, and `styles.module.css` into
`./src/morph-sheet` (pass a different path as the first argument to change
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

### Live-tuning panel

```bash
npx @seansmithworks/morph-sheet add tuner
```

Copies a small dialkit-driven page (`./tuner` by default) for dialling the
close choreography by eye instead of by hand-typed spring numbers — the same
panel Sean's own "Version 4" defaults were dialled on. It needs
[`dialkit`](https://www.npmjs.com/package/dialkit) as a **devDependency**,
which the copy-in tells you to install:

```bash
npm install -D dialkit
```

`dialkit` is never a dependency of this package itself and shouldn't become
one of your consuming app either: its stylesheet pulls Geist Mono from
Google Fonts, an external request you don't want on every page load, and a
tuning panel is a development tool that has no business being reachable
from a production bundle. Mount `tuner/page.tsx` behind a route your prod
build never ships (or a dev-only guard), dial the close, then use the
panel's **Copy as MotionPreset** button — it emits a `MotionPreset`-shaped
object you paste straight into `preset={...}` on `<MorphSheet.Root>`, no
hand-translation. This repo runs the same file live at
`npm run dev` → `/tune.html`.

## Peer dependencies

- `react` >=19
- `react-dom` >=19
- `motion` >=12

None are bundled. Install them yourself if your app doesn't already have
them.

## Usage

```tsx
"use client";

import { MorphSheet } from "@seansmithworks/morph-sheet";

function ContactTrigger() {
  return (
    <MorphSheet.Root>
      <MorphSheet.Shadow />

      <MorphSheet.Trigger aria-label="Open contact">
        <MorphSheet.Shared>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "100%",
              background: "#b4512e",
            }}
          />
        </MorphSheet.Shared>
      </MorphSheet.Trigger>

      <MorphSheet.Sheet aria-labelledby="sheet-title">
        <MorphSheet.Shared>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "100%",
              background: "#b4512e",
            }}
          />
        </MorphSheet.Shared>

        <MorphSheet.Content>
          <MorphSheet.Close aria-label="Close" />
          <MorphSheet.Item>
            <h2 id="sheet-title">Sean Smith</h2>
          </MorphSheet.Item>
          <MorphSheet.Item>
            <p>Links, etc.</p>
          </MorphSheet.Item>
        </MorphSheet.Content>
      </MorphSheet.Sheet>
    </MorphSheet.Root>
  );
}
```

Pasted as-is, this renders a solid-colored trigger at the bottom-center
viewport anchor: drag it to re-anchor at any of the six anchors, tap it to
morph it into the sheet shown above.

Nine exports total: eight components (`Root`, `Trigger`, `Sheet`, `Shared`,
`Content`, `Item`, `Close`, `Shadow`) plus the `useMorphSheet()` hook. That is
the whole surface area.

In a Next.js App Router app, `"use client"` has to be the first line of the
file where you mount `MorphSheet`, as it is in the snippet above. Server
components can't resolve a property access like `MorphSheet.Root` on a
client-reference namespace — this is the same constraint as Radix, MUI, and
`motion/react` itself.

### The escape hatch

`useMorphSheet().collapseProgress` is the raw `MotionValue<number>` the
package's own radius, mask, and opacity transforms read: `0` at fully open
(sheet), `1` at fully closed (trigger). Combined with `triggerRect` and
`sheetRect`, it is enough to rebuild any choreography the package doesn't
expose as a prop. See `example/CloseMask.tsx` for a worked example: it
rebuilds a trailing-paper close mask from *outside* the package using only
this hatch.

```tsx
function usePKG() {
  return useMorphSheet();
  // { open, setOpen, anchor, isDragging, triggerSize, collapseProgress, triggerRect, sheetRect }
}
```

## Theming

Two public styling surfaces: CSS custom properties and a DOM data-attribute
contract.

### `--morph-sheet-*` custom properties

Every visual token is a CSS custom property with a hardcoded fallback, so the
package renders correctly out of the box:

| Variable | Default |
| --- | --- |
| `--morph-sheet-surface` | `#faf7f2` |
| `--morph-sheet-surface-elevated` | `#f4f0e8` |
| `--morph-sheet-surface-border` | `#e6dfd2` |
| `--morph-sheet-text` | `#1a1610` |
| `--morph-sheet-accent` | `#b4512e` |
| `--morph-sheet-sheet-max-width` | `480px` |
| `--morph-sheet-shared-size` | matches `--morph-sheet-trigger-size` |
| `--morph-sheet-sheet-radius` | `32px` |
| `--morph-sheet-trigger-radius` | `9999px` |
| `--morph-sheet-sheet-padding` | `24px` |
| `--morph-sheet-shadow` | `0 1px 4px rgba(26,22,16,.14), 0 6px 24px rgba(0,0,0,.15)` |
| `--morph-sheet-sheet-shadow` | `0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)` |
| `--morph-sheet-z` | `100` |

The package writes `--morph-sheet-trigger-size`, `--morph-sheet-trigger-x/-y`,
`--morph-sheet-sheet-left/-top`, `--morph-sheet-collapse`, and
`--morph-sheet-shadow-x/-y/-w/-h/-radius`; read these, don't set them.

`npm run audit:vars` checks this table against `src/styles.module.css` and
`src/`: any `--morph-sheet-*` variable the CSS reads must be either written by
the package or documented here, or the audit fails.

### `data-morph-sheet-part` DOM contract

Every element the package renders carries `data-morph-sheet-part`, and this is
public, stable surface, not an accident of implementation you happen to be
able to reach. Use it for CSS overrides or, as `example/CloseMask.tsx` does,
to find the live element from outside the package via `useMorphSheet()` + a
`document.querySelector`.

| Value | Element |
| --- | --- |
| `trigger-root` | The trigger's fixed drag wrapper |
| `trigger` | The trigger `<button>` |
| `trigger-surface` | The trigger's circular seed surface (the FLIP source) |
| `shared` | `<MorphSheet.Shared>`, on both its trigger- and sheet-side instances |
| `sheet` | `<MorphSheet.Sheet>`'s panel |
| `backdrop` | The invisible outside-click catcher (only when `dismissOnBackdrop`) |
| `content` | `<MorphSheet.Content>`'s scroll region |
| `item` | `<MorphSheet.Item>` |
| `close` | `<MorphSheet.Close>`'s button |
| `shadow` | `<MorphSheet.Shadow>`'s default div (also merged onto an `asChild` child) |

`<MorphSheet.Shared>` additionally carries `data-morph-sheet-slot="trigger"` or
`"sheet"`, so consumer CSS (or the package's own
`.shared[data-morph-sheet-slot=…]` rules) can target either instance without
relying on className precedence.

`trigger-root` additionally carries `data-morph-sheet-closing` (empty string),
present only while a close is in flight (removed once the sheet has fully
closed).

## Motion

Three springs are props (`transition.open` / `.close` / `.shared`), each
accepting either `{ stiffness, damping, mass? }` or `{ visualDuration, bounce }`
(see below for both spring shorthands), or a full Motion `Transition`, plus
one number: `surfaceCloseLeadDelayMs`. Everything else,
hold fractions, stagger intervals, swipe thresholds, drag feel, is internal.
These are fixes for specific artifacts, not knobs; see
`docs/PACKAGE-DESIGN.md` §3 and §7C in the source repo for why.

`transition.shared` is additionally **direction-aware**. The shared element
has a different job in each direction — on the open it only has to clear the
growing sheet, on the close it has to arrive home together with the
collapsing trigger, whose own FLIP starts deliberately later than its own. A
single value still applies to both directions; `{ open, close }` sets them
independently:

```tsx
<MorphSheet.Root
  transition={{
    close: { stiffness: 375, damping: 32, mass: 1 },
    shared: {
      open: { stiffness: 500, damping: 45 },
      close: { stiffness: 340, damping: 30, mass: 1 },
    },
  }}
>
```

| Key | Default |
| --- | --- |
| `open` | `{ stiffness: 375, damping: 42.5, mass: 1.75 }` |
| `close` | `{ stiffness: 375, damping: 32, mass: 1 }` |
| `shared.open` | `{ stiffness: 500, damping: 45 }` |
| `shared.close` | `{ stiffness: 340, damping: 30, mass: 1 }` |

### `surfaceCloseLeadDelayMs`

```tsx
<MorphSheet.Root surfaceCloseLeadDelayMs={35}>
```

Milliseconds the surface box waits before starting its close FLIP, so the
shared element visibly leads the shrink instead of scaling in lockstep — the
close reads as a re-home rather than a scale. Default `35`. Ignored under
reduced motion. It is the single biggest lever on how long a close feels: at
`100` the box sits frozen for 143ms after the click and the shared element is
53% of the way home before the sheet moves; at `0` there is no detachment to
read at all.

The three close values are coupled, but not by formula. `shared.close` was
originally derived from `close` by frequency-scaling (stiffness by `k²`,
damping by `k`, with `k = Ts / (Ts + D)`); Sean's later hand-dial pass moved
`shared.close` past that derived value, so it no longer holds. Change `close`
or `surfaceCloseLeadDelayMs` and re-dial `shared.close` to match on the
`/tune` panel — do not recompute it — or the shared element stops arriving
with the box: too fast and it parks early, too slow and it trails, and a
trailing shared element spills past the round trigger's 2px border.

### Presets

```tsx
import { MorphSheet, presets } from "@seansmithworks/morph-sheet";

<MorphSheet.Root preset={presets.snappy}>
```

`presets` carries three named feels, each a `{ transition?, surfaceCloseLeadDelayMs? }`
object — the same two fields above, bundled so a stranger can change how the
component feels without typing spring numbers. `default` is exactly what
ships when you pass no preset at all, so `preset={presets.default}` changes
nothing. `snappy` and `gentle` are un-dialled strawmen (frequency-scaled off
`default`, not judged by eye) — expect Sean to re-dial their actual values on
the `/tune` panel; that's a one-line change per preset, not an API change.

An explicit `transition` or `surfaceCloseLeadDelayMs` prop on `Root` always
wins over the same field on `preset`, field by field — **except `shared`**,
which is replaced whole rather than merged (it can be a Spring, a
Transition, or a directional `{ open, close }` object, and those three
shapes don't shallow-merge sensibly). If your explicit `shared` only sets
one direction, the other direction falls back to the preset's `shared` for
that direction, not the package default:

```tsx
<MorphSheet.Root preset={presets.snappy} transition={{ open: mySpring }}>
```

keeps `snappy`'s `close` and `shared`, taking only `mySpring` for `open`.

```tsx
<MorphSheet.Root
  preset={presets.snappy}
  transition={{ shared: { open: mySharedOpenSpring } }}
>
```

keeps `snappy`'s `shared.close`, taking only `mySharedOpenSpring` for
`shared.open`.

### `{ visualDuration, bounce }`

Every spring prop also accepts Motion's designer-legible shorthand — two
numbers instead of `stiffness`/`damping`. Use exactly these two keys,
**`visualDuration` and `bounce`, both required**:

```tsx
<MorphSheet.Root transition={{ open: { visualDuration: 0.4, bounce: 0.2 } }}>
```

Do not use Motion's other duration shorthand, `{ duration, bounce }` — this
package's shorthand detection treats anything with a `duration` key as a
plain tween and silently drops `bounce`. And do not add `mass` to this
shorthand: Motion resolves `stiffness`/`damping`/`mass` before it ever looks
at `visualDuration`/`bounce`, so a `mass` key here discards both and the
spring falls back to Motion's own defaults — this package's `DurationSpring`
type has no `mass` field specifically to prevent that.

## Accessibility

- Real `<button type="button">` trigger, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`.
- `role="dialog"` `aria-modal="true"` sheet; the `Labelled` union makes a
  missing accessible name a type error.
- Focus lands on the panel on open (not the first control); Escape closes
  unconditionally; focus restores to the trigger on exit-complete, not at
  state-change.
- Body scroll lock while open; Tab/Shift+Tab cycle within the panel.
- `<MorphSheet.Close>` is required in practice; Root logs a dev-only warning
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

Entrance choreography, `<MorphSheet.Backdrop>` as its own component (dismissal
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
