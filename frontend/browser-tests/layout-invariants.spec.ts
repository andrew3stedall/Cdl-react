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

function expectHeaderDimensions(bounds: Awaited<ReturnType<typeof readHeaderBounds>>, viewport: { width: number; height: number }) {
  const expectedHeroHeight = viewport.width <= 900 ? 3.8 * 16 : 4.2 * 16;
  expect(Math.abs(bounds.hero.height - expectedHeroHeight), 'shared PageHero height differs from its shell role').toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.bell.width - 40), 'notification control width differs from its 40px target').toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.bell.height - 40), 'notification control height differs from its 40px target').toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.bell.x + bounds.bell.width - (bounds.hero.x + bounds.hero.width)), 'notification control is not aligned to the PageHero end').toBeLessThanOrEqual(1);
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

test('the four primary route headers and notification control stay fixed through real loading, route changes, and browser back', async ({ page }, testInfo) => {
  const viewports = testInfo.project.name === 'chromium-desktop'
    ? [{ width: 1280, height: 800 }]
    : [{ width: 390, height: 844 }, { width: 844, height: 390 }];
  for (const [viewportIndex, viewport] of viewports.entries()) {
    const routePage = viewportIndex === 0 ? page : await page.context().newPage();
    const { releasePendingResponses } = await installLayoutFixtures(routePage, { holdDataUntilReleased: true });
    await setViewport(routePage, viewport.width, viewport.height);
    await routePage.goto('/dashboard');

    const pendingByTitle = new Map<string, Awaited<ReturnType<typeof readHeaderBounds>>>();
    await expect(routePage.locator('.manager-desk__fixture-focus--loading')).toBeVisible();
    pendingByTitle.set('Desk', await readHeaderBounds(routePage));

    for (const [label, title, loadingSelector] of [
      ['Squad', 'Squad', '.squad-page__pitch-shell--loading, .squad-page__list--loading'],
      ['Market', 'Market', '.market-page__table-wrap--loading'],
      ['League', 'League', '.league-loading'],
    ]) {
      await (await primaryLink(routePage, label)).click();
      await expect(routePage.locator('[data-page-hero="shared"]:visible h1')).toHaveText(title);
      await expect(routePage.locator(loadingSelector).filter({ visible: true })).toBeVisible();
      pendingByTitle.set(title, await readHeaderBounds(routePage));
    }

    releasePendingResponses();
    const routeTitles = [
      ['Squad', 'Squad'],
      ['Market', 'Market'],
      ['League', 'League'],
    ];
    for (const [label, title] of [['Desk', 'Gaffers Desk'], ...routeTitles]) {
      await (await primaryLink(routePage, label)).click();
      await expect(await primaryLink(routePage, label)).toHaveAttribute('aria-current', 'page');
      await expect(routePage.locator('[data-page-hero="shared"]:visible h1')).toHaveText(title);

      if (title === 'Squad') {
        const listButton = routePage.getByRole('button', { name: 'View as list' });
        if (await listButton.isVisible()) await listButton.click();
        await expect(routePage.locator('.squad-page__list-table tbody tr')).toHaveCount(20);
        await expect(routePage.getByLabel('Chip controls').getByRole('button')).toHaveCount(5);
      } else if (title === 'Market') {
        await expect(routePage.getByText('Fixture Available Midfielder')).toBeVisible();
      } else if (title === 'League') {
        await expect(routePage.locator('.league-fixtures-view')).toBeVisible();
        await expect(routePage.getByText('River Rangers')).toBeVisible();
      } else {
        await expect(routePage.locator('.manager-desk__fixture-focus--pre_deadline')).toBeVisible();
        await expect(routePage.locator('.manager-desk__fixture-matchup--featured')).toBeVisible();
        await expect(routePage.getByText('BFC')).toBeVisible();
      }

      const routeHeader = await readHeaderBounds(routePage);
      expectHeaderDimensions(routeHeader, viewport);
      const pending = pendingByTitle.get(label);
      expect(pending).toBeDefined();
      expectBoundsStable(pending!.hero, routeHeader.hero);
      expectBoundsStable(pending!.bell, routeHeader.bell);
    }

    await routePage.goBack();
    await expect(routePage.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Market');
    const afterBack = await readHeaderBounds(routePage);
    expectHeaderDimensions(afterBack, viewport);
    const marketPending = pendingByTitle.get('Market');
    expect(marketPending).toBeDefined();
    expectBoundsStable(marketPending!.hero, afterBack.hero);
    expectBoundsStable(marketPending!.bell, afterBack.bell);

    if (routePage !== page) await routePage.close();
  }
});

test('custom theme chooser remains in the viewport in portrait and landscape and keeps keyboard focus contained', async ({ page }) => {
  await installLayoutFixtures(page, { apiDelayMs: 0 });
  await page.goto('/profile');
  await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Profile');

  const profileHeader = await readHeaderBounds(page);
  await page.getByRole('button', { name: 'Open theme colour settings' }).click();
  await expect(page.locator('main[aria-labelledby="account-settings-title"] h1')).toHaveText('Theme colours');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Profile');
  expectBoundsStable(profileHeader.hero, await bounds(activeHero(page)));
  expectBoundsStable(profileHeader.bell, await bounds(activeBell(page)));
  await page.getByRole('button', { name: 'Open theme colour settings' }).click();
  await expect(page.locator('main[aria-labelledby="account-settings-title"] h1')).toHaveText('Theme colours');

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

    const customPaletteDetails = sheet.locator('#theme-custom-accordion');
    if (!(await customPaletteDetails.evaluate((details) => (details as HTMLDetailsElement).open))) {
      await page.getByText('Custom palette', { exact: true }).click();
    }
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

test('commissioner PageHero and bell retain measured bounds in light and dark appearance states', async ({ page }) => {
  await installLayoutFixtures(page, { apiDelayMs: 0, roles: ['commissioner'] });
  const viewport = { width: 390, height: 844 };
  await setViewport(page, viewport.width, viewport.height);
  await page.goto('/login');
  const themeSurfaces: string[] = [];

  for (const presetName of ['teal-light', 'teal-dark']) {
    await page.context().addCookies([{
      name: 'cdl-theme-preset',
      value: presetName,
      url: new URL(page.url()).origin,
      sameSite: 'Lax',
    }]);
    await page.goto('/league');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-theme-preset', presetName);
    await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('League');
    await expect(page.getByRole('button', { name: 'View commissioner management' })).toBeVisible();
    await expect(page.locator('.league-fixtures-view')).toBeVisible();

    const fixtureHeader = await readHeaderBounds(page);
    expectHeaderDimensions(fixtureHeader, viewport);
    themeSurfaces.push(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim()));

    await page.getByRole('button', { name: 'View commissioner management' }).click();
    await expect(page.getByRole('region', { name: 'Commissioner management' })).toBeVisible();
    await expect(page.getByText('Open Team')).toBeVisible();
    const managementHeader = await readHeaderBounds(page);
    expectHeaderDimensions(managementHeader, viewport);
    expectBoundsStable(fixtureHeader.hero, managementHeader.hero);
    expectBoundsStable(fixtureHeader.bell, managementHeader.bell);
  }

  expect(themeSurfaces[0]).not.toBe(themeSurfaces[1]);
});
