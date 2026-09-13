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
 * onAnchorChange — which the printer never emits). `rendererChildren` are
 * appended after the root's codegen children (e.g. `AnchorSync`) — a
 * renderer-only slot the copy printer never sees.
 */
export function renderPlayTree(
  node: PlayNode,
  rootOverrides: RootOverrides = {},
  rendererChildren: ReactNode[] = [],
): ReactNode {
  return renderNode(node, rootOverrides, true, "root", rendererChildren);
}

/**
 * Children are keyed by element type + ordinal among siblings of that type
 * (not raw index): inserting or removing a sibling of a different type (the
 * Shadow toggle, a recipe's optional slot node) must not shift every later
 * sibling's key, or React remounts them along with it.
 */
function renderNode(
  node: PlayNode,
  rootOverrides: RootOverrides,
  isRoot: boolean,
  key: string,
  rendererChildren: ReactNode[],
): ReactNode {
  if (isText(node)) return node.text;

  const component = resolveComponent(node.type);
  const props: Record<string, unknown> = propsToObject(node.props);
  if (isRoot) Object.assign(props, rootOverrides);

  const seen = new Map<string, number>();
  const children = node.children.map((child) => {
    const kind = isText(child) ? "text" : child.type;
    const ordinal = seen.get(kind) ?? 0;
    seen.set(kind, ordinal + 1);
    return renderNode(child, rootOverrides, false, `${kind}:${ordinal}`, []);
  });
  if (isRoot) children.push(...rendererChildren);

  return createElement(component as never, { key, ...props }, ...children);
}
