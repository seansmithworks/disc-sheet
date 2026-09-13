import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AnchorId } from "../../src/index";
import { isPlayMessage } from "./messages";
import { renderPlayTree } from "./render";
import { buildCss, buildSpecimenTree, jsxKey } from "./codegen";
import { groundFor, type PlayState } from "./state";
import "./stage.css";

function Stage() {
  const [state, setState] = useState<PlayState | null>(null);
  const [epoch, setEpoch] = useState(0);
  const liveAnchorRef = useRef<AnchorId | null>(null);

  useEffect(() => {
    window.parent.postMessage({ type: "vista-sheet-play:ready" }, "*");

    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent || e.origin !== location.origin) return;
      if (!isPlayMessage(e.data) || e.data.type !== "vista-sheet-play:state") {
        return;
      }
      const next = e.data.state;
      if (liveAnchorRef.current === null) liveAnchorRef.current = next.anchor;
      // Remount rule (Strawman (v0.2)): a state.anchor that differs from the
      // anchor the specimen is actually sitting at means a *control* moved
      // the anchor, so it remounts at the new defaultAnchor. A drag re-anchor
      // updates liveAnchorRef itself first (see onAnchorChange below), so the
      // very same incoming anchor never trips this branch.
      if (next.anchor !== liveAnchorRef.current) {
        liveAnchorRef.current = next.anchor;
        setEpoch((e) => e + 1);
      }
      setState(next);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (state) document.body.style.background = groundFor(state);
  }, [state]);

  if (!state) return null;

  function onAnchorChange(anchor: AnchorId) {
    liveAnchorRef.current = anchor;
    window.parent.postMessage(
      { type: "vista-sheet-play:anchor", anchor },
      location.origin,
    );
  }

  return (
    <>
      {/* Rendered as a React text child so textContent equals the CSS pane
          byte for byte — the WYSIWYG equality the copy tool's tests assert. */}
      <style data-play-css>{buildCss(state)}</style>
      {renderPlayTree(buildSpecimenTree(state), {
        key: `${epoch}:${jsxKey(state)}`,
        id: "specimen",
        // Strawman (v0.2), renderer-only, never emitted by the printer: keeps
        // the playground's specimen out of the geometry page's own
        // 'vista-sheet-anchor' localStorage key.
        persistKey: false,
        onAnchorChange,
      })}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Stage />);
