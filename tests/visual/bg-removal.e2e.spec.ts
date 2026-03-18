import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

test.describe("Background removal E2E", () => {
  test("local background removal should produce a preview", async ({ page }) => {
    test.setTimeout(240000);

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const sampleImagePath = path.resolve(currentDir, "../../src/assets/gallery-1.jpg");

    await page.goto("/tool");
    await page.waitForLoadState("networkidle");

    const fileInput = page.getByTestId("image-file-input");
    await fileInput.setInputFiles(sampleImagePath);

    const removeButton = page.getByTestId("remove-bg-button");
    await expect(removeButton).toBeVisible();
    await expect(removeButton).toBeEnabled();

    await removeButton.click();

    const previewContainer = page.getByTestId("removal-preview-container");
    await expect(previewContainer).toBeVisible({ timeout: 180000 });

    await expect(page.getByTestId("removal-preview-image")).toBeVisible();
    await expect(page.getByTestId("removal-save-button")).toBeVisible();
  });
});
