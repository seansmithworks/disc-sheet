# `disc-sheet` package design

Draggable disc that morphs into a sheet. Generic React primitive, compound-component API.

Shipped as `@seansmithworks/disc-sheet`. `DiscSheet` is the exported namespace object throughout, and `--disc-sheet-*` is the CSS custom property namespace.

Source of the extraction: `src/components/chrome/FloatingIdentity.tsx`, `ContactSheet.tsx`, `anchorPositions.ts` and their CSS modules on `seansmithdesign.com`. Everything cited below was verified against those files, not inferred.

---

## 0. Framing

Three things ship, in this order of priority:

1. **The primitive.** A disc that lives at one of six viewport anchors, can be dragged and snapped between them, and morphs into a modal sheet. Consumer supplies all content.
2. **The flagship example.** Sean's identity/contact surface, rebuilt on top of the primitive. It is an example app in the repo, not a second entry point in the package.
3. **The shadow seam.** A slot where a `@seansmith/surface-fx` dither layer drops in. The package never imports surface-fx.

Precedent check. Two of Sean's own packages already set conventions:

- `@seansmith/surface-fx` (`~/Code/surface-fx`): source-only, no build step, installed from GitHub, consumed via Next `transpilePackages`, `react`/`motion` as peers. Ships **no JSX and no CSS**. Subpath export map is `"./*": "./src/*.ts"`.
- `@seansmith/device-frame` (`~/Code/device-frame`): source-only, same install model, **ships JSX and CSS Modules**, root-only export (`{".": "./src/index.ts"}`), a `src/css-modules.d.ts` shim, all CSS custom properties namespaced `--device-*` with hardcoded fallbacks, and a Vite `demo/` folder.

`device-frame` is the closer precedent and this package should follow it. Section 5 flags every place surface-fx's conventions do not carry over.

---

## 1. Public API

### The tree

```tsx
import { DiscSheet } from "@seansmithworks/disc-sheet";

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
      <DiscSheet.Item>…</DiscSheet.Item>
    </DiscSheet.Content>
  </DiscSheet.Sheet>
</DiscSheet.Root>
```

Nine exports total: eight components plus one hook. That is the whole surface area.

### `<DiscSheet.Root>`

Owns open state, anchor state, the `LayoutGroup`, the shared context, and the reduced-motion decision.

```ts
type AnchorId =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

type Spring = { stiffness: number; damping: number; mass?: number };

interface MorphTransition {
  /** Disc to sheet. Default: { stiffness: 375, damping: 42.5, mass: 1.75 } */
  open?: Spring | Transition;
  /** Sheet to disc. Default: { stiffness: 240, damping: 34, mass: 1.75 } */
  close?: Spring | Transition;
  /** The <DiscSheet.Shared> element's own morph. Default: { stiffness: 500, damping: 45 } */
  shared?: Spring | Transition;
}

interface RootProps {
  children: React.ReactNode;

  // ── Open state ────────────────────────────────────────────────
  /** Uncontrolled initial state. Default false. */
  defaultOpen?: boolean;
  /** Controlled. When provided, the package never sets open itself. */
  open?: boolean;
  /** Fires on every requested state change, controlled or not. */
  onOpenChange?: (open: boolean) => void;

  // ── Position ──────────────────────────────────────────────────
  /** Uncontrolled initial anchor. Default "bottom-center". */
  defaultAnchor?: AnchorId;
  /** Fires after a drag settles on a new anchor. */
  onAnchorChange?: (anchor: AnchorId) => void;
  /** Default true. False renders a fixed disc with no drag affordance. */
  draggable?: boolean;
  /**
   * localStorage key for the chosen anchor.
   * Default "disc-sheet-anchor". Pass false to disable persistence entirely.
   */
  persistKey?: string | false;

  // ── Geometry ──────────────────────────────────────────────────
  /**
   * Disc diameter in px. Object form is a breakpoint ramp.
   * Default { base: 96, md: 128, xl: 144 } at 0 / 768 / 1600.
   */
  discSize?: number | { base: number; md?: number; xl?: number };
  /** Sheet max width in px. Default 480. */
  sheetMaxWidth?: number;

  // ── Motion ────────────────────────────────────────────────────
  transition?: MorphTransition;
  /** Force reduced-motion behavior. Default: the media query. */
  reduceMotion?: boolean;

  // ── Plumbing ──────────────────────────────────────────────────
  /** Base for generated aria ids and layoutIds. Default useId(). */
  id?: string;
  /** Base z-index. Default 100. See §2 for the derived stack. */
  zIndex?: number;
  className?: string;
}
```

