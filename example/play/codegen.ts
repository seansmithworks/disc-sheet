import type { PlayState } from "./state";
import { PACKAGE_DEFAULTS } from "./state";
import { getRecipe, type PlayNode } from "./recipes";

type PropValue = string | number | boolean;
type ElementNode = Extract<PlayNode, { type: string }>;

function isText(node: PlayNode): node is { text: string } {
  return "text" in node;
}

/**
 * Builds the same PlayNode tree the stage renders (one codegen model drives
 * both sides — see the copy-tool spec's "structurally impossible" drift
 * strawman). Root props omit every value equal to the package default so
 * the copied JSX reads as a minimal diff from `<VistaSheet.Root>`.
 */
export function buildSpecimenTree(state: PlayState): PlayNode {
  const recipe = getRecipe(state.recipe);

  const rootProps: Array<[string, PropValue]> = [["className", "vs-theme"]];
  if (state.shape !== "circle") rootProps.push(["shape", state.shape]);
  if (state.anchor !== "bottom-center") {
    rootProps.push(["defaultAnchor", state.anchor]);
  }
  if (state.triggerSize !== "responsive") {
    rootProps.push(["triggerSize", state.triggerSize]);
  }
  if (state.sheetMaxWidth !== 480) {
    rootProps.push(["sheetMaxWidth", state.sheetMaxWidth]);
  }
  if (state.draggable === false) rootProps.push(["draggable", false]);

  const slotNode = (): PlayNode => {
    if (recipe.media) {
      const m = recipe.media;
      return {
        type: "VistaSheet.Media",
        props: [
          ["src", m.src],
          ["poster", m.poster],
          ["aspectRatio", m.aspectRatio],
        ],
        children: [],
      };
    }
    return {
      type: "VistaSheet.Shared",
      props: [],
      children: [recipe.shared],
    };
  };

  const children: PlayNode[] = [];
  if (state.shadow) {
    children.push({ type: "VistaSheet.Shadow", props: [], children: [] });
  }

  children.push({
    type: "VistaSheet.Trigger",
    props: [["aria-label", recipe.triggerLabel]],
    children: [slotNode()],
  });

  const sheetProps: Array<[string, PropValue]> = recipe.sheetLabel
    ? [["aria-label", recipe.sheetLabel]]
    : [["aria-labelledby", "vs-sheet-title"]];
  if (recipe.media) sheetProps.push(["aspectRatio", recipe.media.aspectRatio]);
  if (!state.dismissOnSwipe) sheetProps.push(["dismissOnSwipe", false]);
  if (!state.dismissOnBackdrop) sheetProps.push(["dismissOnBackdrop", false]);

  const itemNodes: PlayNode[] = recipe.items.map((itemChildren) => ({
    type: "VistaSheet.Item",
    props: [],
    children: itemChildren,
  }));

  children.push({
    type: "VistaSheet.Sheet",
    props: sheetProps,
    children: [
      slotNode(),
      {
        type: "VistaSheet.Close",
        props: [["aria-label", "Close"]],
        children: [],
      },
      ...(recipe.items.length > 0
        ? [
            {
              type: "VistaSheet.Content",
              props: [],
              children: itemNodes,
            } as PlayNode,
          ]
        : []),
    ],
  });

  return { type: "VistaSheet.Root", props: rootProps, children };
}

