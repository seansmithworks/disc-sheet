import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { DialRoot, useDialKit, useDialKitController } from "dialkit";
import "dialkit/styles.css";
import { MorphSheet } from "../src/index";
import { CloseMask } from "./CloseMask";
import "./example.css";

// Sized to 100% of its parent, not a fixed px value: <MorphSheet.Shared>'s two
// instances (trigger-side and sheet-side) are laid out at different sizes by the
// package itself (the trigger's inset circle, the sheet's margined circle), so
// the child inside must fill whatever box it's given rather than assert its
// own size. Passing two differently-sized children into the two slots is
// exactly the footgun docs/PACKAGE-DESIGN.md §7B warns about (E1).
function ColorCircle() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #48484a 0%, #1d1d1f 100%)",
      }}
    />
  );
}

// Test-only prop overrides via query string (e.g. ?zIndex=500&sheetMaxWidth=600),
// so geometry.spec.ts can assert M1/M2 (zIndex / sheetMaxWidth actually
// reaching the CSS) without a second, divergent example mount.
const testParams = new URLSearchParams(window.location.search);
const zIndexOverride = testParams.has("zIndex")
  ? Number(testParams.get("zIndex"))
  : undefined;
const sheetMaxWidthOverride = testParams.has("sheetMaxWidth")
  ? Number(testParams.get("sheetMaxWidth"))
  : undefined;
// Test-only: a consumer-supplied delay on transition.open, so geometry.spec.ts
// can assert D4 (Root.tsx's drivenOpenTransition used to force delay:0 on the
// collapseProgress clock while Sheet.tsx's layoutId transition kept the
// consumer's delay, desyncing the two clocks by exactly this amount).
const openDelayOverride = testParams.has("openDelay")
  ? Number(testParams.get("openDelay"))
  : undefined;

// Demo-only: swaps the plain shadow for an iridescent glow while open, so the
// open/close reads clearly in short screen-recording clips. Persisted so a
// reload keeps the setting.
const IRI_KEY = "morph-sheet-example:iridescent";
function readIri() {
  try {
    return localStorage.getItem(IRI_KEY) === "1";
  } catch {
    return false;
  }
}

// Live dials for the glow, shown only while the toggle is on. Persisted under
// dialkit:morph-sheet-iridescent.
const IRI_DIALS = {
  palette: {
    type: "select" as const,
    options: ["Rainbow", "Mono", "Midnight Purple", "Neon Gold"],
    default: "Rainbow",
  },
  opacity: [0.5, 0, 1, 0.01] as [number, number, number, number],
  length: [56, 0, 240, 1] as [number, number, number, number],
  blur: [40, 0, 120, 1] as [number, number, number, number],
  saturation: [1.15, 0, 2, 0.05] as [number, number, number, number],
  spinSeconds: [8, 1, 30, 0.5] as [number, number, number, number],
  colors: {
    one: "#ff6ec7",
    two: "#7cc4ff",
    three: "#6effc6",
    four: "#ffe66e",
    five: "#ff9f6e",
    six: "#b28bff",
  },
};

