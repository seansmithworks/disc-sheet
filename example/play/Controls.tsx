import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import {
  ANCHORS,
  applyPalette,
  applyRecipe,
  matchPalette,
  PALETTES,
  SHAPES,
  type ButtonContent,
  type ButtonWidthOption,
  type PaletteId,
  type PlayState,
  type SheetMaxWidth,
  type TriggerSize,
} from "./state";
import { buildCss, printJsxFile } from "./codegen";
import { getRecipe, type RecipeId } from "./recipes";
import type { AnchorId, ButtonSize } from "../../src/index";

interface ControlsProps {
  state: PlayState;
  setState: (updater: (state: PlayState) => PlayState) => void;
  // A user command, distinct from setState: only the Anchor dropdown calls
  // this, so the shell can tell the stage to move the specimen without
  // confusing that command with the stage's own drag reports.
  onAnchorCommand: (anchor: AnchorId) => void;
}

const RECIPE_OPTIONS: Array<{ id: RecipeId; label: string }> = [
  { id: "basic", label: "Basic" },
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
  { id: "nav", label: "Nav" },
  { id: "media", label: "Media" },
  { id: "video", label: "Video" },
  { id: "search", label: "Search" },
  { id: "chat", label: "Chat" },
];

const BUTTON_SIZES: Array<{ id: ButtonSize; label: string }> = [
  { id: "s", label: "S" },
  { id: "m", label: "M" },
  { id: "l", label: "L" },
];

const BUTTON_CONTENTS: Array<{ id: ButtonContent; label: string }> = [
  { id: "icon", label: "Icon" },
  { id: "icon-text", label: "Icon and text" },
  { id: "text", label: "Text" },
];

const BUTTON_WIDTHS: Array<{ id: ButtonWidthOption; label: string }> = [
  { id: "label", label: "Label" },
  { id: 200, label: "200px" },
  { id: 240, label: "240px" },
  { id: 280, label: "280px" },
  { id: 320, label: "320px" },
];

const TRIGGER_SIZES: TriggerSize[] = ["responsive", 56, 72, 96, 128, 160];

const SHEET_MAX_WIDTHS: SheetMaxWidth[] = [320, 360, 420, 480, 560, 640];

function labelForAnchor(id: string): string {
  return id
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

interface ColorRowProps {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
}

function ColorRow({ id, label, value, onCommit }: ColorRowProps) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);

  // Keep the field in sync when a palette preset applies this token from
  // outside the input (a typed-but-invalid draft is left alone).
  useEffect(() => {
    if (!invalid) setDraft(value);
  }, [value, invalid]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setDraft(next);
    if (CSS.supports("color", next)) {
      setInvalid(false);
      onCommit(next);
    } else {
      setInvalid(true);
    }
  }

  const shown = invalid ? draft : value;

  return (
    <div data-play-row>
      <label htmlFor={id}>{label}</label>
      <span data-play-swatch style={{ background: value }} />
      <input
        id={id}
        type="text"
        value={shown}
        aria-invalid={invalid}
        onChange={handleChange}
      />
    </div>
  );
}

/**
 * Strawman (v0.2): every JSX-affecting control here is discrete (a select, a
 * radio, or a checkbox) — never a text field or a live-typed range — so
 * dragging a range control (sheet radius, sheet padding) only ever changes
 * CSS-var values. The specimen never remounts from any control here: the
 * stage renders it under a constant key, so every control — JSX-affecting
 * or not — patches the live tree in place.
 *
 * Motion has no control at all here: no preset, transition or spring input.
 * `snappy`/`gentle` are un-dialled and stay out of the copy tool; the tuner
 * is linked from the shell, never duplicated.
 */
