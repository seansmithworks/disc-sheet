import { describe, expect, it, vi } from "vitest";
import { mergeShadowRef } from "./Shadow";

/**
 * F1 regression: <VistaSheet.Shadow asChild> used to hard-code its clone's
 * `ref`, silently dropping whatever ref the consumer already put on the
 * child (docs/PACKAGE-DESIGN.md §4, "asChild ... merges ... onto it" — a
 * ref is part of that merge). mergeShadowRef is the composition Shadow.tsx's
 * asChild branch delegates to; these tests exercise it directly rather than
 * through a full render, since the repo has no DOM test environment
 * (jsdom/happy-dom) wired up and adding one is out of this task's scope.
 */
describe("mergeShadowRef", () => {
  it("forwards the node to a consumer object ref", () => {
    const internal = vi.fn();
    const objectRef = { current: null as HTMLElement | null };
    const node = {} as HTMLElement;

    mergeShadowRef(objectRef, internal)(node);

    expect(objectRef.current).toBe(node);
    expect(internal).toHaveBeenCalledWith(node);
  });

  it("forwards the node to a consumer callback ref", () => {
    const internal = vi.fn();
    const callbackRef = vi.fn();
    const node = {} as HTMLElement;

    mergeShadowRef(callbackRef, internal)(node);

    expect(callbackRef).toHaveBeenCalledWith(node);
    expect(internal).toHaveBeenCalledWith(node);
  });

  it("still calls only the internal ref when the child has none", () => {
    const internal = vi.fn();
    const node = {} as HTMLElement;

    mergeShadowRef(undefined, internal)(node);

    expect(internal).toHaveBeenCalledWith(node);
  });

  it("forwards null on unmount to both refs", () => {
    const internal = vi.fn();
    const objectRef = { current: {} as HTMLElement | null };

    mergeShadowRef(objectRef, internal)(null);

    expect(objectRef.current).toBeNull();
    expect(internal).toHaveBeenCalledWith(null);
  });
});