// Strawman palette presets for the "palette" select above — chosen for how
// they read on video, not for a rebuild of the glow. Selecting one just
// pushes these onto the existing dials (colors + saturation/blur/opacity/
// spin/length); every slider stays live and tweakable after. Rainbow mirrors
// IRI_DIALS' own defaults so the select's default option is a no-op.
type IriPreset = {
  opacity: number;
  length: number;
  blur: number;
  saturation: number;
  spinSeconds: number;
  colors: {
    one: string;
    two: string;
    three: string;
    four: string;
    five: string;
    six: string;
  };
};
const IRI_PALETTES: Record<string, IriPreset> = {
  Rainbow: {
    opacity: 0.5,
    length: 56,
    blur: 40,
    saturation: 1.15,
    spinSeconds: 8,
    colors: {
      one: "#ff6ec7",
      two: "#7cc4ff",
      three: "#6effc6",
      four: "#ffe66e",
      five: "#ff9f6e",
      six: "#b28bff",
    },
  },
  // Texture over hue shift: near-neutral stops with small value/temperature
  // steps, a bit more opacity/blur so the moving light reads as texture
  // rather than a colour wheel, and a slower spin.
  Mono: {
    opacity: 0.65,
    length: 64,
    blur: 60,
    saturation: 0.5,
    spinSeconds: 14,
    colors: {
      one: "#f5f3f0",
      two: "#c9ced4",
      three: "#b9b3c4",
      four: "#4a4a50",
      five: "#ffffff",
      six: "#8a94a6",
    },
  },
  // Nissan R34 GT-R V-Spec "Midnight Purple III" (LV4) colour-flop pearl:
  // deep violet through plum, a teal-green flop, a bronze/copper glint, and
  // a magenta highlight. Slow spin so the flop reads as a paint shift.
  "Midnight Purple": {
    opacity: 0.55,
    length: 60,
    blur: 44,
    saturation: 1.3,
    spinSeconds: 16,
    colors: {
      one: "#3a1250",
      two: "#5c1f4a",
      three: "#1f5c52",
      four: "#a86a3d",
      five: "#b8228a",
      six: "#180a24",
    },
  },
  // Luminous, not metallic: amber/yellow/orange with a pale butter highlight,
  // higher saturation. Glow, not chrome.
  "Neon Gold": {
    opacity: 0.6,
    length: 60,
    blur: 46,
    saturation: 1.4,
    spinSeconds: 10,
    colors: {
      one: "#ffb833",
      two: "#fff066",
      three: "#ff8c1a",
      four: "#fff3c2",
      five: "#ffd166",
      six: "#ff6a00",
    },
  },
};

// The Shadow crossfade window (Shadow.tsx reads these two vars via
// readVarPx: --morph-sheet-sheet-shadow-fade-start/-fade-end). Seeded so the
// heavy sheet shadow (`--morph-sheet-sheet-shadow`) is fully in at
// collapseProgress p=0 (open, at rest) and fully gone by p=0.25 — roughly
// where the silhouette has shrunk enough that the thin disc shadow
// (`--morph-sheet-shadow`) alone reads right, rather than a heavy blur on a
// small shape. Persisted under dialkit:morph-sheet-shadow-crossfade.
const SHADOW_CROSSFADE_DIALS = {
  fadeStart: [0, 0, 1, 0.01] as [number, number, number, number],
  fadeEnd: [0.25, 0, 1, 0.01] as [number, number, number, number],
};

