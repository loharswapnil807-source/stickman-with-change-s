import { test, expect } from '@playwright/test';

test('the new game loads and starts a combat run', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#game-title')).toContainText('PAPER');
  await page.getByRole('button', { name: /LET’S MAKE A SCENE/i }).click();
  await expect(page.locator('#game-hud')).not.toHaveClass(/hidden/);
  const word = (await page.locator('#word').innerText()).trim();
  expect(word.length).toBeGreaterThan(1);
  await page.keyboard.type(word);
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.getByRole('button', { name: /BACK TO THE ACTION/i }).click();
  await page.getByRole('button', { name: /How to play/i }).click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the dojo exposes an original tutorial and mobile typing field', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Enter the dojo/i }).click();
  await expect(page.locator('#training-note')).not.toHaveClass(/hidden/);
  await expect(page.locator('#lesson-title')).toHaveText(/Your words hit hard/i);
  await expect(page.locator('#touch-type')).toHaveAttribute('placeholder', /Tap here/i);
});