**Uncontrolled path.** `<DiscSheet.Root>` with no `open`. The disc tap toggles internal state, `onOpenChange` fires for telemetry. The anchor is read from `localStorage` at mount, validated against the six legal values, and written back on every settled drag. This is the default and it is what the flagship example uses.

**Controlled path.** Pass `open` and `onOpenChange`. The package calls `onOpenChange(next)` and does nothing else; the surface only changes when `open` changes. All internal triggers route through the same call: disc tap, Escape, backdrop click, swipe-down past threshold, `<DiscSheet.Close>`. There is no second escape valve, so a consumer holding `open={false}` gets a sheet that genuinely cannot open.

Anchor is deliberately **uncontrolled only** in v0.1. See §8.

### `<DiscSheet.Disc>`

The fixed drag wrapper plus the trigger button plus the morph seed surface.

```ts
interface DiscProps {
  children?: React.ReactNode;
  className?: string;
  /** Required. This is the button's accessible name. */
  "aria-label": string;
}
```

Renders three nested nodes the consumer does not control:

1. `motion.div[data-disc-sheet-part="disc-root"]`, `position: fixed` at the viewport origin, positioned entirely by Motion `x`/`y` MotionValues holding the disc's top-left in viewport px. This single-origin model is load-bearing: nothing ever changes CSS `left`/`top` after mount, so a snap is a plain `x`/`y` animation with no FLIP and no one-frame transform desync.
2. `button[data-disc-sheet-part="disc-trigger"]`, transparent, fills the wrapper, carries `aria-haspopup="dialog"` / `aria-expanded` / `aria-controls`.
3. `motion.div[data-disc-sheet-part="disc-surface"]`, the `layoutId` seed. Circular, painted from `--disc-sheet-surface` and `--disc-sheet-surface-border`. This is the element that FLIPs into the sheet, which is why it is package-owned rather than a slot.

`children` render above the seed surface, inside the button.

### `<DiscSheet.Sheet>`

The modal surface. Same `layoutId` as the disc seed, so Motion FLIPs the box between the two.

```ts
type Labelled =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

type SheetProps = Labelled & {
  children: React.ReactNode;
  className?: string;
  /** Drag the sheet down past threshold to close. Default true. */
  dismissOnSwipe?: boolean;
  /** Click outside the sheet to close. Default true. */
  dismissOnBackdrop?: boolean;
};
```

The `Labelled` union makes it a type error to render a dialog with no accessible name. That is worth the small ugliness in the type.

Escape is **not** configurable. A modal surface that traps focus and cannot be dismissed by keyboard is a defect, not a variant.

### `<DiscSheet.Shared>`

The shared-element slot. Rendered **twice**: once inside `<DiscSheet.Disc>`, once inside `<DiscSheet.Sheet>`, with the same children. It carries its own `layoutId` and its own spring, independent of the surface morph.

```ts
interface SharedProps {
  children: React.ReactNode;
  className?: string;
}
```

Critical structural rule inherited from the source, and the package enforces it by construction: `<DiscSheet.Shared>` renders as a **sibling** of the disc seed surface, never a child. Nesting it would make its projection inherit the surface's close-morph FLIP, freezing it at the surface's transient mid-collapse box and then teleporting it home. The comment at `FloatingIdentity.tsx:1935-1944` documents that exact bug.

Optional: omit it entirely. The morph still works; there is just no element that persists visually across it.

### `<DiscSheet.Content>` and `<DiscSheet.Item>`

`Content` holds sheet content at opacity 0 through the bloom and reveals it after, then fades it out first on close. `Item` is a staggered child.

```ts
interface ContentProps { children: React.ReactNode; className?: string }
interface ItemProps    { children: React.ReactNode; className?: string }
```

No props beyond that. The reveal delay, stagger interval, and exit duration are internal (§3).

`Content` also owns the scroll region: it applies `overflow-y: auto` to itself and reports `scrollTop` to the swipe-to-close handler, which must not fire while the content is scrolled. That coupling exists today at `ContactSheet.tsx:929-930` and it is easy to lose in an extraction.

### `<DiscSheet.Close>`

```ts
interface CloseProps {
  children?: React.ReactNode;  // default: a hairline X glyph
  className?: string;
  "aria-label": string;        // required
}
```

Registers itself in context on mount. If the sheet opens and no `Close` is registered, Root logs a dev-only warning. Escape and backdrop click are not a substitute for a visible close control.

### `<DiscSheet.Backdrop>`

Opt-in **visual** scrim only. Dismiss-on-outside-click is Root behavior and works whether or not `Backdrop` is rendered.

```ts
interface BackdropProps {
  className?: string;
  /** backdrop-filter blur in px. Default 0. */
  blurPx?: number;
}
```

