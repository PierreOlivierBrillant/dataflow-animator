import { expect, type Page } from '@playwright/test';

/**
 * Same stabilization recipe as `referenceGrid.visual.spec.ts`: wait for the A/B
 * page to have mounted (`window.__AB__.ready`), then for fonts to settle,
 * then a short buffer for the ResizeObserver / set_content measurement
 * passes to fall back to rest before a screenshot is taken.
 */
export async function waitForAbReady(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!(window as unknown as { __AB__?: { ready?: boolean } }).__AB__
            ?.ready
      )
    )
    .toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
