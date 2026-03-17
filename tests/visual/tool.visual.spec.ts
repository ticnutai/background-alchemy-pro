import { test, expect } from "@playwright/test";

test.describe("Tool visual QA", () => {
  test("tool page shell should stay visually stable", async ({ page }) => {
    await page.goto("/tool");
    await page.waitForLoadState("networkidle");

    // Hide dynamic animations/cursors for stable snapshots.
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
          caret-color: transparent !important;
        }
      `,
    });

    await expect(page).toHaveScreenshot("tool-shell.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
