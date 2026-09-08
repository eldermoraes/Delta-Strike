import { expect, test } from '@playwright/test';

test('touch briefing matches device and forward stick dives while backward climbs', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#instructions-open').click();
  await expect(page.getByRole('heading', { name: 'Fly with the touch stick' })).toBeVisible();
  await expect(page.locator('.keyboard-instructions')).toBeHidden();
  await page.locator('#briefing-close').click();
  await page.locator('#launch').click();
  await expect(page.locator('#stick')).toBeVisible();
  const box = (await page.locator('#stick').boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 35);
  await page.waitForFunction(() => (window as any).__delta.sim.player.pitch < -0.2);
  await page.mouse.up();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 35);
  await page.waitForFunction(() => (window as any).__delta.sim.player.pitch > 0.2);
  await page.mouse.up();
  await context.close();
});