This split matters. The site currently ships `backdropDimEnabled: false` (verified in `surface-fx/src/schema/bloomDefaults.ts`), so the default look is a clear page behind the bloom. Making the scrim a component rather than a boolean means the default costs nothing and the dim variant costs one line.

### `<DiscSheet.Shadow>`

See §4.

### `useDiscSheet()`

```ts
interface DiscSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchor: AnchorId;
  isDragging: boolean;
  discSize: number;
  /** 0 = fully open (sheet), 1 = fully closed (disc). Live MotionValue. */
  collapseProgress: MotionValue<number>;
  /** Live viewport rects, null before first measure. */
  discRect: { cx: number; cy: number; radius: number } | null;
  sheetRect: { cx: number; cy: number; halfWidth: number; halfHeight: number } | null;
}

function useDiscSheet(): DiscSheetState;
```

Throws outside `<DiscSheet.Root>`. This hook is the escape hatch for §3 and the data source for §4.

### Props deliberately NOT exposed

| Not exposed | Why |
| --- | --- |
| `dragElastic`, `dragMomentum`, `dragConstraints`, drag threshold (5px) | Drag feel is one dialed system. Exposing pieces of it lets a consumer produce an off-screen excursion or a tap that registers as a drag. |
| Snap spring (`stiffness 700, damping 52, mass 1`) | Deliberately overdamped so the disc never overshoots past a viewport edge. A softer value is a bug, not a preference. |
| `radiusHoldFraction`, `radiusCloseDelaySec`, `surfaceCloseLeadDelayMs`, `openContentRevealDelaySec`, `contentFadeOutMs`, `contentFadeOutDelayMs` | The close choreography. Every one of these exists to suppress a specific artifact. See §3. |
| The trailing-paper mask envelope constants (`FADE_START/PEAK/END`, `MAX_FADE`, `BAND`) | Internal to one artifact fix. See §8, where this is a cut. |
| The 2x3 anchor region map thresholds | Changing them makes "nearest anchor" not mean nearest. |
| Swipe-to-close thresholds (96px offset, 400px/s velocity) | Platform convention values. |
| Individual layer z-indices | One `zIndex` base, derived offsets. §2. |
| The focus-trap selector string | Widening it is how you trap focus on a hidden element. |
| `anchorEdge` / `anchorTopPx` sheet placement | Derived from the anchor and the viewport, never passed. The consumer choosing these independently is how the sheet ends up off-screen. |
| A `tuning` object mirroring `BloomTuning` | The shortest path and the wrong one. See §7C. |

---

## 2. Theming API

### Delivery: CSS Modules, one file, no consumer import step

**Decision: CSS Modules, exactly as `@seansmith/device-frame` does it.**

Rejected alternatives:

