import { expect, test, type Page } from "@playwright/test";

/**
 * Contract spec for example/play.html — the P1 playground page. Written
 * before the page exists (P1 task 1 of 6, tests-only): every test here is
 * expected to fail against the current tree until a later P1 task builds
 * example/play/main.tsx, registers it in example/vite.config.ts, and wires
 * up the panel/sheet + controls + copy tool described below.
 *
 * Vite's SPA fallback serves index.html (200) for a missing /play.html, so
 * gotoPlay() never trusts HTTP status alone — it asserts on
 * [data-play-shell], which only the real page renders.
 */

async function gotoPlay(page: Page) {
  await page.goto("/play.html");
  await expect(page.locator("[data-play-shell]")).toBeVisible();
  const frame = page.frameLocator("iframe[data-play-stage]");
  await expect(
    frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
    ),
  ).toBeVisible();
  return frame;
}

test.describe("1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("play-ui: desktop loads with a docked panel beside the specimen", async ({
    page,
  }) => {
    await gotoPlay(page);

    const panel = page.locator("[data-play-panel]");
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    const iframeBox = await page
      .locator("iframe[data-play-stage]")
      .boundingBox();
    expect(panelBox).not.toBeNull();
    expect(iframeBox).not.toBeNull();
    if (!panelBox || !iframeBox) return;

    expect(panelBox.width).toBeGreaterThanOrEqual(359);
    expect(panelBox.width).toBeLessThanOrEqual(361);

    expect(iframeBox.x + iframeBox.width).toBeLessThanOrEqual(panelBox.x + 0.5);

    expect(iframeBox.width + panelBox.width).toBeGreaterThanOrEqual(1439);
    expect(iframeBox.width + panelBox.width).toBeLessThanOrEqual(1441);
  });

  test("play-ui: desktop controls never cover the specimen", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const panel = page.locator("[data-play-panel]");
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    if (!panelBox) return;

    const anchorSelect = page.getByLabel("Anchor", { exact: true });

    for (const anchor of ["top-right", "bottom-right"]) {
      await anchorSelect.selectOption(anchor);

      const iframeBox = await page
        .locator("iframe[data-play-stage]")
        .boundingBox();
      expect(iframeBox).not.toBeNull();
      if (!iframeBox) continue;

      await expect
        .poll(async () => {
          const trig = await frame
            .locator(
              '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
            )
            .boundingBox();
          if (!trig) return false;
          const mainBox = {
            x: iframeBox.x + trig.x,
            y: iframeBox.y + trig.y,
            width: trig.width,
            height: trig.height,
          };
          const insideIframe =
            mainBox.x >= iframeBox.x - 0.5 &&
            mainBox.y >= iframeBox.y - 0.5 &&
            mainBox.x + mainBox.width <= iframeBox.x + iframeBox.width + 0.5 &&
            mainBox.y + mainBox.height <= iframeBox.y + iframeBox.height + 0.5;
          const intersectsPanel = !(
            mainBox.x + mainBox.width <= panelBox.x ||
            mainBox.x >= panelBox.x + panelBox.width ||
            mainBox.y + mainBox.height <= panelBox.y ||
            mainBox.y >= panelBox.y + panelBox.height
          );
          return insideIframe && !intersectsPanel;
        })
        .toBe(true);

      const trigger = frame.locator(
        '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
      );
      await trigger.click();

      const sheet = frame.locator(
        '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="sheet"]',
      );
      await expect(sheet).toBeVisible();

      let previousWidth = -1;
      await expect
        .poll(async () => {
          const box = await sheet.boundingBox();
          const w = box?.width ?? -1;
          const stable = Math.abs(w - previousWidth) < 0.2;
          previousWidth = w;
          return stable;
        })
        .toBe(true);

      const sheetBox = await sheet.boundingBox();
      expect(sheetBox).not.toBeNull();
      if (sheetBox) {
        const mainSheetBox = {
          x: iframeBox.x + sheetBox.x,
          y: iframeBox.y + sheetBox.y,
          width: sheetBox.width,
          height: sheetBox.height,
        };
        expect(mainSheetBox.x).toBeGreaterThanOrEqual(iframeBox.x - 0.5);
        expect(mainSheetBox.y).toBeGreaterThanOrEqual(iframeBox.y - 0.5);
        expect(mainSheetBox.x + mainSheetBox.width).toBeLessThanOrEqual(
          iframeBox.x + iframeBox.width + 0.5,
        );
        expect(mainSheetBox.y + mainSheetBox.height).toBeLessThanOrEqual(
          iframeBox.y + iframeBox.height + 0.5,
        );

        const intersectsPanel = !(
          mainSheetBox.x + mainSheetBox.width <= panelBox.x ||
          mainSheetBox.x >= panelBox.x + panelBox.width ||
          mainSheetBox.y + mainSheetBox.height <= panelBox.y ||
          mainSheetBox.y >= panelBox.y + panelBox.height
        );
        expect(intersectsPanel).toBe(false);
      }

      await frame.getByRole("button", { name: "Close", exact: true }).click();
      await expect(sheet).toHaveCount(0, { timeout: 5000 });
    }
  });

  test("play-ui: desktop shape control changes the specimen and the copy output", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const jsxPane = page.locator('pre[data-play-output="jsx"]');
    await expect(jsxPane).not.toContainText("shape=");

    const trigger = frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("data-vista-sheet-shape", "circle");

    await page.getByRole("radio", { name: "Square", exact: true }).check();

    await expect(trigger).toHaveAttribute("data-vista-sheet-shape", "square");
    await expect(jsxPane).toContainText('shape="square"');
  });

  test("play-ui: desktop token control changes the specimen and the copy output", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    await page.getByLabel("Surface", { exact: true }).fill("#ff0000");

    await expect
      .poll(async () =>
        frame
          .locator('[data-vista-sheet-part="trigger-surface"]')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(255, 0, 0)");

    const cssPane = page.locator('pre[data-play-output="css"]');
    await expect(cssPane).toContainText("--vista-sheet-surface: #ff0000;");

    const cssPaneText = await cssPane.textContent();
    const styleText = await frame.locator("style[data-play-css]").textContent();
    expect(styleText).toBe(cssPaneText);
  });

  test("play-ui: desktop specimen opens and closes", async ({ page }) => {
    const frame = await gotoPlay(page);
    await frame
      .getByRole("button", { name: "Open sheet", exact: true })
      .click();

    const sheet = frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    const trigger = frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await frame.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0, { timeout: 5000 });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("play-ui: desktop recipe presets swap the specimen", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const jsxPane = page.locator('pre[data-play-output="jsx"]');

    const recipes: Record<string, string> = {
      list: "Open quick actions",
      grid: "Open apps",
      nav: "Open navigation",
      media: "Open Wavelength preview",
    };

    for (const [recipe, label] of Object.entries(recipes)) {
      await page.getByLabel("Recipe", { exact: true }).selectOption(recipe);
      await expect(
        frame.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
      await expect(jsxPane).toContainText(`aria-label="${label}"`);
    }
  });

  test("play-ui: desktop dragging the specimen updates the anchor control and copy output", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const iframeLocator = page.locator("iframe[data-play-stage]");
    const iframeBox = await iframeLocator.boundingBox();
    expect(iframeBox).not.toBeNull();
    if (!iframeBox) return;

    const trigger = frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
    );
    const trigBox = await trigger.boundingBox();
    expect(trigBox).not.toBeNull();
    if (!trigBox) return;

    const startX = iframeBox.x + trigBox.x + trigBox.width / 2;
    const startY = iframeBox.y + trigBox.y + trigBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(iframeBox.x + 80, iframeBox.y + 80, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByLabel("Anchor", { exact: true })).toHaveValue(
      "top-left",
      { timeout: 5000 },
    );
    await expect(page.locator('pre[data-play-output="jsx"]')).toContainText(
      'defaultAnchor="top-left"',
    );
  });

  test("play-ui: desktop Copy JSX writes the JSX pane to the clipboard", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (t: string) => {
            (window as unknown as { __playCopied?: string }).__playCopied = t;
          },
        },
      });
    });

    await gotoPlay(page);

    await page.getByRole("button", { name: "Copy JSX", exact: true }).click();

    const jsxPaneText = await page
      .locator('pre[data-play-output="jsx"]')
      .textContent();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __playCopied?: string }).__playCopied,
        ),
      )
      .toBe(jsxPaneText);

    await expect(page.locator("[data-play-copy-status]")).toHaveText(
      "Copied JSX",
    );
  });

  test("play-ui: desktop links to the motion tuner instead of duplicating it", async ({
    page,
  }) => {
    await gotoPlay(page);
    const link = page.getByRole("link", { name: "Motion tuner", exact: true });
    await expect(link).toHaveAttribute("href", /tune\.html$/);
  });
});