function App() {
  const [iri, setIri] = useState(readIri);
  const iriController = useDialKitController("Iridescent shadow", IRI_DIALS, {
    id: "morph-sheet-iridescent",
    persist: true,
  });
  const dials = iriController.values;
  // Applies a palette's preset values onto the live dials the moment the
  // "palette" select changes, so every slider updates but stays tweakable
  // afterward. Guarded by a ref (not state) so it never re-fires just
  // because a slider moved, and never fires on mount for the default.
  const lastPalette = useRef(dials.palette);
  useEffect(() => {
    if (dials.palette === lastPalette.current) return;
    lastPalette.current = dials.palette;
    const preset = IRI_PALETTES[dials.palette];
    if (!preset) return;
    iriController.setValue("opacity", preset.opacity);
    iriController.setValue("length", preset.length);
    iriController.setValue("blur", preset.blur);
    iriController.setValue("saturation", preset.saturation);
    iriController.setValue("spinSeconds", preset.spinSeconds);
    iriController.setValue("colors.one", preset.colors.one);
    iriController.setValue("colors.two", preset.colors.two);
    iriController.setValue("colors.three", preset.colors.three);
    iriController.setValue("colors.four", preset.colors.four);
    iriController.setValue("colors.five", preset.colors.five);
    iriController.setValue("colors.six", preset.colors.six);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dials.palette]);
  const shadowCrossfade = useDialKit(
    "Sheet shadow crossfade",
    SHADOW_CROSSFADE_DIALS,
    { id: "morph-sheet-shadow-crossfade", persist: true },
  );
  const c = dials.colors;
  const iriStyle = {
    "--iri-opacity": dials.opacity,
    "--iri-length": `${dials.length}px`,
    "--iri-blur": `${dials.blur}px`,
    "--iri-saturation": dials.saturation,
    "--iri-spin": `${dials.spinSeconds}s`,
    "--iri-colors": [c.one, c.two, c.three, c.four, c.five, c.six, c.one].join(
      ", ",
    ),
  } as CSSProperties;
  // Consumer-set crossfade dial, plumbed as CSS custom properties on an
  // ancestor of <MorphSheet.Shadow> — CSS custom properties inherit down the
  // DOM tree, and .shadow (or an asChild swap) isn't portalled, so Shadow.tsx's
  // readVarPx(el, ...) picks these up via getComputedStyle the same way it
  // already reads --morph-sheet-sheet-radius from wherever a consumer set it.
  const shadowCrossfadeStyle = {
    "--morph-sheet-sheet-shadow-fade-start": shadowCrossfade.fadeStart,
    "--morph-sheet-sheet-shadow-fade-end": shadowCrossfade.fadeEnd,
  } as CSSProperties;
  const toggleIri = () => {
    const next = !iri;
    setIri(next);
    try {
      localStorage.setItem(IRI_KEY, next ? "1" : "0");
    } catch {
      // storage blocked — the toggle still works for this page view
    }
  };

  return (
    <div className="page" style={shadowCrossfadeStyle}>
      <button
        type="button"
        role="switch"
        aria-checked={iri}
        className="demo-toggle"
        onClick={toggleIri}
      >
        <span className="demo-toggle-track" aria-hidden="true" />
        Iridescent shadow
      </button>
      {/* Gated on the same toggle as the glow dials (not rendered
          unconditionally): DialRoot's own "Versions" trigger button overlays
          the morph trigger at narrow viewports and intercepts its clicks,
          which broke 20 geometry.spec.ts tests when this was unconditional.
          The Sheet shadow crossfade panel registered below still shows up
          here once the iri toggle is on. */}
      {iri && <DialRoot position="bottom-right" />}
      <h1>morph-sheet</h1>
      <p className="sub">
        A bare trigger, morphing into a sheet. Tap the trigger (bottom-center by
        default) — drag it to any of the six anchors first if you like.
      </p>

      <MorphSheet.Root
        zIndex={zIndexOverride}
        sheetMaxWidth={sheetMaxWidthOverride}
        transition={
          openDelayOverride !== undefined
            ? {
                open: {
                  type: "spring",
                  stiffness: 375,
                  damping: 42.5,
                  mass: 1.75,
                  delay: openDelayOverride,
                },
              }
            : undefined
        }
      >
        {iri ? (
          <MorphSheet.Shadow asChild>
            <div className="iri-shadow" style={iriStyle} />
          </MorphSheet.Shadow>
        ) : (
          <MorphSheet.Shadow />
        )}

        <MorphSheet.Trigger aria-label="Open example sheet">
          <MorphSheet.Shared>
            <ColorCircle />
          </MorphSheet.Shared>
        </MorphSheet.Trigger>

        <MorphSheet.Sheet aria-labelledby="example-sheet-title">
          <MorphSheet.Shared>
            <ColorCircle />
          </MorphSheet.Shared>

          <MorphSheet.Close aria-label="Close" />

          <MorphSheet.Content>
            <MorphSheet.Item>
              <h2 id="example-sheet-title">Placeholder heading</h2>
              <p>
                Everything inside &lt;MorphSheet.Content&gt; is supplied by the
                consumer. This example ships a colored circle, this heading, and
                two links.
              </p>
            </MorphSheet.Item>
            <MorphSheet.Item>
              <nav
                aria-label="Example links"
                style={{ display: "flex", gap: 16 }}
              >
                <a href="https://example.com">Example.com</a>
                <a href="https://github.com">GitHub</a>
              </nav>
            </MorphSheet.Item>
          </MorphSheet.Content>
        </MorphSheet.Sheet>

        {/* CloseMask demonstrates the escape hatch: it rebuilds the
            trailing-paper close mask from OUTSIDE the package using only
            useMorphSheet().collapseProgress (+ its built-in getVelocity()) and
            triggerRect/sheetRect. It renders no DOM of its own — it finds the
            live sheet element by its documented data-morph-sheet-part="sheet"
            attribute and writes a mask-image directly onto it. See
            CloseMask.tsx. */}
        <CloseMask />
      </MorphSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
