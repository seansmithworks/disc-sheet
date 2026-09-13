import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AnchorId } from "../../src/index";
import { useVistaSheetInternal } from "../../src/context";
import { isPlayMessage } from "./messages";
import { renderPlayTree } from "./render";
import { buildCss, buildSpecimenTree } from "./codegen";
import { groundFor, type PlayState } from "./state";
import "./stage.css";

/**
 * Renderer-only, never printed by codegen: applies a control-driven anchor
 * change to the live specimen via the package's own internal `setAnchor`.
 * `usePersistedAnchor` only reads `defaultAnchor` at mount, so this is the
 * one anchor update the specimen key removal (below) doesn't cover for
 * free. Applied only while the sheet is closed — Sean accepted a jump
 * (no glide) for a control-driven change, unlike a live drag re-anchor.
 */
function AnchorSync({ anchor }: { anchor: AnchorId }) {
  const { open, anchor: liveAnchor, setAnchor } = useVistaSheetInternal("Root");
  useEffect(() => {
    if (!open && liveAnchor !== anchor) setAnchor(anchor);
  }, [anchor, open, liveAnchor, setAnchor]);
  return null;
}

function Stage() {
  const [state, setState] = useState<PlayState | null>(null);

  useEffect(() => {
    window.parent.postMessage({ type: "vista-sheet-play:ready" }, "*");

    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent || e.origin !== location.origin) return;
      if (!isPlayMessage(e.data) || e.data.type !== "vista-sheet-play:state") {
        return;
      }
      setState(e.data.state);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (state) document.body.style.background = groundFor(state);
  }, [state]);

  if (!state) return null;

  function onAnchorChange(anchor: AnchorId) {
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
      {renderPlayTree(
        buildSpecimenTree(state),
        {
          key: "specimen",
          id: "specimen",
          // Strawman (v0.2), renderer-only, never emitted by the printer: keeps
          // the playground's specimen out of the geometry page's own
          // 'vista-sheet-anchor' localStorage key.
          persistKey: false,
          onAnchorChange,
        },
        [<AnchorSync key="renderer:anchor-sync" anchor={state.anchor} />],
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Stage />);
