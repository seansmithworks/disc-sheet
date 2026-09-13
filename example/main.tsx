import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { DialRoot, useDialKit, useDialKitController } from "dialkit";
import "dialkit/styles.css";
import { VistaSheet } from "../src/index";
import { CloseMask } from "./CloseMask";
import { ALL_ANCHORS, DEFAULT_ANCHOR, type AnchorId } from "../src/anchors";
import "./example.css";

// Sized to 100% of its parent, not a fixed px value: <VistaSheet.Shared>'s two
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

// Demo-only: a single persisted settings object driving every toggle/select
// in the "Design" VistaSheet below (iridescent glow, dark ground, surface
// palette, main trigger size, dial visibility). One key, one try/catch, so a
// reload keeps every setting together rather than scattering localStorage
// keys per control.
interface DemoSettings {
  iridescent: boolean;
  darkMode: boolean;
  surface: "neutral" | "warm";
  triggerSize: "small" | "default" | "large";
  showDials: boolean;
}
const DEFAULT_SETTINGS: DemoSettings = {
  iridescent: false,
  darkMode: false,
  surface: "neutral",
  triggerSize: "default",
  showDials: false,
};
const SETTINGS_KEY = "vista-sheet-example:settings";
function readSettings(): DemoSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Defensive parse: `darkGround` (pre-rename field) is ignored rather
    // than merged in — spreading it in would coexist with `darkMode` under
    // a name nothing reads anymore.
    const { darkGround: _darkGround, ...rest } = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...rest };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// The main Root's persisted anchor — same key `usePersistedAnchor` falls
// back to (DEFAULT_STORAGE_KEY) since main.tsx's <VistaSheet.Root id="main">
// below passes no `persistKey` override. Read directly here (rather than
// waiting on `onAnchorChange`, which only fires from a live drag — the
// mount-time localStorage restore inside usePersistedAnchor sets React
// state directly and never calls it) so the settings sheet's initial anchor
// already accounts for a persisted top-right main sheet on first paint.
const MAIN_ANCHOR_STORAGE_KEY = "vista-sheet-anchor";
function readMainAnchor(): AnchorId {
  try {
    const raw = localStorage.getItem(MAIN_ANCHOR_STORAGE_KEY);
    if (raw && (ALL_ANCHORS as string[]).includes(raw)) return raw as AnchorId;
  } catch {
    // Storage unavailable — keep the default.
  }
  return DEFAULT_ANCHOR;
}

// Main trigger's triggerSize ramp per "Trigger size" select. "Default" passes
// undefined so Root falls back to its own default ramp rather than us
// duplicating it here.
const TRIGGER_SIZE_RAMPS: Record<
  DemoSettings["triggerSize"],
  { base: number; md: number; xl: number } | undefined
> = {
  small: { base: 72, md: 96, xl: 112 },
  default: undefined,
  large: { base: 112, md: 144, xl: 168 },
};

// Package default palette (DESIGN.md "Package defaults" column) — applied as
// an inline override when "Surface" is set to Warm, since example.css's
// :root block hard-codes the neutral example palette.
const SURFACE_WARM_STYLE = {
  "--vista-sheet-surface": "#faf7f2",
  "--vista-sheet-surface-elevated": "#f4f0e8",
  "--vista-sheet-surface-border": "#e6dfd2",
  "--vista-sheet-text": "#1a1610",
  "--vista-sheet-accent": "#b4512e",
} as CSSProperties;

function SlidersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Live dials for the glow, shown only while the toggle is on. Persisted under
// dialkit:morph-sheet-iridescent. That key predates the VistaSheet rename —
// changing it orphans Sean's saved dial history, so the id below stays as-is.
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
// readVarPx: --vista-sheet-sheet-shadow-fade-start/-fade-end). Seeded so the
// heavy sheet shadow (`--vista-sheet-sheet-shadow`) is fully in at
// collapseProgress p=0 (open, at rest) and fully gone by p=0.25 — roughly
// where the silhouette has shrunk enough that the thin disc shadow
// (`--vista-sheet-shadow`) alone reads right, rather than a heavy blur on a
// small shape. Persisted under dialkit:morph-sheet-shadow-crossfade. That key
// predates the VistaSheet rename — changing it orphans Sean's saved dial
// history, so the id below stays as-is.
const SHADOW_CROSSFADE_DIALS = {
  fadeStart: [0, 0, 1, 0.01] as [number, number, number, number],
  fadeEnd: [0.25, 0, 1, 0.01] as [number, number, number, number],
};

