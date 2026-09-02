import { test, expect } from "@playwright/test";

/**
 * a11y.spec.ts — walks docs/PACKAGE-DESIGN.md §6 ("Accessibility contract")
 * line by line, against the real example app. This is a permanent gate, not
 * a one-off review artifact: the review's CONFIRMED GREEN section was
 * measured by hand once; this gate re-measures it on every run.
 */

const TRIGGER_LABEL = "Open example sheet";
const CLOSE_LABEL = "Close";

test.describe("§6 accessibility contract", () => {
  test("trigger: real button, aria-haspopup, aria-expanded, aria-controls", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });

    expect(await trigger.evaluate((el) => el.tagName)).toBe("BUTTON");
    expect(await trigger.getAttribute("type")).toBe("button");
    expect(await trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(await trigger.getAttribute("aria-expanded")).toBe("false");
    expect(await trigger.getAttribute("aria-controls")).toBeNull();

    await trigger.click();
    await page.waitForSelector('[data-morph-sheet-part="sheet"]');

    expect(await trigger.getAttribute("aria-expanded")).toBe("true");
    const controls = await trigger.getAttribute("aria-controls");
    expect(controls).not.toBeNull();

    const sheetId = await page
      .locator('[data-morph-sheet-part="sheet"]')
      .getAttribute("id");
    expect(controls).toBe(sheetId);
  });

  test("dialog semantics: role, aria-modal, tabIndex, matching labelledby id", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();

    const sheet = page.locator('[data-morph-sheet-part="sheet"]');
    await expect(sheet).toHaveAttribute("role", "dialog");
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await expect(sheet).toHaveAttribute("tabindex", "-1");

    const labelledBy = await sheet.getAttribute("aria-labelledby");
    expect(labelledBy).toBe("example-sheet-title");
    await expect(page.locator(`#${labelledBy}`)).toBeVisible();
  });

  test("focus: lands on the panel (not the first control) on open", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    const sheet = page.locator('[data-morph-sheet-part="sheet"]');
    await sheet.waitFor();
    // useDialogBehavior focuses the panel ~50ms after open.
    await page.waitForTimeout(150);
    const isSheetFocused = await sheet.evaluate(
      (el) => document.activeElement === el,
    );
    expect(isSheetFocused).toBe(true);
  });

  test("focus: restores to the trigger on exit-complete", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    await trigger.click();
    await page.waitForSelector('[data-morph-sheet-part="sheet"]');
    await page.waitForTimeout(150);

    await page.keyboard.press("Escape");
    // Wait for AnimatePresence's exit + onExitComplete.
    await page.waitForSelector('[data-morph-sheet-part="sheet"]', {
      state: "detached",
      timeout: 5000,
    });
    await page.waitForTimeout(100);

    const isTriggerFocused = await trigger.evaluate(
      (el) => document.activeElement === el,
    );
    expect(isTriggerFocused).toBe(true);
  });

  test("Escape closes the sheet unconditionally", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    await page.waitForSelector('[data-morph-sheet-part="sheet"]');
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-morph-sheet-part="sheet"]', {
      state: "detached",
      timeout: 5000,
    });
  });

  test("Tab/Shift+Tab cycle within the panel", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    const sheet = page.locator('[data-morph-sheet-part="sheet"]');
    await sheet.waitFor();
    await page.waitForTimeout(150);

    const focusables = sheet.locator(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const count = await focusables.count();
    expect(count).toBeGreaterThan(0);

    const first = focusables.first();
    const last = focusables.last();

    // The trap only intercepts Tab/Shift+Tab once focus is ON first/last —
    // focus starts on the panel itself (§6: "not the first control"), so
    // move there first via an ordinary Tab.
    await page.keyboard.press("Tab");
    expect(await first.evaluate((el) => document.activeElement === el)).toBe(
      true,
    );

    // Shift+Tab from the first focusable wraps to the last.
    await page.keyboard.press("Shift+Tab");
    expect(await last.evaluate((el) => document.activeElement === el)).toBe(
      true,
    );

    // Tab from the last focusable wraps to the first.
    await page.keyboard.press("Tab");
    expect(await first.evaluate((el) => document.activeElement === el)).toBe(
      true,
    );
  });

  test("body scroll lock: overflow hidden while open, restored on close", async ({
    page,
  }) => {
    await page.goto("/");
    const initialOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );

    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    await page.waitForSelector('[data-morph-sheet-part="sheet"]');
    const openOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(openOverflow).toBe("hidden");

    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-morph-sheet-part="sheet"]', {
      state: "detached",
      timeout: 5000,
    });
    const closedOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(closedOverflow).toBe(initialOverflow);
  });

  test("Labelled union: sheet always exposes exactly one accessible name source", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    const sheet = page.locator('[data-morph-sheet-part="sheet"]');
    const hasLabel = await sheet.getAttribute("aria-label");
    const hasLabelledBy = await sheet.getAttribute("aria-labelledby");
    expect(Boolean(hasLabel) !== Boolean(hasLabelledBy)).toBe(true);
  });

  test("visible close control is rendered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    const close = page.getByRole("button", { name: CLOSE_LABEL });
    await expect(close).toBeVisible();
    await close.click();
    await page.waitForSelector('[data-morph-sheet-part="sheet"]', {
      state: "detached",
      timeout: 5000,
    });
  });

  test("reduced motion: layoutId dropped everywhere (0 data-projection-id nodes)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    await page.waitForSelector('[data-morph-sheet-part="sheet"]');
    await page.waitForTimeout(300);

    const projectionNodes = await page.locator("[data-projection-id]").count();
    expect(projectionNodes).toBe(0);
  });

  test("console: zero errors through open -> close", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));

    await page.goto("/");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    await page.waitForSelector('[data-morph-sheet-part="sheet"]');
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-morph-sheet-part="sheet"]', {
      state: "detached",
      timeout: 5000,
    });

    expect(errors).toEqual([]);
  });
});
