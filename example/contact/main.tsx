import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MorphSheet } from "../../src/index";
import "./contact.css";

function PencilIcon() {
  return (
    <div className="contact-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
        <path d="m13.5 6.5 3 3" />
      </svg>
    </div>
  );
}

// The origin story of the component: a small form holding real interactive
// content, not just static text. Focus management is the point of this
// example — the sheet already ships a focus trap (useDialogBehavior.ts),
// so it's worth proving Tab actually cycles the three fields + submit
// without escaping, and that every field has a real associated label.
function App() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="contact-page">
      <MorphSheet.Root className="contact-theme">
        <MorphSheet.Shadow />

        <MorphSheet.Trigger aria-label="Open contact form">
          <MorphSheet.Shared>
            <PencilIcon />
          </MorphSheet.Shared>
        </MorphSheet.Trigger>

        <MorphSheet.Sheet aria-labelledby="contact-sheet-title">
          <MorphSheet.Shared>
            <PencilIcon />
          </MorphSheet.Shared>

          <MorphSheet.Content>
            <MorphSheet.Close aria-label="Close" />

            <MorphSheet.Item>
              <h2 id="contact-sheet-title" className="contact-title">
                Send a message
              </h2>
            </MorphSheet.Item>

            <MorphSheet.Item>
              <form
                className="contact-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
              >
                <div className="contact-field">
                  <label htmlFor="contact-name">Name</label>
                  <input id="contact-name" name="name" type="text" required />
                </div>

                <div className="contact-field">
                  <label htmlFor="contact-email">Email</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                  />
                </div>

                <div className="contact-field">
                  <label htmlFor="contact-message">Message</label>
                  <textarea id="contact-message" name="message" rows={4} />
                </div>

                <button type="submit" className="contact-submit">
                  Send
                </button>

                <p role="status" className="contact-status">
                  {submitted ? "Sent — thanks." : ""}
                </p>
              </form>
            </MorphSheet.Item>
          </MorphSheet.Content>
        </MorphSheet.Sheet>
      </MorphSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
