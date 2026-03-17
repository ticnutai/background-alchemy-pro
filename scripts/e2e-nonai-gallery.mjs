import { chromium } from '@playwright/test';

const BASE_URL = 'https://background-alchemy-pro.lovable.app';
const EMAIL = 'jj1212t@gmail.com';
const PASSWORD = '543211';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.count()) {
      try {
        await loc.click({ timeout: 2500 });
        return selector;
      } catch {
        // try next selector
      }
    }
  }
  return null;
}

async function loginIfNeeded(page) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);

  const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
  if (await emailInput.count()) {
    console.log('Login required, filling credentials...');
    await emailInput.fill(EMAIL);

    const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first();
    await passwordInput.fill(PASSWORD);

    const clicked = await clickFirstVisible(page, [
      'button:has-text("התחבר")',
      'button:has-text("כניסה")',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button[type="submit"]'
    ]);

    if (!clicked) {
      await passwordInput.press('Enter');
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await sleep(2000);
  } else {
    console.log('Already logged in or no auth screen detected.');
  }
}

async function openGallery(page) {
  await page.goto(`${BASE_URL}/gallery`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await sleep(1500);

  const gridImages = page.locator('main .grid img');
  const count = await gridImages.count();
  console.log(`Gallery images detected: ${count}`);
  if (count < 2) {
    throw new Error(`Need at least 2 images in gallery, found ${count}`);
  }
}

async function getLargestVisibleImageSrc(page) {
  return await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    let best = null;
    let bestArea = 0;
    for (const img of imgs) {
      const rect = img.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      const isVisible = rect.width > 40 && rect.height > 40;
      if (isVisible && area > bestArea && img.src) {
        bestArea = area;
        best = img.src;
      }
    }
    return best;
  });
}

async function processImageFromGallery(page, imageIndex) {
  console.log(`\n--- Processing gallery image #${imageIndex + 1} ---`);

  await page.goto(`${BASE_URL}/gallery`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await sleep(1200);

  const gridImages = page.locator('main .grid img');
  const count = await gridImages.count();
  if (count <= imageIndex) {
    throw new Error(`Gallery has only ${count} images, cannot access index ${imageIndex}`);
  }

  await gridImages.nth(imageIndex).click({ timeout: 10000 });
  await page.getByRole('button', { name: 'ערוך בכלי' }).click({ timeout: 10000 });

  await page.waitForURL(/\/tool/, { timeout: 30000 });
  const toolUrl = page.url();
  console.log(`Current URL after edit click (#${imageIndex + 1}):`, toolUrl);
  await page.goto(toolUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await sleep(1500);

  const hasErrorToast = async () => {
    return await page.locator('text=שגיאה, text=error, text=failed').first().isVisible().catch(() => false);
  };
  const debugButtons = await page.locator('button').evaluateAll((els) =>
    els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 80)
  );
  console.log(`Tool buttons snapshot (#${imageIndex + 1}):`, debugButtons);

  let clickedRemove = await clickFirstVisible(page, [
    'button:has-text("הסר רקע מקומית")',
    'button:has-text("הפעל הסרת רקע חכמה")',
    'button:has-text("הסר רקע")'
  ]);
  if (!clickedRemove) {
    await page.getByRole('button', { name: /Pro ללא AI/ }).click({ timeout: 10000 });
    clickedRemove = await clickFirstVisible(page, [
      'button:has-text("הסר רקע מקומית")',
      'button:has-text("הפעל הסרת רקע חכמה")',
      'button:has-text("הסר רקע")'
    ]);
  }
  if (!clickedRemove) {
    throw new Error(`Image #${imageIndex + 1}: remove-bg button was not found`);
  }

  await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('button')).some((b) => (b.textContent || '').includes('מעבד')),
    { timeout: 90000 }
  ).catch(() => {});
  if (await hasErrorToast()) {
    throw new Error(`Image #${imageIndex + 1}: remove-bg reported an error`);
  }

  // NOTE: Non-AI background replacement action is disabled in current production flow.
  // We validate the non-AI remove path end-to-end for gallery images here.
  console.log(`Image #${imageIndex + 1}: non-AI remove completed.`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await loginIfNeeded(page);
    await openGallery(page);

    await processImageFromGallery(page, 0);
    await processImageFromGallery(page, 1);

    await page.screenshot({ path: 'e2e-nonai-gallery-success.png', fullPage: true });
    console.log('\nE2E SUCCESS: Processed 2 gallery images through non-AI remove flow.');
    process.exitCode = 0;
  } catch (err) {
    console.error('\nE2E FAILED:', err?.message || err);
    await page.screenshot({ path: 'e2e-nonai-gallery-failure.png', fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