function App() {
  const [settings, setSettings] = useState(readSettings);
  const iri = settings.iridescent;
  const updateSettings = (next: Partial<DemoSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      } catch {
        // storage blocked — the settings still work for this page view
      }
      return merged;
    });
  };
  // Dark mode toggles body-level background/text, not just `.page` (the
  // page div has no explicit height, so a short page would leave the
  // original light body visible below the fold) — and, via example.css's
  // `body[data-dark-mode="true"]` block, the --vista-sheet-* consumer
  // tokens both sheets read, so they switch to dark chrome too.
  useEffect(() => {
    document.body.dataset.darkMode = settings.darkMode ? "true" : "false";
  }, [settings.darkMode]);

  // The settings sheet's anchor is derived, not a user choice: it takes
  // top-right unless the main sheet already occupies it, in which case it
  // takes top-left — so the two triggers can never overlap. `mainAnchor`
  // seeds from the persisted value at mount (readMainAnchor) and tracks
  // live drags via onAnchorChange below.
  const [mainAnchor, setMainAnchor] = useState<AnchorId>(readMainAnchor);
  const settingsAnchor: AnchorId =
    mainAnchor === "top-right" ? "top-left" : "top-right";
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
  // ancestor of <VistaSheet.Shadow> — CSS custom properties inherit down the
  // DOM tree, and .shadow (or an asChild swap) isn't portalled, so Shadow.tsx's
  // readVarPx(el, ...) picks these up via getComputedStyle the same way it
  // already reads --vista-sheet-sheet-radius from wherever a consumer set it.
  const shadowCrossfadeStyle = {
    "--vista-sheet-sheet-shadow-fade-start": shadowCrossfade.fadeStart,
    "--vista-sheet-sheet-shadow-fade-end": shadowCrossfade.fadeEnd,
  } as CSSProperties;
  const pageStyle = {
    ...shadowCrossfadeStyle,
    ...(settings.surface === "warm" ? SURFACE_WARM_STYLE : {}),
  } as CSSProperties;

  return (
    <div className="page" style={pageStyle}>
      {/* Gated on the same toggle as the glow dials (not rendered
          unconditionally): DialRoot's own "Versions" trigger button overlays
          the morph trigger at narrow viewports and intercepts its clicks,
          which broke 20 geometry.spec.ts tests when this was unconditional.
          The Sheet shadow crossfade panel registered below still shows up
          here once "Show dials" is on. */}
      {settings.showDials && <DialRoot position="bottom-right" />}
      <h1>vista-sheet</h1>
      <p className="sub">
        A bare trigger, morphing into a sheet. Tap the trigger (bottom-center by
        default) — drag it to any of the seven anchors first if you like.
      </p>

      <VistaSheet.Root
        id="main"
        zIndex={zIndexOverride}
        sheetMaxWidth={sheetMaxWidthOverride}
        triggerSize={TRIGGER_SIZE_RAMPS[settings.triggerSize]}
        onAnchorChange={setMainAnchor}
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
          <VistaSheet.Shadow asChild>
            <div className="iri-shadow" style={iriStyle} />
          </VistaSheet.Shadow>
        ) : (
          <VistaSheet.Shadow />
        )}

        <VistaSheet.Trigger aria-label="Open example sheet">
          <VistaSheet.Shared>
            <ColorCircle />
          </VistaSheet.Shared>
        </VistaSheet.Trigger>

        <VistaSheet.Sheet aria-labelledby="example-sheet-title">
          <VistaSheet.Shared>
            <ColorCircle />
          </VistaSheet.Shared>

          <VistaSheet.Close aria-label="Close" />

          <VistaSheet.Content>
            <VistaSheet.Item>
              <h2 id="example-sheet-title">Placeholder heading</h2>
              <p>
                Everything inside &lt;VistaSheet.Content&gt; is supplied by the
                consumer. This example ships a colored circle, this heading, and
                two links.
              </p>
            </VistaSheet.Item>
            <VistaSheet.Item>
              <nav
                aria-label="Example links"
                style={{ display: "flex", gap: 16 }}
              >
                <a href="https://example.com">Example.com</a>
                <a href="https://github.com">GitHub</a>
              </nav>
            </VistaSheet.Item>
          </VistaSheet.Content>
        </VistaSheet.Sheet>

        {/* CloseMask demonstrates the escape hatch: it rebuilds the
            trailing-paper close mask from OUTSIDE the package using only
            useVistaSheet().collapseProgress (+ its built-in getVelocity()) and
            triggerRect/sheetRect. It renders no DOM of its own — it finds the
            live sheet element by its documented data-vista-sheet-part="sheet"
            attribute and writes a mask-image directly onto it. See
            CloseMask.tsx. */}
        <CloseMask />
      </VistaSheet.Root>

      {/* A second, independent VistaSheet.Root: a small "Design" settings
          panel that restyles the demo above. Own id ("settings", vs the main
          sheet's "main") and own persistKey so its anchor never shares
          localStorage with the main sheet's. Rendered after (and painted
          above, via a higher zIndex) the main Root so the two triggers never
          fight over stacking order if they ever visually overlap. Not
          draggable — it is a fixed utility control, not the demo subject. */}
      <VistaSheet.Root
        // Remounted on its own derived anchor (`key`): anchor is
        // uncontrolled-only in v0.1 (docs/PACKAGE-DESIGN.md §8), so a
        // `defaultAnchor` change alone wouldn't move an already-mounted
        // Root. Safe here specifically because this Root is non-draggable
        // and modal-when-open — the main trigger can't be mid-drag while
        // this remounts, so there's no in-flight gesture to interrupt.
        key={settingsAnchor}
        id="settings"
        defaultAnchor={settingsAnchor}
        persistKey={false}
        draggable={false}
        triggerSize={40}
        zIndex={300}
      >
        <VistaSheet.Trigger aria-label="Design settings">
          <SlidersIcon />
        </VistaSheet.Trigger>

        <VistaSheet.Sheet aria-labelledby="settings-sheet-title">
          <VistaSheet.Close aria-label="Close settings" />

          <VistaSheet.Content>
            <VistaSheet.Item>
              <h2 id="settings-sheet-title">Design</h2>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <span className="settings-label" id="setting-iridescent-label">
                  Iridescent shadow
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.iridescent}
                  aria-labelledby="setting-iridescent-label"
                  className="demo-toggle-switch"
                  onClick={() =>
                    updateSettings({ iridescent: !settings.iridescent })
                  }
                >
                  <span className="demo-toggle-track" aria-hidden="true" />
                </button>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label className="settings-label" htmlFor="setting-palette">
                  Glow palette
                </label>
                <select
                  id="setting-palette"
                  className="settings-select"
                  value={dials.palette}
                  disabled={!settings.iridescent}
                  onChange={(e) =>
                    iriController.setValue("palette", e.target.value)
                  }
                >
                  {IRI_DIALS.palette.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <span className="settings-label" id="setting-dark-mode-label">
                  Dark mode
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.darkMode}
                  aria-labelledby="setting-dark-mode-label"
                  className="demo-toggle-switch"
                  onClick={() =>
                    updateSettings({ darkMode: !settings.darkMode })
                  }
                >
                  <span className="demo-toggle-track" aria-hidden="true" />
                </button>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label className="settings-label" htmlFor="setting-surface">
                  Surface
                </label>
                <select
                  id="setting-surface"
                  className="settings-select"
                  value={settings.surface}
                  onChange={(e) =>
                    updateSettings({
                      surface: e.target.value as DemoSettings["surface"],
                    })
                  }
                >
                  <option value="neutral">Neutral</option>
                  <option value="warm">Warm</option>
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label
                  className="settings-label"
                  htmlFor="setting-trigger-size"
                >
                  Trigger size
                </label>
                <select
                  id="setting-trigger-size"
                  className="settings-select"
                  value={settings.triggerSize}
                  onChange={(e) =>
                    updateSettings({
                      triggerSize: e.target
                        .value as DemoSettings["triggerSize"],
                    })
                  }
                >
                  <option value="small">Small</option>
                  <option value="default">Default</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <span className="settings-label" id="setting-show-dials-label">
                  Show dials
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showDials}
                  aria-labelledby="setting-show-dials-label"
                  className="demo-toggle-switch"
                  onClick={() =>
                    updateSettings({ showDials: !settings.showDials })
                  }
                >
                  <span className="demo-toggle-track" aria-hidden="true" />
                </button>
              </div>
            </VistaSheet.Item>
          </VistaSheet.Content>
        </VistaSheet.Sheet>
      </VistaSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
