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

// Strawman (v0.2): all recipe copy and glyphs below (list/grid/nav labels
// and icons, the media Wavelength copy, tile letters) are placeholder
// content invented for this playground, not sourced from any real product.

const LIST_RECIPE: Recipe = {
  id: "list",
  label: "List",
  triggerLabel: "Open quick actions",
  layout: { sheetMaxWidth: 360, sheetPadding: 12, sheetRadius: 32 },
  shared: {
    type: "div",
    props: [["className", "vs-list-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          {
            type: "path",
            props: [["d", "M4 7h16M4 12h16M4 17h16"]],
            children: [],
          },
        ],
      },
    ],
  },
  items: [
    [
      {
        type: "h2",
        props: [
          ["id", "vs-sheet-title"],
          ["className", "vs-list-title"],
        ],
        children: [{ text: "Quick actions" }],
      },
    ],
    ...["New note", "Share", "Archive", "Rename", "Delete"].map(
      (label): PlayNode[] => [
        {
          type: "button",
          props: [
            ["type", "button"],
            ["className", "vs-list-row"],
          ],
          children: [{ text: label }],
        },
      ],
    ),
  ],
  css: `.vs-list-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
}

.vs-list-icon svg {
  width: 44%;
  height: 44%;
  fill: none;
  stroke: var(--vista-sheet-accent);
  stroke-width: 2;
  stroke-linecap: round;
}

.vs-list-title {
  margin: 12px 12px 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vista-sheet-text);
}

.vs-list-row {
  width: 100%;
  display: block;
  text-align: left;
  padding: 14px 12px;
  border: none;
  background: transparent;
  color: var(--vista-sheet-text);
  font-size: 15px;
  border-radius: 10px;
  cursor: pointer;
}

.vs-list-row:hover {
  background: color-mix(in srgb, var(--vista-sheet-text) 5%, transparent);
}

.vs-list-row:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}`,
};

const GRID_TILE_ROWS: string[][] = [
  ["Notes", "Photos", "Music"],
  ["Maps", "Mail", "Files"],
  ["Clock", "Weather", "Settings"],
];

function gridTile(label: string): PlayNode {
  return {
    type: "button",
    props: [
      ["type", "button"],
      ["className", "vs-grid-tile"],
    ],
    children: [
      {
        type: "span",
        props: [
          ["className", "vs-grid-glyph"],
          ["aria-hidden", "true"],
        ],
        children: [{ text: label.charAt(0) }],
      },
      {
        type: "span",
        props: [["className", "vs-grid-label"]],
        children: [{ text: label }],
      },
    ],
  };
}

const GRID_RECIPE: Recipe = {
  id: "grid",
  label: "Grid",
  triggerLabel: "Open apps",
  layout: { sheetMaxWidth: 360, sheetPadding: 16, sheetRadius: 32 },
  shared: {
    type: "div",
    props: [["className", "vs-grid-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          { x: 4, y: 4 },
          { x: 13, y: 4 },
          { x: 4, y: 13 },
          { x: 13, y: 13 },
        ].map(({ x, y }): PlayNode => ({
          type: "rect",
          props: [
            ["x", x],
            ["y", y],
            ["width", 7],
            ["height", 7],
            ["rx", 1.5],
            ["fill", "currentColor"],
          ],
          children: [],
        })),
      },
    ],
  },
  items: [
    [
      {
        type: "h2",
        props: [
          ["id", "vs-sheet-title"],
          ["className", "vs-grid-title"],
        ],
        children: [{ text: "Apps" }],
      },
    ],
    ...GRID_TILE_ROWS.map((row): PlayNode[] => [
      {
        type: "div",
        props: [["className", "vs-grid-row"]],
        children: row.map(gridTile),
      },
    ]),
  ],
  css: `.vs-grid-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
  color: var(--vista-sheet-accent);
}

.vs-grid-icon svg {
  width: 44%;
  height: 44%;
}

.vs-grid-title {
  margin: 12px 4px 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vista-sheet-text);
}

.vs-grid-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.vs-grid-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 4px;
  border: none;
  background: transparent;
  border-radius: 12px;
  color: var(--vista-sheet-text);
  font-size: 12px;
  cursor: pointer;
}

.vs-grid-tile:hover {
  background: color-mix(in srgb, var(--vista-sheet-text) 5%, transparent);
}

.vs-grid-tile:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}

.vs-grid-glyph {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
  color: var(--vista-sheet-accent);
}`,
};

