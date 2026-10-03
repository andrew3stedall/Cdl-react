import { expect, test, type Locator, type Page } from '@playwright/test';

import { installLayoutFixtures } from './layout-fixtures';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function bounds(locator: Locator): Promise<Bounds> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box as Bounds;
}

function expectBoundsStable(before: Bounds, after: Bounds) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(before[key] - after[key]), `${key} changed by more than 1 CSS pixel`).toBeLessThanOrEqual(1);
  }
}

function activeHero(page: Page) {
  return page.locator('[data-page-hero="shared"]:visible');
}

function activeBell(page: Page) {
  return page.locator('.global-notifications__button:visible');
}

async function readHeaderBounds(page: Page) {
  return { hero: await bounds(activeHero(page)), bell: await bounds(activeBell(page)) };
}

async function primaryLink(page: Page, label: string) {
  const mobileNav = page.getByRole('navigation', { name: 'Global mobile navigation' });
  const sidebar = page.getByRole('navigation', { name: 'Primary navigation' });
  const nav = await mobileNav.isVisible() ? mobileNav : sidebar;
  return nav.getByRole('link', { name: label });
}

async function setViewport(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
}

test('the four primary route headers and notification control stay fixed through load, route changes, and browser back', async ({ page }) => {
  await installLayoutFixtures(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await setViewport(page, viewport.width, viewport.height);
    await page.goto('/dashboard');

    const pending = await readHeaderBounds(page);
    await expect(page.getByRole('status').filter({ hasText: 'Some desk data is unavailable' })).toBeVisible();
    const loaded = await readHeaderBounds(page);
    expectBoundsStable(pending.hero, loaded.hero);
    expectBoundsStable(pending.bell, loaded.bell);

    for (const [label, title] of [
      ['Squad', 'Squad'],
      ['Market', 'Market'],
      ['League', 'League'],
    ]) {
      await (await primaryLink(page, label)).click();
      await expect(await primaryLink(page, label)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText(title);
      const routeHeader = await readHeaderBounds(page);
      expectBoundsStable(loaded.hero, routeHeader.hero);
      expectBoundsStable(loaded.bell, routeHeader.bell);
    }

    await page.goBack();
    await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Market');
    const afterBack = await readHeaderBounds(page);
    expectBoundsStable(loaded.hero, afterBack.hero);
    expectBoundsStable(loaded.bell, afterBack.bell);
  }
});

test('custom theme chooser remains in the viewport in portrait and landscape and keeps keyboard focus contained', async ({ page }) => {
  await installLayoutFixtures(page, 0);
  await page.goto('/profile');
  await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Profile');

  const profileHeader = await readHeaderBounds(page);
  await page.getByRole('button', { name: 'Open theme colour settings' }).click();
  await expect(page.locator('main[aria-labelledby="account-settings-title"] h1')).toHaveText('Theme colours');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Profile');
  expectBoundsStable(profileHeader.hero, await bounds(activeHero(page)));
  expectBoundsStable(profileHeader.bell, await bounds(activeBell(page)));

  const trigger = page.locator('.profile-theme-colour-trigger');
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await setViewport(page, viewport.width, viewport.height);
    await trigger.focus();
    await page.keyboard.press('Enter');

    const sheet = page.getByRole('dialog', { name: 'Choose a palette' });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(':focus')).toBeVisible();
    const sheetBounds = await bounds(sheet);
    expect(sheetBounds.x).toBeGreaterThanOrEqual(0);
    expect(sheetBounds.y).toBeGreaterThanOrEqual(0);
    expect(sheetBounds.x + sheetBounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(sheetBounds.y + sheetBounds.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);

    await page.getByText('Custom palette', { exact: true }).click();
    const appearanceGroup = sheet.getByRole('group', { name: 'Custom palette appearance' });
    const expandedSheetBounds = await bounds(sheet);
    expect(expandedSheetBounds.x + expandedSheetBounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    await appearanceGroup.getByRole('button', { name: 'Light appearance' }).click();
    await expect(appearanceGroup.getByRole('button', { name: 'Light appearance' })).toHaveAttribute('aria-pressed', 'true');
    await appearanceGroup.getByRole('button', { name: 'Dark appearance' }).click();
    await expect(appearanceGroup.getByRole('button', { name: 'Dark appearance' })).toHaveAttribute('aria-pressed', 'true');

    await sheet.locator('button:visible').last().focus();
    await page.keyboard.press('Tab');
    await expect(sheet.locator('.profile-fdr-sheet__close')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});