function formatPropValue(value: PropValue): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return `{${value}}`;
  }
  if (/["\\]/.test(value)) return `{${JSON.stringify(value)}}`;
  return `"${value}"`;
}

function formatPropPair([name, value]: [string, PropValue]): string {
  return `${name}=${formatPropValue(value)}`;
}

function renderText(raw: string): string {
  const needsExpr = /[{}<>]/.test(raw) || /^\s|\s$/.test(raw);
  return needsExpr ? `{${JSON.stringify(raw)}}` : raw;
}

function buildOpeningTagInline(
  tag: string,
  props: Array<[string, PropValue]>,
  selfClose: boolean,
): string {
  const propsStr = props.map((p) => ` ${formatPropPair(p)}`).join("");
  return `<${tag}${propsStr}${selfClose ? " />" : ">"}`;
}

function printNode(node: PlayNode, indent: number): string[] {
  if (isText(node)) return [`${" ".repeat(indent)}${renderText(node.text)}`];
  return printElement(node, indent);
}

function printElement(node: ElementNode, indent: number): string[] {
  const { type: tag, props, children } = node;
  const selfClose = children.length === 0;
  const inlineOpen = buildOpeningTagInline(tag, props, selfClose);
  const fitsInline = indent + inlineOpen.length <= 80;

  let openLines: string[];
  if (fitsInline) {
    openLines = [`${" ".repeat(indent)}${inlineOpen}`];
  } else {
    const lines = [`${" ".repeat(indent)}<${tag}`];
    for (const prop of props) {
      lines.push(`${" ".repeat(indent + 2)}${formatPropPair(prop)}`);
    }
    lines.push(`${" ".repeat(indent)}${selfClose ? "/>" : ">"}`);
    openLines = lines;
  }

  if (selfClose) return openLines;

  if (children.length === 1 && isText(children[0])) {
    const textStr = renderText((children[0] as { text: string }).text);
    if (openLines.length === 1) {
      const candidate = `${openLines[0]}${textStr}</${tag}>`;
      if (candidate.length <= 80) return [candidate];
    }
    return [
      ...openLines,
      `${" ".repeat(indent + 2)}${textStr}`,
      `${" ".repeat(indent)}</${tag}>`,
    ];
  }

  const lines = [...openLines];
  for (const child of children) lines.push(...printNode(child, indent + 2));
  lines.push(`${" ".repeat(indent)}</${tag}>`);
  return lines;
}

/**
 * Serialises `state` into the same JSX a consumer would paste into their own
 * file — real Unicode, never HTML entities; defaults omitted (Strawman
 * (v0.2)); component name fixed to VistaSheetExample (Strawman (v0.2)); a
 * CSS-comment pointer replaces a CSS import (Strawman (v0.2)), since the
 * playground has no bundler-relative path to hand a consumer.
 */
export function printJsxFile(state: PlayState): string {
  const tree = buildSpecimenTree(state);
  const body = printNode(tree, 4).join("\n");

  return [
    '"use client";',
    "",
    'import { VistaSheet } from "@seansmithworks/vista-sheet";',
    "// Styles: paste the CSS output into your global stylesheet.",
    "",
    "export default function VistaSheetExample() {",
    "  return (",
    body,
    "  );",
    "}",
    "",
  ].join("\n");
}

/**
 * The stage's remount key. JSX-affecting controls remount the specimen
 * closed; a drag re-anchor must not, so `anchor` is pinned to the package
 * default before printing — every anchor produces the same key.
 */
export function jsxKey(state: PlayState): string {
  return printJsxFile({ ...state, anchor: "bottom-center" });
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

// Hard rule (DESIGN.md §4.1 single painter; Motion owns transforms, per
// ORCHESTRATOR.md "Fragile areas"): neither BASE_CSS nor any recipe's css
// may declare box-shadow, filter or transform — those are the package's own
// single-painter Shadow layer and Motion's job respectively, never a
// consumer override. transition/preset/snappy/gentle never appear either
// (the un-dialled motion presets stay out of the copy tool).
const BASE_CSS = `.vs-theme [data-vista-sheet-part="close"] {
  position: absolute;
  top: 16px;
  right: 16px;
}

.vs-theme [data-vista-sheet-part="item"] {
  padding-top: 16px;
}

.vs-theme [data-vista-sheet-part="item"]:first-of-type {
  padding-top: 24px;
}

.vs-theme [data-vista-sheet-part="content"] h2 {
  font-size: 20px;
  line-height: 1.3;
  margin: 0;
}

.vs-theme [data-vista-sheet-part="item"]:has(h2) + [data-vista-sheet-part="item"] {
  padding-top: 8px;
}

.vs-theme [data-vista-sheet-part="content"] p {
  margin: 0;
  line-height: 1.5;
  color: color-mix(in srgb, var(--vista-sheet-text) 72%, transparent);
}`;

/**
 * Builds the CSS pane: a `.vs-theme` var-override block (only values that
 * differ from the README theming-table defaults; omitted entirely when
 * nothing differs — Strawman (v0.2): the default Warm palette equals those
 * defaults, so the first copy has no var block at all), the always-present
 * base content styling ported from example.css, then the active recipe's
 * own css.
 */
export function buildCss(state: PlayState): string {
  const recipe = getRecipe(state.recipe);
  const varLines: string[] = [];

  const pushIfChanged = (name: string, current: string, def: string) => {
    if (norm(current) !== norm(def)) {
      varLines.push(`  --vista-sheet-${name}: ${current};`);
    }
  };

  pushIfChanged("surface", state.surface, PACKAGE_DEFAULTS.surface);
  pushIfChanged(
    "surface-elevated",
    state.surfaceElevated,
    PACKAGE_DEFAULTS.surfaceElevated,
  );
  pushIfChanged("surface-border", state.border, PACKAGE_DEFAULTS.border);
  pushIfChanged("text", state.text, PACKAGE_DEFAULTS.text);
  pushIfChanged("accent", state.accent, PACKAGE_DEFAULTS.accent);
  if (state.sheetRadius !== 32) {
    varLines.push(`  --vista-sheet-sheet-radius: ${state.sheetRadius}px;`);
  }
  if (state.sheetPadding !== 24) {
    varLines.push(`  --vista-sheet-sheet-padding: ${state.sheetPadding}px;`);
  }
  pushIfChanged("shadow", state.triggerShadow, PACKAGE_DEFAULTS.triggerShadow);
  pushIfChanged(
    "sheet-shadow",
    state.sheetShadow,
    PACKAGE_DEFAULTS.sheetShadow,
  );

  const blocks: string[] = [];
  if (varLines.length > 0) {
    blocks.push(`.vs-theme {\n${varLines.join("\n")}\n}`);
  }
  blocks.push(BASE_CSS);
  blocks.push(recipe.css);

  return `${blocks.join("\n\n")}\n`;
}