const NAV_LINKS: Array<{ label: string; href: string; current?: boolean }> = [
  { label: "Home", href: "#home", current: true },
  { label: "Work", href: "#work" },
  { label: "Writing", href: "#writing" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const NAV_RECIPE: Recipe = {
  id: "nav",
  label: "Nav",
  triggerLabel: "Open navigation",
  layout: { sheetMaxWidth: 320, sheetPadding: 12, sheetRadius: 32 },
  shared: {
    type: "div",
    props: [["className", "vs-nav-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          {
            type: "path",
            props: [["d", "M5 12h14M13 6l6 6-6 6"]],
            children: [],
          },
        ],
      },
    ],
  },
  items: [
    [
      {
        type: "h2",
        props: [
          ["id", "vs-sheet-title"],
          ["className", "vs-nav-title"],
        ],
        children: [{ text: "Navigate" }],
      },
    ],
    [
      {
        type: "nav",
        props: [
          ["className", "vs-nav"],
          ["aria-label", "Primary"],
        ],
        children: NAV_LINKS.map((link): PlayNode => ({
          type: "a",
          props: [
            ["className", "vs-nav-link"],
            ["href", link.href],
            ...(link.current
              ? ([["aria-current", "page"]] as Array<[string, string]>)
              : []),
          ],
          children: [{ text: link.label }],
        })),
      },
    ],
  ],
  css: `.vs-nav-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
}

.vs-nav-icon svg {
  width: 44%;
  height: 44%;
  fill: none;
  stroke: var(--vista-sheet-accent);
  stroke-width: 2;
  stroke-linecap: round;
}

.vs-nav-title {
  margin: 12px 12px 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vista-sheet-text);
}

.vs-nav {
  display: flex;
  flex-direction: column;
}

.vs-nav-link {
  padding: 12px;
  border-radius: 10px;
  font-size: 15px;
  color: var(--vista-sheet-text);
  text-decoration: none;
}

.vs-nav-link[aria-current="page"] {
  font-weight: 600;
  background: color-mix(in srgb, var(--vista-sheet-text) 6%, transparent);
}

.vs-nav-link:hover {
  background: color-mix(in srgb, var(--vista-sheet-text) 5%, transparent);
}

.vs-nav-link:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}`,
};

const MEDIA_META: Array<{ label: string; value: string }> = [
  { label: "Rating", value: "4.8 ★" },
  { label: "Reviews", value: "2.1k" },
  { label: "Category", value: "Music" },
  { label: "Age", value: "4+" },
];

const MEDIA_RECIPE: Recipe = {
  id: "media",
  label: "Media",
  triggerLabel: "Open Wavelength preview",
  layout: { sheetMaxWidth: 420, sheetPadding: 24, sheetRadius: 28 },
  shared: {
    type: "div",
    props: [["className", "vs-media-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          { type: "path", props: [["d", "M8 5v14l11-7z"]], children: [] },
        ],
      },
    ],
  },
  // Strawman (v0.2): the media-card page's presets.snappy is deliberately
  // NOT ported here — snappy is an un-dialled motion preset and the copy
  // tool never emits motion props (see DESIGN.md Motion Principles).
  items: [
    [
      {
        type: "div",
        props: [["className", "vs-media-header"]],
        children: [
          {
            type: "div",
            props: [],
            children: [
              {
                type: "h2",
                props: [
                  ["id", "vs-sheet-title"],
                  ["className", "vs-media-title"],
                ],
                children: [{ text: "Wavelength" }],
              },
              {
                type: "p",
                props: [["className", "vs-media-subtitle"]],
                children: [{ text: "Podcasts, tuned to you" }],
              },
            ],
          },
          {
            // Strawman (v0.2): GET is a plain '#' link — there is no
            // handler to serialise into the copy output.
            type: "a",
            props: [
              ["className", "vs-media-get"],
              ["href", "#"],
            ],
            children: [{ text: "GET" }],
          },
        ],
      },
    ],
    [
      {
        type: "dl",
        props: [["className", "vs-media-meta"]],
        children: MEDIA_META.map((stat): PlayNode => ({
          type: "div",
          props: [["className", "vs-media-meta-stat"]],
          children: [
            { type: "dt", props: [], children: [{ text: stat.label }] },
            { type: "dd", props: [], children: [{ text: stat.value }] },
          ],
        })),
      },
    ],
    [
      {
        type: "p",
        props: [["className", "vs-media-description"]],
        children: [
          {
            text: "Wavelength surfaces the five episodes you’d actually finish today, not the five hundred you saved. No feed to scroll, just a queue that ends.",
          },
        ],
      },
    ],
  ],
  css: `.vs-media-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--vista-sheet-accent) 70%, white) 0%,
    var(--vista-sheet-accent) 55%,
    color-mix(in srgb, var(--vista-sheet-accent) 70%, black) 100%
  );
}

.vs-media-icon svg {
  width: 42%;
  height: 42%;
  fill: #ffffff;
}

.vs-media-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
}

.vs-media-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: var(--vista-sheet-text);
}

.vs-media-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--vista-sheet-text);
  opacity: 0.6;
}

.vs-media-get {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  min-height: 32px;
  padding: 0 16px;
  border-radius: 9999px;
  background: var(--vista-sheet-accent);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-decoration: none;
}

.vs-media-get:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: 2px;
}

.vs-media-meta {
  display: flex;
  margin: 20px 0 0;
  padding: 16px 0;
  border-top: 1px solid var(--vista-sheet-surface-border);
  border-bottom: 1px solid var(--vista-sheet-surface-border);
}

.vs-media-meta-stat {
  flex: 1;
  text-align: center;
  border-right: 1px solid var(--vista-sheet-surface-border);
}

.vs-media-meta-stat:last-child {
  border-right: none;
}

.vs-media-meta-stat dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vista-sheet-text);
  opacity: 0.5;
  margin: 0 0 4px;
}

.vs-media-meta-stat dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--vista-sheet-text);
}

.vs-media-description {
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vista-sheet-text);
  opacity: 0.8;
}`,
};

export const RECIPES: Record<RecipeId, Recipe> = {
  basic: BASIC_RECIPE,
  list: LIST_RECIPE,
  grid: GRID_RECIPE,
  nav: NAV_RECIPE,
  media: MEDIA_RECIPE,
};

export function getRecipe(id: RecipeId): Recipe {
  return RECIPES[id];
}
