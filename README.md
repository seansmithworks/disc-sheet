# @seansmith/disc-sheet

> **Name is provisional.** `@seansmith/disc-sheet`, the `DiscSheet` namespace,
> and the `--disc-sheet-*` CSS prefix are all placeholders, chosen so a later
> rename is a three-pattern find-and-replace. See
> `docs/PACKAGE-DESIGN.md` in the parent repo for the full design.

Draggable disc that lives at one of six viewport anchors and morphs into a
modal sheet. A generic React primitive with a compound-component API —
you supply all content, the package owns the morph.

## Install

Source-only, no build step — same install model as `@seansmith/device-frame`.
Installed from GitHub, consumed via your bundler's native TS support
(Vite) or Next's `transpilePackages`.

```bash
npm install github:seansmith/disc-sheet
```

Peer dependencies: `react` (>=19), `react-dom` (>=19), `motion` (>=12,
`motion/react`). None are bundled — install them yourself if your app doesn't
already have them.

## Usage

```tsx
import { DiscSheet } from "@seansmith/disc-sheet";

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

## The escape hatch

`useDiscSheet().collapseProgress` is the raw `MotionValue<number>` the
package's own radius, mask, and opacity transforms read — `0` at fully open
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

## DOM contract: `data-disc-sheet-part`

Every element the package renders carries `data-disc-sheet-part`, and this is
public, stable surface — not an accident of implementation you happen to be
able to reach. Use it for CSS overrides or, as `example/CloseMask.tsx` does,
to find the live element from outside the package via `usePKG()` + a
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
`"sheet"`, so consumer CSS (or the package's own `.shared[data-disc-sheet-slot=…]`
rules) can target either instance without relying on className precedence.

## Theming

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
| `--disc-sheet-edge-margin` | `16px` |
| `--disc-sheet-shadow` | `0 1px 4px rgba(26,22,16,.14), 0 6px 24px rgba(0,0,0,.15)` |
| `--disc-sheet-sheet-shadow` | `0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)` |
| `--disc-sheet-z` | `100` |

The package writes `--disc-sheet-disc-size`, `--disc-sheet-disc-x/-y`,
`--disc-sheet-sheet-left/-top`, `--disc-sheet-collapse`, and
`--disc-sheet-shadow-x/-y/-w/-h/-radius` — read these, don't set them.

## Motion

Three springs are props (`transition.open` / `.close` / `.shared`), each
accepting the `{ stiffness, damping, mass? }` shorthand or a full Motion
`Transition`. Everything else — hold fractions, delay gates, stagger
intervals, swipe thresholds, drag feel — is internal. These are fixes for
specific artifacts, not knobs; see `docs/PACKAGE-DESIGN.md` §3 and §7C for
why.

## Accessibility

- Real `<button type="button">` trigger, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`.
- `role="dialog"` `aria-modal="true"` sheet; the `Labelled` union makes a
  missing accessible name a type error.
- Focus lands on the panel on open (not the first control); Escape closes
  unconditionally; focus restores to the trigger on exit-complete, not at
  state-change.
- Body scroll lock while open; Tab/Shift+Tab cycle within the panel.
- `<DiscSheet.Close>` is required in practice — Root logs a dev-only warning
  if the sheet opens with none registered.

**Known gap (v0.2 item, not hidden):** no `inert` on background content.
`aria-modal="true"` covers modern assistive tech; screen readers that ignore
it can still navigate out of the dialog.

## What v0.1 cuts

Entrance choreography, `<DiscSheet.Backdrop>` as its own component (dismissal
still works via `Sheet`'s `dismissOnBackdrop`, which renders an invisible
click-catcher — no visual dim layer by default), controlled anchor, the
anchors-subset prop, and arrow-key repositioning between anchors. See
`docs/PACKAGE-DESIGN.md` §8 for the reasoning behind each cut.
