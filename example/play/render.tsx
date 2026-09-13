import { createElement, type ReactNode } from "react";
import { VistaSheet } from "../../src/index";
import type { PlayNode } from "./recipes";

type PropValue = string | number | boolean;
type RootOverrides = Record<string, unknown>;

function isText(node: PlayNode): node is { text: string } {
  return "text" in node;
}

function resolveComponent(type: string): unknown {
  const prefix = "VistaSheet.";
  if (type.startsWith(prefix)) {
    const name = type.slice(prefix.length) as keyof typeof VistaSheet;
    return VistaSheet[name];
  }
  return type;
}

function propsToObject(
  props: Array<[string, PropValue]>,
): Record<string, PropValue> {
  const obj: Record<string, PropValue> = {};
  for (const [name, value] of props) obj[name] = value;
  return obj;
}

/**
 * Renders the same `PlayNode` tree the codegen printer serialises to JSX —
 * one model drives both the specimen and the copy output (Strawman (v0.2)),
 * so drift between what's shown and what's copied is structurally
 * impossible. `rootOverrides` merge onto the outermost `VistaSheet.Root`
 * only (the playground's own render-time wiring — id, persistKey,
 * onAnchorChange — which the printer never emits).
 */
export function renderPlayTree(
  node: PlayNode,
  rootOverrides: RootOverrides = {},
): ReactNode {
  return renderNode(node, rootOverrides, true, 0);
}

function renderNode(
  node: PlayNode,
  rootOverrides: RootOverrides,
  isRoot: boolean,
  index: number,
): ReactNode {
  if (isText(node)) return node.text;

  const component = resolveComponent(node.type);
  const props: Record<string, unknown> = propsToObject(node.props);
  if (isRoot) Object.assign(props, rootOverrides);

  const children = node.children.map((child, i) =>
    renderNode(child, rootOverrides, false, i),
  );

  return createElement(
    component as never,
    { key: index, ...props },
    ...children,
  );
}
