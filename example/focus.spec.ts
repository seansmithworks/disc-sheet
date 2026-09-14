import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * focus.spec.ts — N2 (wave.md "### N2"): the Tab trap owns every focusable
 * control (form fields included, disabled/hidden excluded), initial focus
 * goes to the sheet's first text-entry control once it settles, and the
 * trap/scroll-lock/aria-hiding all outlive `open` through the close
 * animation. Runs against example/fixtures/focus.tsx — a fixture built
 * specifically so its tab order can't be discovered from the trap's own
 * selector (see the comment on the fixture's trailing <input>).
 */

const TRIGGER_LABEL = "Open focus fixture";
const CLOSE_LABEL = "Close";

async function openFixture(page: Page): Promise<Locator> {
  await page.goto("/fixtures/focus.html");
  await page.getByRole("button", { name: TRIGGER_LABEL }).click();
  const sheet = page.locator('[data-vista-sheet-part="sheet"]');
  await sheet.waitFor();
  return sheet;
}

async function waitForSettle(page: Page, sheet: Locator): Promise<void> {
  await sheet.waitFor();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-vista-sheet-part="sheet"]');
    return el?.hasAttribute("data-vista-sheet-settled") ?? false;
  });
}

test.describe("N2 focus model", () => {
  test("initial focus: settles on the sheet's first text-entry control, not the panel", async ({
    page,
  }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    // Notes (<textarea>) is the first text-entry control in DOM order —
    // ahead of the <select> and the trailing <input>.
    await expect(sheet.getByTestId("field-textarea")).toBeFocused();
  });

  test("Tab and Shift+Tab visit every visible enabled control in DOM order and wrap, never leaving the panel", async ({
    page,
  }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    const close = sheet.getByRole("button", { name: CLOSE_LABEL });
    const content = sheet.locator('[data-vista-sheet-part="content"]');
    const textarea = sheet.getByTestId("field-textarea");
    const select = sheet.getByTestId("field-select");
    const input = sheet.getByTestId("field-input");

    // Settle already left focus on the textarea (first text-entry control).
    await expect(textarea).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(select).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();

    // The disabled button and the display:none link sit between select and
    // input in the DOM (see the fixture) — Tab from select must skip both
    // and land on input directly, not stop on either.
    await page.keyboard.press("Tab");
    // Wraps past the end of the sequence back to the start.
    await expect(close).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(content).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(textarea).toBeFocused();

    // Shift+Tab reverses the exact same sequence.
    await page.keyboard.press("Shift+Tab");
    await expect(content).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();

    // Shift+Tab from the first control wraps to the last.
    await page.keyboard.press("Shift+Tab");
    await expect(input).toBeFocused();
  });

  test("PageDown scrolls the content region once it holds focus", async ({
    page,
  }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    const content = sheet.locator('[data-vista-sheet-part="content"]');
    // Tab from the settled textarea, through select/input, wraps to close,
    // then content — see the order test above. Tabbing through the fields
    // already scrolled the region close to its bottom (the browser's own
    // focus-follows-scroll behaviour, nothing to do with the trap) — reset
    // to the top so the assertion below is actually exercising PageDown,
    // not just observing scroll position Tab happened to leave behind.
    await page.keyboard.press("Tab"); // -> select
    await page.keyboard.press("Tab"); // -> input
    await page.keyboard.press("Tab"); // -> close (wrap)
    await page.keyboard.press("Tab"); // -> content
    await expect(content).toBeFocused();
    await content.evaluate((el) => {
      el.scrollTop = 0;
    });

    await page.keyboard.press("PageDown");
    await expect(async () => {
      const scrollTop = await content.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass();
  });

  test("a Tab pressed mid-close stays inside the panel", async ({ page }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    await page.keyboard.press("Escape");
    // Immediately, before the exit animation (and onExitComplete) finish:
    // the trap must still own Tab, because the panel is still on screen.
    await page.keyboard.press("Tab");

    const focusStayedInside = await sheet.evaluate(
      (el) =>
        el.contains(document.activeElement) || el === document.activeElement,
    );
    expect(focusStayedInside).toBe(true);
  });

  test("focus restores to the trigger once the close animation actually completes", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached", timeout: 5000 });

    await expect(trigger).toBeFocused();
  });
});
