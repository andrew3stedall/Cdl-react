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

function expectBoundsStable(before: Bounds, after: Bounds, label: string) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(before[key] - after[key]),
      `${label} ${key} changed by more than 1 CSS pixel (${before[key]} → ${after[key]})`,
    ).toBeLessThanOrEqual(1);
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

async function expectHeaderDimensions(page: Page, header: Awaited<ReturnType<typeof readHeaderBounds>>, viewport: { width: number; height: number }) {
  const rootFontSize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
  const heroRem = viewport.width <= 520 ? 8.5 : viewport.width <= 900 ? 3.8 : 4.2;
  const expectedHeroHeight = heroRem * rootFontSize;
  const expectedBellSize = 2.5 * rootFontSize;
  expect(Math.abs(header.hero.height - expectedHeroHeight), 'shared PageHero height differs from its shell role').toBeLessThanOrEqual(1);
  expect(Math.abs(header.bell.width - expectedBellSize), 'notification control width differs from its 2.5rem target').toBeLessThanOrEqual(1);
  expect(Math.abs(header.bell.height - expectedBellSize), 'notification control height differs from its 2.5rem target').toBeLessThanOrEqual(1);
  const bellInlineEndDelta = header.bell.x + header.bell.width - (header.hero.x + header.hero.width);
  expect(Math.abs(bellInlineEndDelta), `notification control end differs from the PageHero end by ${bellInlineEndDelta}px (bell ${JSON.stringify(header.bell)}, hero ${JSON.stringify(header.hero)})`).toBeLessThanOrEqual(1);
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

function expectWithinViewport(box: Bounds, viewport: { width: number; height: number }, label: string) {
  expect(box.x, `${label} starts left of the viewport`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} starts above the viewport`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} extends past the viewport right edge`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${label} extends past the viewport bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectModalAboveNavigation(page: Page, modal: Locator, overlay: Locator, coverSelector: string, nav: Locator, viewport: { width: number; height: number }, label: string) {
  await expect(overlay).toBeVisible();
  const modalBox = await bounds(modal);
  expectWithinViewport(modalBox, viewport, `${label} dialog`);
  const navBox = await bounds(nav);
  const [overlayZ, navigationZ] = await page.evaluate(({ overlaySelector, navSelector }) => {
    const overlayElement = document.querySelector(overlaySelector);
    const navigationElement = document.querySelector(navSelector);
    if (!overlayElement || !navigationElement) return [Number.NaN, Number.NaN];
    return [
      Number.parseInt(getComputedStyle(overlayElement).zIndex, 10),
      Number.parseInt(getComputedStyle(navigationElement).zIndex, 10),
    ];
  }, { overlaySelector: coverSelector, navSelector: '.global-mobile-navigation' });
  expect(overlayZ, `${label} overlay must stack above mobile navigation`).toBeGreaterThan(navigationZ);
  const navCenter = { x: navBox.x + navBox.width / 2, y: navBox.y + navBox.height / 2 };
  const hitCoveredByModal = await page.evaluate(({ x, y, selector }) => {
    const hit = document.elementFromPoint(x, y);
    return hit instanceof Element && hit.closest(selector) !== null;
  }, { ...navCenter, selector: coverSelector });
  expect(hitCoveredByModal, `${label} overlay must receive hits over mobile navigation`).toBe(true);
}

async function expectModalKeyboardLifecycle(page: Page, dialog: Locator, opener: Locator, label: string) {
  const focusIsContained = () => dialog.evaluate((element) => element === document.activeElement || element.contains(document.activeElement));
  expect(await focusIsContained(), `${label} starts with focus inside the dialog`).toBe(true);
  await expect(page.locator(':focus')).toBeVisible();
  const focusable = dialog.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible, [tabindex]:not([tabindex="-1"]):visible');
  await expect(focusable.last()).toBeVisible();
  await focusable.last().focus();
  await page.keyboard.press('Tab');
  expect(await focusIsContained(), `${label} keeps Tab focus inside the dialog`).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener, `${label} returns focus to its opener after Escape`).toBeFocused();
}

test('the four primary route headers and notification control stay fixed through real loading, route changes, and browser back', async ({ page }, testInfo) => {
  const viewports = testInfo.project.name === 'chromium-desktop'
    ? [{ width: 1280, height: 800 }]
    : [
      { width: 320, height: 780 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ];
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
    let firstLoadedHeader: Awaited<ReturnType<typeof readHeaderBounds>> | undefined;
    let firstLoadedTitle = '';
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
        await expect(routePage.getByRole('button', { name: 'View Fixture Available Midfielder details' })).toBeVisible();
      } else if (title === 'League') {
        const leagueFixtures = routePage.locator('.league-fixtures-view');
        await expect(leagueFixtures).toBeVisible();
        await expect(leagueFixtures.getByText('River Rangers', { exact: true })).toBeVisible();
      } else {
        await expect(routePage.locator('.manager-desk__fixture-focus--pre_deadline')).toBeVisible();
        await expect(routePage.locator('.manager-desk__fixture-matchup--featured'))
          .toHaveAttribute('aria-label', 'Browser Fixture FC versus River Rangers');
      }

      const routeHeader = await readHeaderBounds(routePage);
      await expectHeaderDimensions(routePage, routeHeader, viewport);
      const pending = pendingByTitle.get(label);
      expect(pending).toBeDefined();
      expectBoundsStable(pending!.hero, routeHeader.hero, `${label} PageHero loading→loaded`);
      expectBoundsStable(pending!.bell, routeHeader.bell, `${label} notification loading→loaded`);
      if (!firstLoadedHeader) {
        firstLoadedHeader = routeHeader;
        firstLoadedTitle = title;
      } else {
        expectBoundsStable(firstLoadedHeader.hero, routeHeader.hero, `${firstLoadedTitle}→${title} PageHero`);
        expectBoundsStable(firstLoadedHeader.bell, routeHeader.bell, `${firstLoadedTitle}→${title} notification`);
      }
    }

    await routePage.goBack();
    await expect(routePage.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Market');
    const afterBack = await readHeaderBounds(routePage);
    await expectHeaderDimensions(routePage, afterBack, viewport);
    const marketPending = pendingByTitle.get('Market');
    expect(marketPending).toBeDefined();
    expectBoundsStable(marketPending!.hero, afterBack.hero, 'Market PageHero loading→browser back');
    expectBoundsStable(marketPending!.bell, afterBack.bell, 'Market notification loading→browser back');

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
  expectBoundsStable(profileHeader.hero, await bounds(activeHero(page)), 'Profile→Theme colours→Profile PageHero');
  expectBoundsStable(profileHeader.bell, await bounds(activeBell(page)), 'Profile→Theme colours→Profile notification');
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

    const compactViewport = { width: viewport.width, height: Math.max(320, viewport.height - 140) };
    await setViewport(page, compactViewport.width, compactViewport.height);
    const applyPalette = sheet.getByRole('button', { name: 'Apply dark palette' });
    await applyPalette.scrollIntoViewIfNeeded();
    await expect(applyPalette).toBeVisible();
    const applyBounds = await bounds(applyPalette);
    expectWithinViewport(applyBounds, compactViewport, 'Theme palette apply action after viewport height change');
    const mobileNavigationBounds = await bounds(page.locator('.global-mobile-navigation'));
    expect(
      applyBounds.y + applyBounds.height,
      'Theme palette apply action must remain above the fixed mobile navigation',
    ).toBeLessThanOrEqual(mobileNavigationBounds.y + 1);

    await sheet.locator('button:visible').last().focus();
    await page.keyboard.press('Tab');
    await expect(sheet.locator('.profile-fdr-sheet__close')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test('primary headers and essential player values remain legible at 200% text scaling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-desktop', 'Text zoom coverage uses the mobile browser viewport.');
  await installLayoutFixtures(page, { apiDelayMs: 0 });
  const viewport = { width: 430, height: 932 };
  await setViewport(page, viewport.width, viewport.height);
  await page.addInitScript(() => {
    const applyTextScale = () => { document.documentElement.style.fontSize = '200%'; };
    if (document.documentElement) applyTextScale();
    else document.addEventListener('DOMContentLoaded', applyTextScale, { once: true });
  });
  await page.goto('/dashboard');
  await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('Gaffers Desk');
  const scaledRootFontSize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(scaledRootFontSize, 'the 200% text scale should apply before measuring content').toBeGreaterThanOrEqual(32);

  for (const [label, title] of [
    ['Desk', 'Gaffers Desk'],
    ['Squad', 'Squad'],
    ['Market', 'Market'],
    ['League', 'League'],
  ]) {
    if (title !== 'Gaffers Desk') {
      await (await primaryLink(page, label)).click();
      await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText(title);
    }

    const header = await readHeaderBounds(page);
    const expectedBellSize = 2.5 * scaledRootFontSize;
    expect(Math.abs(header.bell.width - expectedBellSize), `${title} notification width at 200% text scale`).toBeLessThanOrEqual(1);
    expect(Math.abs(header.bell.height - expectedBellSize), `${title} notification height at 200% text scale`).toBeLessThanOrEqual(1);
    const bellInlineEndDelta = header.bell.x + header.bell.width - (header.hero.x + header.hero.width);
    expect(Math.abs(bellInlineEndDelta), `${title} notification aligns to PageHero at 200% text scale`).toBeLessThanOrEqual(1);
    const hero = activeHero(page);
    const heroBox = await bounds(hero);
    const brand = hero.locator('.cdl-page-hero__brand-lockup');
    const heading = hero.locator('h1');
    const actions = hero.locator('.cdl-page-hero__actions');
    const [brandBox, headingBox] = await Promise.all([
      bounds(brand),
      bounds(heading),
    ]);
    const actionItems = await actions.locator(':scope > *').all();
    const actionBoxes = await Promise.all(actionItems.map(async (item) => (
      await item.isVisible() ? bounds(item) : null
    )));
    expectWithinViewport(heroBox, viewport, `${title} PageHero`);
    expectWithinViewport(brandBox, viewport, `${title} brand`);
    expectWithinViewport(headingBox, viewport, `${title} heading`);
    actionBoxes.forEach((actionBox, index) => {
      if (!actionBox) return;
      expectWithinViewport(actionBox, viewport, `${title} action ${index + 1}`);
      const brandAndActionDoNotOverlap = brandBox.x + brandBox.width <= actionBox.x + 1
        || brandBox.y + brandBox.height <= actionBox.y + 1
        || actionBox.x + actionBox.width <= brandBox.x + 1
        || actionBox.y + actionBox.height <= brandBox.y + 1;
      expect(brandAndActionDoNotOverlap, `${title} brand ${JSON.stringify(brandBox)} and action ${index + 1} ${JSON.stringify(actionBox)} must not overlap after responsive wrapping`).toBe(true);
    });
    const titleFontSize = await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(titleFontSize, `${title} title should respond to 200% text scaling`).toBeGreaterThanOrEqual(32);
    const heroOverflow = await hero.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(heroOverflow, `${title} header content should not overflow at 200% text scaling`).toBe(false);
    if (title === 'Market') {
      const playerRow = page.getByRole('button', { name: 'View Fixture Available Midfielder details' });
      await expect(playerRow).toBeVisible();
      const playerName = playerRow.locator('.player-card__name');
      const points = playerRow.locator('.market-page__list-points');
      await expect(playerName).toBeVisible();
      await expect(points).toBeVisible();
      const [nameSize, pointsSize] = await Promise.all([
        playerName.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
        points.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
      ]);
      expect(nameSize, 'player name should respond to 200% text scaling').toBeGreaterThanOrEqual(22);
      expect(pointsSize, 'player points should respond to 200% text scaling').toBeGreaterThanOrEqual(22);
    }
  }
});

test('Market and League drawers cover mobile navigation, keep actions visible, and preserve keyboard dismissal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-desktop', 'Drawer and bottom-navigation layering is a mobile contract.');
  await installLayoutFixtures(page, { apiDelayMs: 0 });
  const viewports = [
    { width: 320, height: 780 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ];

  for (const viewport of viewports) {
    await setViewport(page, viewport.width, viewport.height);
    await page.goto('/scouting');
    const nav = page.getByRole('navigation', { name: 'Global mobile navigation' });
    await expect(nav).toBeVisible();

    const marketOpener = page.getByRole('button', { name: 'View Fixture Available Midfielder details' });
    await expect(marketOpener).toBeVisible();
    await marketOpener.click();
    const marketDialog = page.getByRole('dialog', { name: 'Fixture Available Midfielder' });
    await expect(marketDialog).toBeVisible();
    await expectModalAboveNavigation(
      page,
      marketDialog,
      page.locator('.market-page__drawer-layer'),
      '.market-page__drawer-layer',
      nav,
      viewport,
      `Market ${viewport.width}px`,
    );
    const marketFooter = marketDialog.locator('.player-profile__action-bar');
    const addInterest = marketFooter.getByRole('button', { name: 'Add Fixture Available Midfielder to Interests' });
    const marketFooterBox = await bounds(addInterest);
    expectWithinViewport(marketFooterBox, viewport, 'Market drawer footer action');
    await expectModalKeyboardLifecycle(page, marketDialog, marketOpener, 'Market drawer');

    await (await primaryLink(page, 'League')).click();
    await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('League');
    const leagueOpener = page.getByRole('button', { name: 'Open preview for Browser Fixture FC versus River Rangers' });
    await expect(leagueOpener).toBeVisible();
    await leagueOpener.click();
    const leagueDialog = page.getByRole('dialog', { name: 'Browser Fixture FC vs River Rangers' });
    await expect(leagueDialog).toBeVisible();
    await expectModalAboveNavigation(
      page,
      leagueDialog,
      page.locator('.league-drawer'),
      '.league-drawer, .league-drawer-backdrop',
      nav,
      viewport,
      `League drawer ${viewport.width}px`,
    );
    await leagueDialog.locator('.league-drawer__body').evaluate((body) => { body.scrollTop = body.scrollHeight; });
    const closeFixture = leagueDialog.getByRole('button', { name: 'Close fixture detail' });
    const closeFixtureBox = await bounds(closeFixture);
    expectWithinViewport(closeFixtureBox, viewport, 'League drawer close control after scrolling');
    await expectModalKeyboardLifecycle(page, leagueDialog, leagueOpener, 'League drawer');
  }
});

test('commissioner PageHero and bell retain measured bounds in light and dark appearance states across mobile viewports', async ({ page }, testInfo) => {
  const { setThemePreset } = await installLayoutFixtures(page, { apiDelayMs: 0, roles: ['commissioner'] });
  const viewports = testInfo.project.name === 'chromium-desktop'
    ? [{ width: 1280, height: 800 }]
    : [
      { width: 320, height: 780 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ];
  await setViewport(page, viewports[0].width, viewports[0].height);
  await page.goto('/login');

  for (const viewport of viewports) {
    await setViewport(page, viewport.width, viewport.height);
    const themeSurfaces: string[] = [];

    for (const presetName of ['teal-light', 'teal-dark'] as const) {
      setThemePreset(presetName);
      await page.context().clearCookies();
      await page.evaluate(() => window.localStorage.clear());
      await page.context().addCookies([{
        name: 'cdl-theme-preset',
        value: presetName,
        url: new URL(page.url()).origin,
        sameSite: 'Lax',
      }]);
      await page.evaluate((name) => window.localStorage.setItem('cdl-theme-preset', name), presetName);
      await page.goto('/league');
      await expect(page.locator('.app-shell')).toHaveAttribute('data-theme-preset', presetName);
      await expect(page.locator('[data-page-hero="shared"]:visible h1')).toHaveText('League');
      await expect(page.getByRole('button', { name: 'View commissioner management' })).toBeVisible();
      await expect(page.locator('.league-fixtures-view')).toBeVisible();

      const fixtureHeader = await readHeaderBounds(page);
      await expectHeaderDimensions(page, fixtureHeader, viewport);
      themeSurfaces.push(await page.locator('.app-shell').evaluate((shell) => getComputedStyle(shell).backgroundColor));

      await page.getByRole('button', { name: 'View commissioner management' }).click();
      const commissionerRegion = page.getByRole('region', { name: 'Commissioner management' });
      await expect(commissionerRegion).toBeVisible();
      await expect(commissionerRegion.getByRole('heading', { name: 'Invite by team' })).toBeVisible();
      await expect(
        commissionerRegion.getByLabel('League teams').getByText('Open Team', { exact: true }),
      ).toBeVisible();
      const managementHeader = await readHeaderBounds(page);
      await expectHeaderDimensions(page, managementHeader, viewport);
      expectBoundsStable(fixtureHeader.hero, managementHeader.hero, `${presetName} commissioner PageHero`);
      expectBoundsStable(fixtureHeader.bell, managementHeader.bell, `${presetName} commissioner notification`);

      const inviteButton = commissionerRegion.getByRole('button', { name: 'Invite', exact: true });
      await inviteButton.click();
      await expect(commissionerRegion.getByLabel('Open Team invite link')).toHaveValue(/\/join\/browser-invite-token$/);
    }

    expect(themeSurfaces[0], `${viewport.width}px light and dark surfaces should differ`).not.toBe(themeSurfaces[1]);
  }
});

test('adaptive appearance follows the system preference in the browser', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const { setThemePreset } = await installLayoutFixtures(page, { apiDelayMs: 0, themePreset: 'adaptive' });
  setThemePreset('adaptive');
  await page.goto('/profile');
  await expect(page.locator('html')).toHaveAttribute('data-theme-preset', 'adaptive');
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'light');
});

