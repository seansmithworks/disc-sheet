import { createRoot } from "react-dom/client";
import { VistaSheet, presets } from "../../src/index";
import "./media-card.css";

// The whole point of this example: the SAME icon renders in both
// <VistaSheet.Shared> slots (trigger-side and sheet-side). The package's
// FLIP morph animates one continuous element between them, so what you
// tapped does not get replaced by an unrelated panel — it grows INTO the
// card's own icon. A modal opening over the trigger cannot do this; that
// continuity is the "why" this example exists to show.
function AppIcon() {
  return (
    <div className="media-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  );
}

function App() {
  return (
    <div className="media-page">
      <p className="media-whisper">
        Tap the icon — it becomes the card&rsquo;s icon, not a new one.
      </p>

      {/* Dogfoods the preset API (Phase 1): `snappy` in place of hand-typed
          spring numbers, exactly what presets exist to avoid. */}
      <VistaSheet.Root className="media-theme" preset={presets.snappy}>
        <VistaSheet.Shadow />

        <VistaSheet.Trigger aria-label="Open Wavelength preview">
          <VistaSheet.Shared>
            <AppIcon />
          </VistaSheet.Shared>
        </VistaSheet.Trigger>

        <VistaSheet.Sheet aria-labelledby="media-card-title">
          <VistaSheet.Shared>
            <AppIcon />
          </VistaSheet.Shared>

          <VistaSheet.Close aria-label="Close" />

          <VistaSheet.Content>
            <VistaSheet.Item>
              <div className="media-header">
                <div>
                  <h2 id="media-card-title" className="media-title">
                    Wavelength
                  </h2>
                  <p className="media-subtitle">Podcasts, tuned to you</p>
                </div>
                <a
                  className="media-get"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  GET
                </a>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <dl className="media-meta">
                <div className="media-meta-stat">
                  <dt>Rating</dt>
                  <dd>4.8 &#9733;</dd>
                </div>
                <div className="media-meta-stat">
                  <dt>Reviews</dt>
                  <dd>2.1k</dd>
                </div>
                <div className="media-meta-stat">
                  <dt>Category</dt>
                  <dd>Music</dd>
                </div>
                <div className="media-meta-stat">
                  <dt>Age</dt>
                  <dd>4+</dd>
                </div>
              </dl>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <p className="media-description">
                Wavelength surfaces the five episodes you&rsquo;d actually
                finish today, not the five hundred you saved. No feed to scroll,
                just a queue that ends.
              </p>
            </VistaSheet.Item>
          </VistaSheet.Content>
        </VistaSheet.Sheet>
      </VistaSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
