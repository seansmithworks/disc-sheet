import { createRoot } from "react-dom/client";
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
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
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

function App() {
  return (
    <div className="page">
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
        <MorphSheet.Shadow />

        <MorphSheet.Trigger aria-label="Open example sheet">
          <MorphSheet.Shared>
            <ColorCircle />
          </MorphSheet.Shared>
        </MorphSheet.Trigger>

        <MorphSheet.Sheet aria-labelledby="example-sheet-title">
          <MorphSheet.Shared>
            <ColorCircle />
          </MorphSheet.Shared>

          <MorphSheet.Content>
            <MorphSheet.Close aria-label="Close" />
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