test('Market renders distinct empty and failed-read states with recovery controls', async ({ page }) => {
  await installLayoutFixtures(page, { apiDelayMs: 0 });

  await page.route('**/api/scouting/players', async (route) => {
    await route.fulfill({ json: { players: [] } });
  });
  await page.goto('/scouting');
  await expect(page.getByText('No players found', { exact: true })).toBeVisible();

  await page.unroute('**/api/scouting/players');
  for (const pattern of [
    '**/api/squad/summary',
    '**/api/scouting/players',
    '**/api/interests',
    '**/api/trades',
  ]) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ status: 503, json: { detail: 'Temporary browser fixture outage.' } });
    });
  }
  await page.reload();
  await expect(page.locator('.market-page__error')).toContainText('Market data is temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('trade player cards fit five fixtures and show more cards as the viewport widens', async ({ page }) => {
  await installLayoutFixtures(page, { apiDelayMs: 0 });
  const opponentTeam = { id: 'team-river', name: 'River Rangers', short_name: 'RIV' };
  await page.route('**/api/squad/summary', async (route) => {
    await route.fulfill({ json: {
      manager_team: { id: 'team-browser-fixture', name: 'Browser Fixture FC', short_name: 'BFC' },
      gameweek: { id: 'gw-browser-fixture', name: 'Matchweek 1', number: 1, deadline_at: '2099-01-01T00:00:00Z' },
      players: Array.from({ length: 4 }, (_, index) => ({
        id: `owned-player-${index + 1}`, display_name: `Owned Fixture Player ${index + 1}`,
        position: ['GKP', 'DEF', 'MID', 'FWD'][index], status: 'owned', draft_team: { id: 'team-browser-fixture', name: 'Browser Fixture FC', short_name: 'BFC' },
        epl_team: { id: `club-owned-${index}`, name: `Owned Club ${index}`, short_name: `OC${index}` },
        points: 50, form: 5, value: 5, expected_goals: 0.2, expected_assists: 0.1,
        availability_status: 'a', availability_news: '', chance_of_playing_next_round: 100,
        next_fixture: { fixture_id: 'fixture-browser-1', gameweek: { id: 'gw-browser-fixture', name: 'Matchweek 1', number: 1 }, opponent: { id: 'club-next', name: 'Next Club', short_name: 'NXT' }, difficulty: 3, is_home: true },
      })),
    } });
  });
  const tradeTarget = {
    id: 'trade-target', display_name: 'Trade Fixture Target', position: 'DEF', status: 'owned',
    draft_team: opponentTeam, epl_team: { id: 'club-opponent', name: 'Opponent Club', short_name: 'OPP' },
    points: 60, form: 6, value: 6, expected_goals: 0.2, expected_assists: 0.1,
  };
  await page.route('**/api/scouting/players', async (route) => {
    await route.fulfill({ json: { players: [tradeTarget] } });
  });
  await page.route('**/api/fpl/players/owned-player-1/history', async (route) => {
    await route.fulfill({ json: { history: Array.from({ length: 5 }, (_, index) => ({
      gameweek: index + 1, fixture_id: index + 1, opponent_team_id: 200 + index,
      total_points: 0, minutes: 0, goals_scored: 0, assists: 0, clean_sheets: 0,
      saves: 0, yellow_cards: 0, red_cards: 0, bonus: 0, bps: 0,
      expected_goals: 0, expected_assists: 0, value: 50, was_home: index % 2 === 0,
      opponent_short_name: `OP${index}`,
    })), fixtures: [] } });
  });
  await page.goto('/scouting');
  await page.getByRole('button', { name: 'View Trade Fixture Target details' }).click();
  await page.getByRole('button', { name: 'Propose trade for Trade Fixture Target' }).click();

  for (const name of ['Owned Fixture Player 1', 'Owned Fixture Player 2', 'Owned Fixture Player 3', 'Owned Fixture Player 4']) {
    await page.getByRole('button', { name: `Select ${name}` }).click();
  }

  await page.getByRole('button', { name: 'View as list' }).click();
  await expect(page.locator('.fixture-squad-list__team')).toHaveCount(2);
  await expect(page.locator('[data-player-id="owned-player-1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'View as pitch' }).click();
  await expect(page.locator('.fixture-squad-pitch__field')).toBeVisible();

  const tradeCarousel = page.getByRole('region', { name: 'Selected trade players' }).getByRole('region', { name: 'Trade player cards' });
  const viewport = tradeCarousel.locator('.ui-carousel__viewport');
  const slides = tradeCarousel.locator('.market-page__selected-carousel-slide');
  await expect(slides).toHaveCount(5);
  await expect(tradeCarousel.locator('.market-page__selected-player-card')).toHaveCount(5);
  await expect(tradeCarousel.locator('.market-page__selected-player-card [data-testid="trade-player-comparison"]')).toHaveCount(5);
  await expect(tradeCarousel.locator('.market-page__carousel-dot')).toHaveCount(5);
  await expect(tradeCarousel.locator('.market-page__carousel-dot--out')).toHaveCount(4);
  await expect(tradeCarousel.locator('.market-page__carousel-dot--in')).toHaveCount(1);
  await expect(tradeCarousel.locator('.market-page__selected-player-card .player-card--token')).toHaveCount(5);
  await expect(tradeCarousel.locator('.market-page__selected-player-header').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))).resolves.toEqual([
    'Player card for Owned Fixture Player 1',
    'Player card for Trade Fixture Target',
    'Player card for Owned Fixture Player 2',
    'Player card for Owned Fixture Player 3',
    'Player card for Owned Fixture Player 4',
  ]);
  const firstCard = tradeCarousel.locator('.market-page__selected-player-card').first();
  const firstPlayerHeader = firstCard.locator('.market-page__selected-player-header');
  const [cardBox, headerBox] = await Promise.all([firstCard.boundingBox(), firstPlayerHeader.boundingBox()]);
  expect(cardBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(Math.abs((headerBox!.x + headerBox!.width / 2) - (cardBox!.x + cardBox!.width / 2))).toBeLessThanOrEqual(3);
  const firstChart = tradeCarousel.locator('.market-page__selected-player-card [data-chart-kind="combined-form-minutes"]').first();
  await expect(firstChart).toHaveAttribute('data-fixture-count', '5');
  await expect(firstChart.locator('.player-profile__combined-chart-column')).toHaveCount(5);
  await expect(firstChart.locator('.player-profile__combined-negative .player-profile__chart-value')).toHaveText(['0', '0', '0', '0', '0']);
  expect(await firstChart.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(await firstChart.evaluate((element) => element.clientWidth) + 1);
  const next = tradeCarousel.getByRole('button', { name: 'Next trade players' });
  await expect(next).toBeEnabled();
  const [viewportBox, slideBoxes] = await Promise.all([
    viewport.boundingBox(),
    slides.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    })),
  ]);
  expect(viewportBox).not.toBeNull();
  expect(slideBoxes[0].x + slideBoxes[0].width).toBeLessThanOrEqual(viewportBox!.x + viewportBox!.width);
  expect(slideBoxes[1].x + slideBoxes[1].width).toBeLessThanOrEqual(viewportBox!.x + viewportBox!.width);
  const visibleSlideCount = slideBoxes.filter((box) => box.x < viewportBox!.x + viewportBox!.width - 1 && box.x + box.width > viewportBox!.x + 1).length;
  expect(visibleSlideCount).toBeGreaterThanOrEqual(2);
  if (page.viewportSize()!.width > 1100) expect(visibleSlideCount).toBeGreaterThanOrEqual(3);

  const secondCardStart = await slides.nth(1).evaluate((element) => element.getBoundingClientRect().x);
  await next.click();
  await expect.poll(() => slides.nth(1).evaluate((element) => element.getBoundingClientRect().x)).toBeLessThan(secondCardStart);
});