- **A single `styles.css` the consumer imports.** Global class names in a package are a collision waiting to happen, and "you must also import the stylesheet" is a step people forget and then file a bug about.
- **Inline styles.** Kills media queries, `:focus-visible`, `:hover`, `@media (prefers-reduced-motion)`, and `[data-palette]`-style consumer overrides. This component needs all of them.
- **Tailwind, with a `@source` config step (div-phone's model).** Requires the consumer to have Tailwind at all, and requires a config edit. Sean's site has Tailwind v4 and it would still be friction. Hard no.

CSS Modules give hashed class names (no collisions), zero consumer setup, and native support in both Next and Vite for a `transpilePackages`-consumed source package. The cost is real but narrow: a consumer on a bundler with no CSS-module support cannot use the package. Both target bundlers support it.

Required companion file: `src/css-modules.d.ts`, copied verbatim from device-frame.

### Namespace and mapping

Every variable is `--disc-sheet-*` and every one has a hardcoded fallback in the CSS, so the package renders correctly with a consumer who sets nothing. The mapping below is what the flagship example writes to re-skin the primitive back into Sean's site.

| Package variable | Default (fallback baked in the CSS) | Current site variable |
| --- | --- | --- |
| `--disc-sheet-surface` | `#faf7f2` | `--color-paper` |
| `--disc-sheet-surface-elevated` | `#f4f0e8` | `--color-paper-soft` (midnight sheet fill) |
| `--disc-sheet-surface-border` | `#e6dfd2` | `--color-paper-edge` |
| `--disc-sheet-text` | `#1a1610` | `--color-ink` |
| `--disc-sheet-accent` | `#b4512e` | `--color-accent` (focus ring only) |
| `--disc-sheet-sheet-max-width` | `480px` | `--contact-sheet-max-width` |
| `--disc-sheet-shared-size` | matches `--disc-sheet-disc-size` | `--contact-portrait-size` |
| `--disc-sheet-sheet-radius` | `32px` | `tuning.sheetRadius` |
| `--disc-sheet-disc-radius` | `9999px` | `tuning.discRadius` |
| `--disc-sheet-edge-margin` | `16px` | `EDGE_MARGIN` in `anchorPositions.ts` |
| `--disc-sheet-shadow` | `0 1px 4px rgba(26,22,16,.14), 0 6px 24px rgba(0,0,0,.15)` | `.discSurface` box-shadow |
| `--disc-sheet-sheet-shadow` | `0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)` | `.sheet` box-shadow |
| `--disc-sheet-z` | `100` | the z-index literals |

Derived z-stack, from `--disc-sheet-z` (call it `z`):

| Layer | z |
| --- | --- |
| Shadow | `z - 1` |
| Disc | `z` |
| Backdrop | `z + 101` |
| Sheet | `z + 102` |

Those offsets reproduce the shipped stack exactly (99 / 100 / 201 / 202) at the default `z = 100`.

**Written by the package, readable by the consumer.** These are set as inline custom properties, not read:

| Variable | On | Meaning |
| --- | --- | --- |
| `--disc-sheet-disc-size` | disc root | resolved diameter in px |
| `--disc-sheet-disc-x`, `--disc-sheet-disc-y` | disc root | live top-left in viewport px |
| `--disc-sheet-sheet-left`, `--disc-sheet-sheet-top` | sheet | resolved placement in px |
| `--disc-sheet-collapse` | shadow layer | `0..1`, the live morph progress |
| `--disc-sheet-shadow-x/-y/-w/-h/-radius` | shadow layer | the interpolated silhouette |

### One fix taken during extraction

The site duplicates the disc breakpoints in two places: the `@media` blocks in `FloatingIdentity.module.css:94-106` and the `resolveDiscSize()` function at `FloatingIdentity.tsx:311-317`, with a comment on each telling you to keep them in sync. That is a latent bug, and the sync failure mode (disc shifts off its anchor) is exactly the kind of thing that gets debugged twice.

In the package, `resolveDiscSize()` remains the single source of the size ramp, but it is not JS writing the var at runtime. `Root` renders a scoped `<style>` block with real `@media` rules — one per breakpoint in the ramp — that set `--disc-sheet-disc-size` in CSS, server-rendered and deterministic from props alone. Neither `Root`'s wrapper nor `Disc`'s drag wrapper writes `--disc-sheet-disc-size` inline; an inline write on either would always beat the `@media` rules, at every viewport, and defeat the point of resolving the size in CSS. The live JS value from the size hook feeds only position math (`anchors.ts`) and drag-constraint numbers — never a FLIP-tracked element's painted box.

This split exists because Motion snapshots a shared-`layoutId` element's box at first paint. A JS-resolved size is not available correctly at first paint without either a hydration mismatch (server and client disagreeing before the effect that would set it runs) or a stale post-mount promotion (the size hook returning a base value on first render for hydration safety, then correcting itself after Motion has already snapshotted the shared-element origin). Resolving the size in CSS via `@media`, instead of in JS via an effect, means the browser has the correct value at first paint with no client-side correction step for Motion to snapshot ahead of.

---

## 3. Motion API

The morph is hand-dialed. The design rule is: **springs are props, shape tokens are CSS variables, choreography is internal, and one MotionValue is the escape hatch.**

### Public: three springs

`transition.open`, `transition.close`, `transition.shared`. Defaults, all verified against `surface-fx/src/schema/bloomDefaults.ts:332-368` and the `OPEN_SPRING_SPEEDUP` derivation at `ContactSheet.tsx:776-782`:

| Key | Default | Provenance |
| --- | --- | --- |
| `open` | `{ stiffness: 375, damping: 42.5, mass: 1.75 }` | `surfaceCloseSpring` scaled by k=1.25 (stiffness by k², damping by k), which preserves the damping ratio and shortens settle ~20% |
| `close` | `{ stiffness: 240, damping: 34, mass: 1.75 }` | dialed by Sean 2026-06-19 |
| `shared` | `{ stiffness: 500, damping: 45 }` | stiff and near-critically damped so the shared element clears the shrinking sheet without overshoot |

Each accepts a full Motion `Transition` as well as the `Spring` shorthand, so "I need a tween, not a spring" is never a reason to fork. When the package needs to compose its own `delay` onto the close transition, it applies it **only if the consumer did not specify one**.

### CSS variables: shape tokens

`--disc-sheet-sheet-radius` (32px) and `--disc-sheet-disc-radius` (9999px). These are read once when the sheet opens, via a small `readVarPx` helper modelled on the existing `useCssVarPx.ts`, and fed to the border-radius transform.

Rationale: radius is a design token. A designer will want it sitting next to the rest of the surface styling in CSS, not buried in a JS prop object. Every other visual token in this package is a CSS variable, and radius should not be the exception just because JS happens to interpolate it.

### Internal: everything else

Not props, not variables, not documented as tunable:

| Constant | Value | What it prevents |
| --- | --- | --- |
| `radiusHoldFraction` | 0.74 | The disc shape appearing before the box has contracted (an over-rounded rectangle) |
| `radiusCloseDelaySec` | 1.5 | The oval reading too early in a long close |
| `surfaceCloseLeadDelayMs` | 100 | The shared element and the surface shrinking in lockstep, which reads as a scale rather than a re-home |
| `openContentRevealDelaySec` | 0.2 | Text visibly stretching during the bloom |
| `contentFadeOutMs` / `DelayMs` | 80 / 0 | Content still painted while the box collapses under it |
| stagger interval | 0.04 | |
| Snap spring | 700 / 52 / 1 | Overshoot past a viewport edge |
| Swipe thresholds | 96px, 400px/s | |
| Tab threshold | 5px | Tap misread as drag |

Each of these is a fix for a specific artifact. Exposing them turns "we solved this" into "you can un-solve this, and it is our compatibility promise now."

### The escape hatch

**`useDiscSheet().collapseProgress`**: the raw `MotionValue<number>`, 0 at fully open, 1 at fully closed. It is the same value the package's own radius, mask, and opacity transforms read.

Anything the package will not animate for you, you animate off that value, and it is frame-locked to the morph by construction rather than by a parallel timer. Combined with `discRect` and `sheetRect`, that is enough to rebuild any of the internal choreography externally. Section 8 uses exactly this to validate the hatch: the trailing-paper close mask is cut from the package and rebuilt in the example app. If it cannot be rebuilt from outside, the hatch is inadequate and we find out in week one instead of after v1.

---

## 4. The shadow seam

**Shape: a slot component with Radix-style `asChild`, fed by context.**

### Default, zero dependencies

```tsx
<DiscSheet.Root>
  <DiscSheet.Shadow />
  …
</DiscSheet.Root>
```

Renders one `div`: `position: fixed`, `aria-hidden="true"`, `pointer-events: none`, at `z - 1`, sized and positioned to the interpolated silhouette between the disc circle and the sheet box. It paints a plain `box-shadow` from `--disc-sheet-shadow`. It carries, updated every frame without a React re-render:

```
data-disc-sheet-part="shadow"
data-state="closed" | "open" | "dragging"
style:
  --disc-sheet-collapse: 0..1
  --disc-sheet-shadow-x / -y      viewport px, silhouette center
  --disc-sheet-shadow-w / -h      half-extents in px
  --disc-sheet-shadow-radius      px
```

A consumer with only CSS can already do a lot with that: swap the shadow, tie its opacity to `--disc-sheet-collapse`, change the falloff.

### Swapped for a surface-fx dither layer

```tsx
import { DiscSheet, useDiscSheet } from "@seansmithworks/disc-sheet";
import { useRippleEngine, velocityToRipple } from "@seansmith/surface-fx";

function DitherShadow() {
  const { collapseProgress, discRect, sheetRect, isDragging } = useDiscSheet();
  // build the mask / shader uniforms off collapseProgress + the two rects
  return <canvas … />;
}

<DiscSheet.Shadow asChild>
  <DitherShadow />
</DiscSheet.Shadow>
```

`asChild` clones the single child and merges onto it: the fixed positioning, the z-index, `aria-hidden`, `pointer-events: none`, the `data-*` attributes, and all the `--disc-sheet-shadow-*` custom properties. The child gets a correctly placed, correctly stacked, non-interactive layer for free and only has to paint.

The richer signal (the raw MotionValue and the two rects) comes through `useDiscSheet()`, not through the slot. Keeping data flow in the hook and layout in the slot means the slot has one job and the hook has one job.

**The package never imports surface-fx.** `@seansmith/surface-fx` appears only in the example app's dependencies. The default `<DiscSheet.Shadow />` has no dependency beyond React.

### Why this shape

- **Render prop** (`<DiscSheet.Shadow>{(state) => …}</DiscSheet.Shadow>`): equal power, but every consumer re-declares the fixed positioning and the z-index, and gets one of them wrong. The slot owns the container so the consumer owns only the paint.
- **Data-attributes only, styled by consumer CSS**: cannot paint a WebGL canvas or a JS-computed radial mask. Insufficient for the actual target.
- **A `shadow` prop on Root taking a component**: makes composition order implicit and reads badly in a compound API.

### The tradeoff you are buying

Today the box-shadow is painted directly on `.discSurface` and `.sheet`. In this design it moves to the separate shadow layer, which means **if you do not render `<DiscSheet.Shadow />` you get a flat disc with no shadow.**

That is deliberate. The alternative (keep a built-in shadow on the surfaces *and* offer a shadow layer) means swapping in the dither requires two edits: add the layer, and null out the built-in. That is the friction that makes people not bother. Radix makes the same call with `Dialog.Overlay`. `<DiscSheet.Shadow />` appears in every documentation example including the one-line copy-paste sample.

---

## 5. File layout

### Package

```
disc-sheet/
├── package.json              ~35    name, root-only exports, react+motion peers
├── tsconfig.json             ~20    device-frame's, verbatim
├── README.md                ~260    pitch → install → one copy-paste sample → prop tables
└── src/
    ├── index.ts              ~25    the DiscSheet namespace object, useDiscSheet, exported types
    ├── Root.tsx             ~180    context, open+anchor state, LayoutGroup, persistence, reduced-motion, id generation
    ├── Disc.tsx             ~200    fixed drag wrapper, x/y MotionValues, drag + nearest-anchor snap, tap-vs-drag, trigger button, seed surface
    ├── Sheet.tsx            ~260    dialog surface, layoutId FLIP, borderRadius transform, swipe-to-close, placement from anchor
    ├── Shared.tsx            ~45    shared-element slot, own layoutId + spring
    ├── Content.tsx           ~70    post-bloom reveal container, scroll region, Item
    ├── Close.tsx             ~35    close button, registers itself for the dev warning
    ├── Backdrop.tsx          ~45    visual scrim only
    ├── Shadow.tsx            ~95    shadow slot + asChild merge, writes geometry vars per frame
    ├── context.ts            ~70    context type, useDiscSheet, the throw-outside-Root guard
    ├── anchors.ts           ~180    six-anchor model: nearestAnchor, restingLeft/Top, anchorCenter, sheetPlacement
    ├── motion.ts             ~75    default springs, internal choreography constants, transition merge
    ├── useDiscSize.ts        ~45    resolve the ramp to a number, write --disc-sheet-disc-size, resize handling
    ├── usePersistedAnchor.ts ~50    localStorage read + validate + write
    ├── useDialogBehavior.ts  ~95    scroll lock, focus trap, Escape, focus restore on exit-complete
    ├── readVarPx.ts          ~35    read a px custom property (radius tokens)
    ├── types.ts              ~60    AnchorId, Spring, MorphTransition, prop interfaces
    ├── styles.module.css    ~380    all package CSS, --disc-sheet-* vars with fallbacks
    └── css-modules.d.ts       ~4    device-frame's file, verbatim
```

Roughly 1,900 lines. That is higher than the raw extraction estimate (~800 TS + ~500 CSS) and the gap is honest: splitting a monolith into eight components adds context plumbing, prop interfaces, and the `asChild` merge that did not exist before.

### Example app

```
disc-sheet/example/
├── index.html            ~20
├── vite.config.ts         ~8
├── main.tsx              ~40    mount, palette toggle for light/midnight proof
├── IdentityDisc.tsx     ~220    Sean's contact surface, built on the primitive
├── DitherShadow.tsx     ~120    surface-fx dither layer through <DiscSheet.Shadow asChild>
├── CloseMask.tsx         ~60    the trailing-paper mask, rebuilt off collapseProgress (see §8)
└── example.module.css   ~200    the site's tokens mapped onto --disc-sheet-*
```

### Where surface-fx's conventions carry over, and where they do not

Carry over:
- Source-only, no build step. `"exports"` points straight at `src`.
- Installed from GitHub, consumed via Next `transpilePackages` or Vite's native TS.
- `react` and `motion` as peers, never dependencies. `motion` is genuinely required here; see §7A.
- vitest, for `anchors.ts` only. The region map and the sheet-placement clamping are pure functions with real edge cases (an anchor near a viewport edge, a sheet wider than the viewport). The morph is not unit-testable and should not be faked into looking tested.

Do not carry over:

1. **The subpath export map.** surface-fx uses `"./*": "./src/*.ts"`, which only resolves `.ts`. This package ships `.tsx` and `.module.css`, so that glob silently fails on exactly the files that matter. Use device-frame's root-only export. Consequence: no deep imports, the barrel is the whole API. Correct for a component package, wrong for a hook library, which is why the two differ.
2. **`css-modules.d.ts` is required.** surface-fx ships no CSS so it has no such shim. Copy device-frame's.
3. **JSX in the tsconfig.** surface-fx's tsconfig already sets `"jsx": "react-jsx"`, so this is inherited cleanly, but it is now load-bearing rather than incidental.
4. **No `scripts/` agent CLI, no MCP server, no param registry.** surface-fx has all three because it is a tuning library. This package's tuning is deliberately closed (§3). Copying that scaffolding would be copying the exact thing Sean decided to strip.
5. **A `example/` (Vite), not a `scripts/` playground.** device-frame's `demo/` is the model. Rename to `example/` to match the "flagship example" framing.

---

## 6. Accessibility contract

### What the package guarantees

**Trigger.** A real `<button type="button">`. `aria-haspopup="dialog"`. `aria-expanded` reflects state. `aria-controls` points at the sheet id while open. `aria-label` is a required prop, so a nameless trigger is a type error.

**Dialog semantics.** The sheet is `role="dialog"`, `aria-modal="true"`, `tabIndex={-1}`, with a package-generated `id` that matches the trigger's `aria-controls`. Its accessible name is required at the type level via the `Labelled` union: exactly one of `aria-label` or `aria-labelledby`.

**Focus management.**
- On open, focus moves to the dialog panel itself, not to the first control. This is deliberate and it is the shipped behavior (`ContactSheet.tsx:880-889`): focusing the first link pre-highlights it and reads as a selection the user did not make. Tab from the panel goes to the first control.
- On close, focus returns to the trigger at **exit-complete**, not at state change (`ContactSheet.tsx:1094-1096`). Restoring focus while the surface is still animating out causes a visible scroll jump.
- Tab and Shift+Tab cycle within the panel over `a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])`.

**Escape** closes, unconditionally, not configurable.

**Body scroll lock** while open, restoring the previous `overflow` value rather than clearing it.

**Reduced motion.** With `prefers-reduced-motion: reduce` or `reduceMotion`:
- No FLIP. `layoutId` is dropped on both the surface and the shared element, so the sheet cross-fades at 200ms instead of morphing.
- No swipe-to-close on the sheet (drag would fight the reduced-motion contract).
- Disc drag elastic goes to 0 and the anchor snap is instant.
- The default shadow layer paints statically at the resting silhouette.

**Hit target.** The drag wrapper is at least 96px on every breakpoint, comfortably over WCAG 2.5.5's 44px.

**Touch.** `touch-action: none` on the disc wrapper so Motion owns the pointer stream; `touch-action: pan-y` on the sheet so content still scrolls.

### What the consumer owns

- Every semantic inside `<DiscSheet.Sheet>`: heading levels, landmarks, link text, reading order.
- Supplying both accessible names. Both are typed-required, so this is enforced, not merely asked for.
- Rendering a visible `<DiscSheet.Close>`. The package does not place it, because placement is a design decision, but Root logs a dev-only warning if the sheet opens with none registered. Escape plus backdrop click is not sufficient for a touch user with a screen reader.
- Color contrast of the content and of any `--disc-sheet-*` overrides.
- Any live-region announcements their content needs beyond the dialog role.

### Known gaps, stated rather than hidden

1. **No `inert` on background content.** `aria-modal="true"` is what ships today and it covers modern AT, but screen readers that ignore it can navigate out of the dialog. Radix applies `inert` to siblings. v0.2 item, called out in the README rather than quietly omitted.
2. **The focus trap does not see into shadow DOM or iframes.** Same limitation as the shipped code.
3. **No keyboard repositioning.** The disc is fully reachable and operable by keyboard (Tab to it, Enter opens), but moving it between anchors is pointer-only. This matches the shipped component. See §8 for the cost.

---

## 7. The three hardest decisions

### A. `motion` is a required peer, with no CSS-only fallback

**Rejected:** a fallback morph path built on the Web Animations API and manual FLIP measurement, so the package works with zero animation-library dependency.

**Why rejected.** The morph is the product. A hand-rolled FLIP that must also interpolate border-radius through a hold-gate, run an independently-projected child element that does not inherit the parent's transform, and stay velocity-continuous with an in-flight drag gesture is the single hardest thing in the existing 4,000 lines. Rebuilding that without Motion's projection system means owning a second, worse animation engine forever, and the failure modes are exactly the ones already documented as landmines in this codebase (nested `layoutId` inheriting the parent FLIP, inline transform clobbering CSS positioning).

**Cost.** Anyone on GSAP-only, or wanting zero animation dependency, cannot use this. `bloom-menu` made the identical call with framer-motion, which is at least evidence the market tolerates it.

**Uncertainty: low.** I would make this call again without hesitating.

### B. `<DiscSheet.Shared>` is duplicated in both Disc and Sheet, not hoisted to a Root prop

**Rejected:** `<DiscSheet.Root shared={<Avatar />}>`, with the package rendering it into both states automatically.

**Why rejected.** The shared element needs genuinely different layout in each state. In the disc it is `inset: 2px` and clipped to a circle so the surface ring shows around it. In the sheet it is `position: absolute; top: 24px; left: 24px` at a fixed size, sitting over a spacer row (`ContactSheet.module.css:168-178`). A single hoisted node can only be styled by the package, which means the package would have to own sheet header layout. That is a content decision and it does not belong in a generic primitive. Duplicating the slot keeps layout with the consumer in both states.

**Cost.** A real footgun. If the two slots get different children, the morph looks broken and the cause is not obvious. Mitigations are weak: a dev-time child-count comparison catches the crude version and misses the subtle one.

**Uncertainty: medium-high.** This is the decision I would most want tested against a second, non-avatar use case before locking it. If the second use case also wants different layout per state, this is right. If it wants identical layout, the hoisted prop wins and I would want to know that before v1.

### C. The choreography constants stay internal, with one MotionValue as the only hatch

**Rejected:** a `tuning` prop mirroring the site's existing `BloomTuning` object.

**Why rejected.** It is the shortest path, because the code already reads from exactly such an object, and it is the classic options-menu failure. Every parameter becomes a compatibility promise. Worse, most of them are individually harmful: a consumer who sets `radiusHoldFraction` to 0.1 gets precisely the over-rounding artifact that the 0.74 default exists to suppress, then reports it as a package bug.

**Cost.** Someone who wants a materially different close choreography has to fork. Accepted. That is a fork worth forcing, because the alternative is a package that ships twenty ways to look wrong.

**Uncertainty: medium, on two specific values.** `radiusCloseDelaySec: 1.5` is a long hold and it is tuned to a 480px-wide, roughly 600px-tall sheet. A consumer with a 900px sheet will find it wrong, and they will be right. The fix without opening the floodgate is to scale the delay by measured sheet height internally rather than expose it as a number. Flagged as a v0.2 refinement, not a v0.1 blocker. The other soft spot is that `sheetMaxWidth` is a prop while `--disc-sheet-sheet-max-width` is also a CSS variable; those two must not disagree, and the package should let the prop win and write the variable.

---

## 8. What I would cut from v0.1

Ship this: `Root`, `Disc`, `Sheet`, `Shared`, `Content`, `Item`, `Close`, `Shadow`, `useDiscSheet`. Roughly 1,400 lines. That is the smallest thing that is still the actual product.

| Cut | Cost |
| --- | --- |
| **The entrance choreography** (WAAPI arrival stroke, impact ripple, velocity coupling) | Already out of scope per the extraction map; reconfirming it. Near-zero cost to the package. Real cost to the site: the disc simply appears. The site keeps its own arrival animation on a wrapper, driven off `useDiscSheet().discRect`. Say this out loud in the migration plan so nobody discovers it during cutover. |
| **`<DiscSheet.Backdrop>`** | Site default is already no scrim. Dismissal behavior still ships. A consumer who wants a dim scrim writes six lines of their own fixed div. Low. |
| **Controlled `anchor` + `onAnchorChange` as a controlled pair** | Ship uncontrolled and persisted only; keep `onAnchorChange` as a read-only notification. Cost: an app that wants to move the disc programmatically (get out of the way of another modal) cannot. Real use case, not v0.1's. Low-medium. |
| **The `anchors` subset prop and `edgeMargin`** | All six anchors at 16px. Cost: low, and it is additive later. |
| **Arrow-key repositioning between anchors** | Roughly 20 lines and a genuine accessibility and delight win, but it does not exist in the shipped component and extraction is the wrong time to add behavior. Cost: a documented a11y gap that stays documented. |
| **The trailing-paper close mask** (`surfaceCloseMask` and its triangular envelope) | **The expensive one, and it doubles as the design's own test.** See below. |

### On cutting the close mask

That mask is roughly 50 lines of the least explicable code in `ContactSheet.tsx` (lines 721-755). It exists to fix one artifact specific to a tall sheet whose shared element leads the close: mid-collapse, the vacated paper above the avatar sits as a solid opaque block for a few frames. A generic sheet with no leading shared element does not have that artifact at all, so it does not belong in a generic primitive.

But Sean's flagship example *does* have it, and cutting the mask outright would make the example visibly worse than the live site it replaces. That is not acceptable.

So: **cut it from the package, rebuild it in the example app** off `useDiscSheet().collapseProgress`, in `example/CloseMask.tsx`. Roughly 60 lines applying a `maskImage` to `<DiscSheet.Sheet>` from outside.

This is the design's own validation test. If that mask can be rebuilt from outside the package with no additional API, the escape hatch in §3 is proven sufficient and the internal-constants decision in §7C is safe. If it cannot, the hatch is inadequate and we learn it in week one, on a case we already understand, instead of after v1 on a case we do not.

Build the example's `CloseMask.tsx` **first**, before finalizing `useDiscSheet()`'s shape. It is the cheapest possible check on the most consequential decision in this document.