export function Controls({ state, setState, onAnchorCommand }: ControlsProps) {
  const palette = matchPalette(state);
  const isButtonRecipe = getRecipe(state.recipe).button !== undefined;

  return (
    <>
      <section>
        <h3>Recipe</h3>
        <div data-play-row>
          <label htmlFor="play-recipe">Recipe</label>
          <select
            id="play-recipe"
            value={state.recipe}
            onChange={(e) =>
              setState((s) => applyRecipe(s, e.target.value as RecipeId))
            }
          >
            {RECIPE_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <h3>Shape</h3>
        <fieldset>
          <legend>Shape</legend>
          {SHAPES.map((shape) => (
            <label key={shape.id} data-play-radio>
              <input
                type="radio"
                name="play-shape"
                value={shape.id}
                checked={state.shape === shape.id}
                disabled={shape.id === "rectangle" && !isButtonRecipe}
                onChange={() => setState((s) => ({ ...s, shape: shape.id }))}
              />
              {shape.label}
            </label>
          ))}
        </fieldset>
      </section>

      {state.shape === "rectangle" && (
        <section>
          <h3>Button</h3>
          <div data-play-row>
            <label htmlFor="play-button-size">Button size</label>
            <select
              id="play-button-size"
              value={state.buttonSize}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  buttonSize: e.target.value as ButtonSize,
                }))
              }
            >
              {BUTTON_SIZES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div data-play-row>
            <label htmlFor="play-button-content">Button content</label>
            <select
              id="play-button-content"
              value={state.buttonContent}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  buttonContent: e.target.value as ButtonContent,
                }))
              }
            >
              {BUTTON_CONTENTS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div data-play-row>
            <label htmlFor="play-button-width">Button width</label>
            <select
              id="play-button-width"
              value={String(state.buttonWidth)}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  buttonWidth: (e.target.value === "label"
                    ? "label"
                    : Number(e.target.value)) as ButtonWidthOption,
                }))
              }
            >
              {BUTTON_WIDTHS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      <section>
        <h3>Trigger</h3>
        <div data-play-row>
          <label htmlFor="play-anchor">Anchor</label>
          <select
            id="play-anchor"
            value={state.anchor}
            onChange={(e) =>
              onAnchorCommand(e.target.value as PlayState["anchor"])
            }
          >
            {ANCHORS.map((a) => (
              <option key={a} value={a}>
                {labelForAnchor(a)}
              </option>
            ))}
          </select>
        </div>
        <div data-play-row>
          <label htmlFor="play-trigger-size">Trigger size</label>
          <select
            id="play-trigger-size"
            value={String(state.triggerSize)}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                triggerSize: (e.target.value === "responsive"
                  ? "responsive"
                  : Number(e.target.value)) as TriggerSize,
              }))
            }
          >
            <option value="responsive">Responsive</option>
            {TRIGGER_SIZES.filter((v) => v !== "responsive").map((v) => (
              <option key={v} value={v}>
                {v}px
              </option>
            ))}
          </select>
        </div>
        <div data-play-row>
          <label htmlFor="play-draggable">Draggable</label>
          <input
            id="play-draggable"
            type="checkbox"
            checked={state.draggable}
            onChange={(e) =>
              setState((s) => ({ ...s, draggable: e.target.checked }))
            }
          />
        </div>
        <div data-play-row>
          <label htmlFor="play-shadow">Shadow</label>
          <input
            id="play-shadow"
            type="checkbox"
            checked={state.shadow}
            onChange={(e) =>
              setState((s) => ({ ...s, shadow: e.target.checked }))
            }
          />
        </div>
      </section>

      <section>
        <h3>Sheet</h3>
        <div data-play-row>
          <label htmlFor="play-sheet-max-width">Sheet max width</label>
          <select
            id="play-sheet-max-width"
            value={state.sheetMaxWidth}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                sheetMaxWidth: Number(e.target.value) as SheetMaxWidth,
              }))
            }
          >
            {SHEET_MAX_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </div>
        <div data-play-row>
          <label htmlFor="play-sheet-radius">Sheet radius</label>
          <input
            id="play-sheet-radius"
            type="range"
            min={0}
            max={64}
            step={1}
            value={state.sheetRadius}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                sheetRadius: Number(e.target.value),
              }))
            }
          />
          <span>{state.sheetRadius}px</span>
        </div>
        <div data-play-row>
          <label htmlFor="play-sheet-padding">Sheet padding</label>
          <input
            id="play-sheet-padding"
            type="range"
            min={0}
            max={48}
            step={1}
            value={state.sheetPadding}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                sheetPadding: Number(e.target.value),
              }))
            }
          />
          <span>{state.sheetPadding}px</span>
        </div>
        <div data-play-row>
          <label htmlFor="play-dismiss-swipe">Dismiss on swipe</label>
          <input
            id="play-dismiss-swipe"
            type="checkbox"
            checked={state.dismissOnSwipe}
            onChange={(e) =>
              setState((s) => ({ ...s, dismissOnSwipe: e.target.checked }))
            }
          />
        </div>
        <div data-play-row>
          <label htmlFor="play-dismiss-backdrop">Dismiss on backdrop</label>
          <input
            id="play-dismiss-backdrop"
            type="checkbox"
            checked={state.dismissOnBackdrop}
            onChange={(e) =>
              setState((s) => ({ ...s, dismissOnBackdrop: e.target.checked }))
            }
          />
        </div>
      </section>

      <section>
        <h3>Colour</h3>
        <div data-play-row>
          <label htmlFor="play-palette">Palette</label>
          <select
            id="play-palette"
            value={palette}
            onChange={(e) =>
              setState((s) => applyPalette(s, e.target.value as PaletteId))
            }
          >
            {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
              <option key={id} value={id}>
                {PALETTES[id].label}
              </option>
            ))}
            <option value="custom" disabled>
              Custom
            </option>
          </select>
        </div>

        <ColorRow
          id="play-surface"
          label="Surface"
          value={state.surface}
          onCommit={(v) => setState((s) => ({ ...s, surface: v }))}
        />
        <ColorRow
          id="play-surface-elevated"
          label="Surface elevated"
          value={state.surfaceElevated}
          onCommit={(v) => setState((s) => ({ ...s, surfaceElevated: v }))}
        />
        <ColorRow
          id="play-border"
          label="Border"
          value={state.border}
          onCommit={(v) => setState((s) => ({ ...s, border: v }))}
        />
        <ColorRow
          id="play-text"
          label="Text"
          value={state.text}
          onCommit={(v) => setState((s) => ({ ...s, text: v }))}
        />
        <ColorRow
          id="play-accent"
          label="Accent"
          value={state.accent}
          onCommit={(v) => setState((s) => ({ ...s, accent: v }))}
        />

        <div data-play-row>
          <label htmlFor="play-trigger-shadow">Shadow (trigger)</label>
          <input
            id="play-trigger-shadow"
            type="text"
            value={state.triggerShadow}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length > 0) {
                setState((s) => ({ ...s, triggerShadow: v }));
              }
            }}
          />
        </div>
        <div data-play-row>
          <label htmlFor="play-sheet-shadow">Shadow (sheet)</label>
          <input
            id="play-sheet-shadow"
            type="text"
            value={state.sheetShadow}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length > 0) {
                setState((s) => ({ ...s, sheetShadow: v }));
              }
            }}
          />
        </div>
      </section>

      <section>
        <h3>JSX</h3>
        <pre data-play-output="jsx">{printJsxFile(state)}</pre>
        <h3>CSS</h3>
        <pre data-play-output="css">{buildCss(state)}</pre>
      </section>
    </>
  );
}