test('league Teams showcase selects each real crest and fits a mobile viewport', async ({ page }) => {
  const teams = [
    ['team-stan-still-sells-tik', 'Stan Still Sells Tik'],
    ['team-wilde-boars', 'Wilde Boars'],
    ['team-bayer-neverlusen', 'Bayer Neverlusen'],
    ['team-class-of-84', 'Class of 84'],
    ['team-sporting-lesbians', 'Sporting Lesbians'],
    ['team-dicks-dribbling-xi', 'Dicks Dribbling XI'],
    ['team-koden-all-stars', 'Koden All Stars'],
    ['team-exeter-gently', 'Exeter Gently'],
  ];
  await installLayoutFixtures(page, { leagueTeams: teams });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/league/table');
  await expect(page.getByRole('heading', { name: 'League table' })).toBeVisible();
  await page.getByRole('button', { name: 'Teams', exact: true }).click();
  await expect(page).toHaveURL(/\/league\/teams$/);

  await expect(page.locator('.league-team-showcase__team')).toHaveCount(8);
  await expect(page.locator('.league-team-showcase__animation canvas')).toBeVisible();
  for (const [, name] of teams) {
    const teamButton = page.locator('.league-team-showcase__team').filter({ hasText: name });
    await teamButton.click();
    await expect(page.locator('.league-team-showcase__stage h2')).toHaveText(name);
    await expect(teamButton).toHaveAttribute('aria-pressed', 'true');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
