import { createRoot } from "react-dom/client";
import { MorphSheet } from "../../src/index";
import "./list.css";

function MenuIcon() {
  return (
    <div className="list-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </div>
  );
}

const rows = [
  { label: "New note" },
  { label: "Share" },
  { label: "Archive" },
  { label: "Rename" },
  { label: "Delete" },
];

// Plain: "I could use this for a menu." Each row is its own <MorphSheet.Item>
// so the open stagger is visible per-row, not on the list as a block.
function App() {
  return (
    <div className="list-page">
      <MorphSheet.Root className="list-theme">
        <MorphSheet.Shadow />

        <MorphSheet.Trigger aria-label="Open quick actions">
          <MorphSheet.Shared>
            <MenuIcon />
          </MorphSheet.Shared>
        </MorphSheet.Trigger>

        <MorphSheet.Sheet aria-labelledby="list-sheet-title">
          <MorphSheet.Shared>
            <MenuIcon />
          </MorphSheet.Shared>

          <MorphSheet.Content>
            <MorphSheet.Close aria-label="Close" />

            <MorphSheet.Item>
              <h2 id="list-sheet-title" className="list-title">
                Quick actions
              </h2>
            </MorphSheet.Item>

            {rows.map((row) => (
              <MorphSheet.Item key={row.label}>
                <button type="button" className="list-row">
                  {row.label}
                </button>
              </MorphSheet.Item>
            ))}
          </MorphSheet.Content>
        </MorphSheet.Sheet>
      </MorphSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
