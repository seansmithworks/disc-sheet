export type PlayNode =
  | { text: string }
  | {
      type: string;
      props: Array<[string, string | number | boolean]>;
      children: PlayNode[];
    };

export type RecipeId = "basic" | "list" | "grid" | "nav" | "media";

export interface Recipe {
  id: RecipeId;
  label: string;
  triggerLabel: string;
  layout: {
    sheetMaxWidth: 320 | 360 | 420 | 480 | 560 | 640;
    sheetPadding: number;
    sheetRadius: number;
  };
  /** Placed in BOTH Shared slots (trigger- and sheet-side). */
  shared: PlayNode;
  /** One array of children per VistaSheet.Item. */
  items: PlayNode[][];
  css: string;
}

const BASIC_RECIPE: Recipe = {
  id: "basic",
  label: "Basic",
  triggerLabel: "Open sheet",
  layout: { sheetMaxWidth: 480, sheetPadding: 24, sheetRadius: 32 },
  shared: {
    type: "div",
    props: [["className", "vs-basic-art"]],
    children: [],
  },
  items: [
    [
      {
        type: "h2",
        props: [["id", "vs-sheet-title"]],
        children: [{ text: "Sheet title" }],
      },
    ],
    [
      {
        type: "p",
        props: [],
        children: [
          {
            text: "Everything inside the sheet is yours: plain JSX, styled with the CSS beside it.",
          },
        ],
      },
    ],
  ],
  css: ".vs-basic-art { width: 100%; height: 100%; background: var(--vista-sheet-accent); }",
};

// Strawman (v0.2): list/grid/nav/media ship in a later P1 task (task 5).
// RECIPES is a Partial record until then; getRecipe() falls back to basic
// so callers written against the full RecipeId union (applyRecipe in
// state.ts, buildSpecimenTree in codegen.ts) never see an undefined recipe
// mid-build-out.
export const RECIPES: Partial<Record<RecipeId, Recipe>> = {
  basic: BASIC_RECIPE,
};

export function getRecipe(id: RecipeId): Recipe {
  return RECIPES[id] ?? BASIC_RECIPE;
}
