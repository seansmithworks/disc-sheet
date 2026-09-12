import { createRoot } from "react-dom/client";
import { VistaSheet } from "../../src/index";
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

// Plain: "I could use this for a menu." Each row is its own <VistaSheet.Item>
// so the open stagger is visible per-row, not on the list as a block.
function App() {
  return (
    <div className="list-page">
      <VistaSheet.Root className="list-theme">
        <VistaSheet.Shadow />

        <VistaSheet.Trigger aria-label="Open quick actions">
          <VistaSheet.Shared>
            <MenuIcon />
          </VistaSheet.Shared>
        </VistaSheet.Trigger>

        <VistaSheet.Sheet aria-labelledby="list-sheet-title">
          <VistaSheet.Shared>
            <MenuIcon />
          </VistaSheet.Shared>

          <VistaSheet.Close aria-label="Close" />

          <VistaSheet.Content>
            <VistaSheet.Item>
              <h2 id="list-sheet-title" className="list-title">
                Quick actions
              </h2>
            </VistaSheet.Item>

            {rows.map((row) => (
              <VistaSheet.Item key={row.label}>
                <button type="button" className="list-row">
                  {row.label}
                </button>
              </VistaSheet.Item>
            ))}
          </VistaSheet.Content>
        </VistaSheet.Sheet>
      </VistaSheet.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
