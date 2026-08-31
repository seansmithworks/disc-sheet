import { createRoot } from "react-dom/client";
import { DiscSheet } from "../../src/index";
import { CloseMask } from "../CloseMask";
import "./flagship.css";
import portraitUrl from "./portrait.jpg";

// The flagship's shared portrait, sized to 100% of whatever slot the package
// gives it (disc-side inset circle, sheet-side margined circle) — same
// pattern as example/main.tsx's ColorCircle, just with a photo + the
// dither-bloom ring instead of a gradient.
function Portrait() {
  return (
    <div className="flagship-portrait">
      <img src={portraitUrl} alt="" />
    </div>
  );
}

const actions = [
  {
    label: "Email",
    handle: "sean@seansmithdesign.com",
    href: "mailto:sean@seansmithdesign.com",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        <path d="m4 6 8 7 8-7" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    handle: "seansmithworks",
    href: "https://www.linkedin.com/in/seansmithworks/",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7.5 9.5v7M7.5 6.75v.01M12 16.5v-4a2.25 2.25 0 0 1 4.5 0v4M12 12.5v4" />
      </svg>
    ),
  },
  {
    label: "X",
    handle: "@seansmithworks",
    href: "https://x.com/seansmithworks",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="m4 4 16 16M20 4 4 20" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    handle: "seansmithworks",
    href: "https://github.com/seansmithworks",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2-.2 4.5-1 4.5-4.5a3.5 3.5 0 0 0-1-2.5 3.3 3.3 0 0 0-.1-2.5s-.9-.3-2.9 1a10 10 0 0 0-5.2 0c-2-1.3-2.9-1-2.9-1a3.3 3.3 0 0 0-.1 2.5 3.5 3.5 0 0 0-1 2.5c0 3.5 2.5 4.3 4.5 4.5-.4.4-.6.9-.5 1.7v3.8" />
      </svg>
    ),
  },
  {
    label: "Resume",
    handle: "PDF",
    href: "https://seansmithdesign.com/resume",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5" />
      </svg>
    ),
  },
];

function App() {
  return (
    <div className="flagship-page">
      <DiscSheet.Root className="flagship-theme">
        <DiscSheet.Shadow />

        <DiscSheet.Disc aria-label="Open contact">
          <DiscSheet.Shared>
            <Portrait />
          </DiscSheet.Shared>
        </DiscSheet.Disc>

        <DiscSheet.Sheet aria-labelledby="flagship-sheet-title">
          <DiscSheet.Shared>
            <Portrait />
          </DiscSheet.Shared>

          <DiscSheet.Content>
            <DiscSheet.Close aria-label="Close" />
            <DiscSheet.Item>
              <p className="flagship-eyebrow">Open to work · 2026</p>
              <h2 id="flagship-sheet-title" className="flagship-title">
                Let&rsquo;s make something together!
              </h2>
              <p className="flagship-tagline">
                Looking for full-time design leadership, and open to advisory.
                Email is fastest.
              </p>
            </DiscSheet.Item>

            <DiscSheet.Item>
              <nav aria-label="Contact links" className="flagship-actions">
                {actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className="flagship-action"
                    target={
                      action.href.startsWith("mailto:") ? undefined : "_blank"
                    }
                    rel={
                      action.href.startsWith("mailto:")
                        ? undefined
                        : "noreferrer"
                    }
                  >
                    <span className="flagship-action-icon" aria-hidden="true">
                      {action.icon}
                    </span>
                    <span className="flagship-action-label">
                      {action.label}
                    </span>
                    <span className="flagship-action-handle">
                      {action.handle}
                    </span>
                  </a>
                ))}
              </nav>
            </DiscSheet.Item>

            <DiscSheet.Item>
              <a
                className="flagship-cta"
                href="https://calendar.app.google/bSgz9A1G5FnY6CdD8"
                target="_blank"
                rel="noreferrer"
              >
                book a slot ↗
              </a>
            </DiscSheet.Item>
          </DiscSheet.Content>
        </DiscSheet.Sheet>

        {/* Escape-hatch reuse, unmodified — see example/CloseMask.tsx. */}
        <CloseMask />
      </DiscSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