test.describe("390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("play-ui: phone loads with controls in a sheet", async ({ page }) => {
    await gotoPlay(page);

    await expect(page.locator("[data-play-panel]")).toHaveCount(0);

    const iframeBox = await page
      .locator("iframe[data-play-stage]")
      .boundingBox();
    expect(iframeBox).not.toBeNull();
    if (iframeBox) {
      expect(iframeBox.width).toBeGreaterThanOrEqual(389);
      expect(iframeBox.width).toBeLessThanOrEqual(391);
      expect(iframeBox.height).toBeGreaterThanOrEqual(843);
      expect(iframeBox.height).toBeLessThanOrEqual(845);
    }

    await page
      .getByRole("button", { name: "Playground controls", exact: true })
      .click();

    const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: "Square", exact: true }),
    ).toBeVisible();
  });

  test("play-ui: phone shape control changes the specimen and the copy output", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);

    await page
      .getByRole("button", { name: "Playground controls", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
    await dialog.getByRole("radio", { name: "Square", exact: true }).check();

    const jsxPane = dialog.locator('pre[data-play-output="jsx"]');
    await expect(jsxPane).toContainText('shape="square"');

    await page
      .getByRole("button", { name: "Close controls", exact: true })
      .click();

    const trigger = frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("data-vista-sheet-shape", "square");
  });

  test("play-ui: phone specimen opens and closes", async ({ page }) => {
    const frame = await gotoPlay(page);
    await frame
      .getByRole("button", { name: "Open sheet", exact: true })
      .click();

    const sheet = frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    const trigger = frame.locator(
      '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await frame.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0, { timeout: 5000 });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("play-ui: phone controls trigger yields the top-right corner to the specimen", async ({
    page,
  }) => {
    await gotoPlay(page);

    await page
      .getByRole("button", { name: "Playground controls", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
    await dialog
      .getByLabel("Anchor", { exact: true })
      .selectOption("top-right");
    await page
      .getByRole("button", { name: "Close controls", exact: true })
      .click();

    const frame = page.frameLocator("iframe[data-play-stage]");

    await expect
      .poll(async () => {
        const controlsTrigger = page.locator(
          '[data-vista-sheet-root="play-controls"] [data-vista-sheet-part="trigger"]',
        );
        const specimenTrigger = frame.locator(
          '[data-vista-sheet-root="specimen"] [data-vista-sheet-part="trigger"]',
        );
        const controlsBox = await controlsTrigger.boundingBox();
        const specimenBox = await specimenTrigger.boundingBox();
        if (!controlsBox || !specimenBox) return false;

        const controlsCenterX = controlsBox.x + controlsBox.width / 2;
        const specimenCenterX = specimenBox.x + specimenBox.width / 2;

        const intersects = !(
          controlsBox.x + controlsBox.width <= specimenBox.x ||
          controlsBox.x >= specimenBox.x + specimenBox.width ||
          controlsBox.y + controlsBox.height <= specimenBox.y ||
          controlsBox.y >= specimenBox.y + specimenBox.height
        );

        return controlsCenterX < 195 && specimenCenterX > 195 && !intersects;
      })
      .toBe(true);
  });
});
