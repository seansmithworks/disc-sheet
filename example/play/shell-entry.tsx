import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Controls } from "./Controls";
import { isPlayMessage } from "./messages";
import { buildCss, printJsxFile } from "./codegen";
import { DEFAULT_STATE, type PlayState } from "./state";
import "./shell.css";

// Strawman (v0.2): 900px is the docked-panel breakpoint. Below it the
// playground drops the 360px aside for a VistaSheet sheet (task 4).
const DESKTOP_QUERY = "(min-width: 900px)";

function Shell() {
  const [state, setState] = useState<PlayState>(DEFAULT_STATE);
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageReadyRef = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.origin !== location.origin) return;
      if (!isPlayMessage(e.data)) return;

      if (e.data.type === "vista-sheet-play:ready") {
        stageReadyRef.current = true;
        frame.contentWindow?.postMessage(
          { type: "vista-sheet-play:state", state },
          location.origin,
        );
      } else if (e.data.type === "vista-sheet-play:anchor") {
        const anchor = e.data.anchor;
        setState((s) => ({ ...s, anchor }));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stageReadyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "vista-sheet-play:state", state },
      location.origin,
    );
  }, [state]);

  function copy(kind: "jsx" | "css") {
    const text = kind === "jsx" ? printJsxFile(state) : buildCss(state);
    void navigator.clipboard.writeText(text);
    const label = kind === "jsx" ? "Copied JSX" : "Copied CSS";
    setCopyStatus(label);
    setTimeout(() => setCopyStatus((s) => (s === label ? null : s)), 2000);
  }

  const iframe = (
    <iframe
      ref={iframeRef}
      data-play-stage
      title="Specimen"
      src="./play.html?stage=1"
      style={{
        display: "block",
        width: "100%",
        height: "100vh",
        border: "none",
      }}
    />
  );

  if (!isDesktop) {
    return (
      <main data-play-shell>
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          Playground
        </h1>
        {iframe}
        {/* task 4: controls sheet */}
      </main>
    );
  }

  return (
    <main data-play-shell className="play-shell-desktop">
      {iframe}
      <aside data-play-panel aria-label="Playground controls">
        <header>
          <h1>Playground</h1>
          <a href="./tune.html">Motion tuner</a>
          <p>Motion uses the package's dialled defaults.</p>
        </header>
        <Controls state={state} setState={setState} />
        <footer>
          <button type="button" onClick={() => copy("jsx")}>
            Copy JSX
          </button>
          <button type="button" onClick={() => copy("css")}>
            Copy CSS
          </button>
          <span role="status" data-play-copy-status>
            {copyStatus}
          </span>
        </footer>
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Shell />);
