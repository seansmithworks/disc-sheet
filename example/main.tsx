import { createRoot } from "react-dom/client";
import { DiscSheet } from "../src/index";
import { CloseMask } from "./CloseMask";

function ColorCircle({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      }}
    />
  );
}

function App() {
  return (
    <div className="page">
      <h1>disc-sheet</h1>
      <p className="sub">
        A bare disc, morphing into a sheet. Tap the disc (bottom-center by
        default) — drag it to any of the six anchors first if you like.
      </p>

      <DiscSheet.Root>
        <DiscSheet.Shadow />

        <DiscSheet.Disc aria-label="Open example sheet">
          <DiscSheet.Shared>
            <ColorCircle size={96} />
          </DiscSheet.Shared>
        </DiscSheet.Disc>

        <DiscSheet.Sheet aria-labelledby="example-sheet-title">
          <DiscSheet.Shared>
            <ColorCircle size={64} />
          </DiscSheet.Shared>

          <DiscSheet.Content>
            <DiscSheet.Close aria-label="Close" />
            <DiscSheet.Item>
              <h2 id="example-sheet-title">Placeholder heading</h2>
              <p>
                Everything inside &lt;DiscSheet.Content&gt; is supplied by the
                consumer. This example ships a colored circle, this heading, and
                two links.
              </p>
            </DiscSheet.Item>
            <DiscSheet.Item>
              <nav
                aria-label="Example links"
                style={{ display: "flex", gap: 16 }}
              >
                <a href="https://example.com">Example.com</a>
                <a href="https://github.com">GitHub</a>
              </nav>
            </DiscSheet.Item>
          </DiscSheet.Content>
        </DiscSheet.Sheet>

        {/* CloseMask demonstrates the escape hatch: it rebuilds the
            trailing-paper close mask from OUTSIDE the package using only
            useDiscSheet().collapseProgress (+ its built-in getVelocity()) and
            discRect/sheetRect. It renders no DOM of its own — it finds the
            live sheet element by its documented data-disc-sheet-part="sheet"
            attribute and writes a mask-image directly onto it. See
            CloseMask.tsx. */}
        <CloseMask />
      </DiscSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
