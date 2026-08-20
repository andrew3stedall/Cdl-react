import { mkdir } from 'node:fs/promises';

import { chromium } from 'playwright';

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173';
const reviewCaptureDirectory = 'artifacts/app-screenshots/mobile';

const authenticatedSession = {
  is_authenticated: true,
  user: {
    id: 'browser-manager',
    email: 'manager@example.com',
    display_name: 'Browser Manager',
    roles: ['manager'],
  },
  expires_at: '2099-01-01T00:00:00Z',
};

const managerTeam = { id: 'team-exeter-gently', name: 'Exeter Gently', short_name: 'EXE' };
const rivalTeam = { id: 'team-castle', name: 'Castle FC', short_name: 'CAS' };

const squadSummary = {
  manager_team: managerTeam,
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadline_at: '2026-08-14T17:30:00Z' },
  players: [
    {
      id: 'player-1',
      display_name: 'Alex Keeper',
      position: 'GKP',
      epl_team: { id: 'ars', name: 'Arsenal', short_name: 'ARS' },
      draft_team: managerTeam,
      status: 'owned',
      points: 48,
      form: 5.6,
      value: 5.0,
      selected_by_percent: 18.2,
    },
    {
      id: 'player-4',
      display_name: 'Dev Forward',
      position: 'FWD',
      epl_team: { id: 'mci', name: 'Manchester City', short_name: 'MCI' },
      draft_team: managerTeam,
      status: 'owned',
      points: 57,
      form: 7.1,
      value: 8.5,
      selected_by_percent: 32.0,
    },
  ],
};

const teamSelection = {
  manager_team: managerTeam,
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadline_at: '2026-08-14T17:30:00Z' },
  lineup: [
    {
      id: 'player-1',
      display_name: 'Alex Keeper',
      position: 'GKP',
      epl_team: { id: 'ars', name: 'Arsenal', short_name: 'ARS' },
      slot: 'starter',
      slot_order: 1,
      is_captain: true,
      is_vice_captain: false,
    },
    {
      id: 'player-4',
      display_name: 'Dev Forward',
      position: 'FWD',
      epl_team: { id: 'mci', name: 'Manchester City', short_name: 'MCI' },
      slot: 'starter',
      slot_order: 1,
      is_captain: false,
      is_vice_captain: true,
    },
  ],
  chips: [],
  fixture_lock: {
    locked: false,
    fixture_id: null,
    fixture_type: null,
    lock_scope: null,
    locked_at: null,
    reason: null,
  },
};

const scoutingPlayers = {
  players: [
    ...squadSummary.players,
    {
      id: 'player-3',
      display_name: 'Casey Midfielder',
      position: 'MID',
      epl_team: { id: 'che', name: 'Chelsea', short_name: 'CHE' },
      draft_team: null,
      status: 'available',
      points: 61,
      form: 8.0,
      value: 7.5,
      selected_by_percent: 28.0,
    },
    {
      id: 'player-5',
      display_name: 'Rival Winger',
      position: 'MID',
      epl_team: { id: 'liv', name: 'Liverpool', short_name: 'LIV' },
      draft_team: rivalTeam,
      status: 'owned',
      points: 64,
      form: 7.8,
      value: 8.1,
      selected_by_percent: 24.0,
    },
  ],
};

async function mockApi(page) {
  const interests = [];
  const trades = [];
  let attackDirection = 'up';
  let fdrScale = 'RdYlGn';
  let fdrScaleReversed = true;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/auth/session') return route.fulfill({ json: authenticatedSession });
    if (path === '/api/me/preferences' && request.method() === 'GET') {
      return route.fulfill({
        json: {
          theme_preset: 'teal-light',
          attack_direction: attackDirection,
          fdr_scale: fdrScale,
          fdr_scale_reversed: fdrScaleReversed,
        },
      });
    }
    if (path === '/api/me/preferences' && request.method() === 'PUT') {
      const preferences = request.postDataJSON();
      attackDirection = preferences.attack_direction;
      fdrScale = preferences.fdr_scale;
      fdrScaleReversed = preferences.fdr_scale_reversed;
      return route.fulfill({
        json: {
          theme_preset: 'teal-light',
          attack_direction: attackDirection,
          fdr_scale: fdrScale,
          fdr_scale_reversed: fdrScaleReversed,
        },
      });
    }
    if (path === '/api/squad/workspace') {
      return route.fulfill({
        json: {
          summary: squadSummary,
          notifications: { notifications: [], proposed_trade_count: trades.filter((trade) => trade.status === 'proposed').length },
        },
      });
    }
    if (path === '/api/squad/summary') return route.fulfill({ json: squadSummary });
    if (path === '/api/team-selection') return route.fulfill({ json: teamSelection });
    if (path === '/api/scouting/players') return route.fulfill({ json: scoutingPlayers });
    if (path === '/api/squad/changes' && request.method() === 'GET') {
      return route.fulfill({ json: { available_to_add: scoutingPlayers.players.filter((player) => player.status === 'available') } });
    }
    if (path === '/api/squad/changes' && request.method() === 'POST') {
      return route.fulfill({ json: squadSummary });
    }

    if (path === '/api/interests' && request.method() === 'GET') {
      return route.fulfill({ json: interests });
    }
    if (path === '/api/interests' && request.method() === 'POST') {
      const body = request.postDataJSON();
      if (interests.some((interest) => interest.player.id === body.player_id)) {
        return route.fulfill({
          status: 422,
          json: { code: 'validation_error', message: 'Interest already exists.', issues: [] },
        });
      }
      const interest = {
        id: 'interest-browser-casey',
        player: scoutingPlayers.players.find((player) => player.id === body.player_id),
        gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
        note: null,
      };
      interests.push(interest);
      return route.fulfill({ json: interest });
    }

    if (path === '/api/trades' && request.method() === 'GET') {
      return route.fulfill({ json: { trades } });
    }

    if (path === '/api/health' || path === '/health') return route.fulfill({ json: { status: 'ok' } });
    if (path === '/api/contracts/theme-presets') return route.fulfill({ json: { presets: [] } });
    return route.fulfill({ json: {} });
  });
}

async function captureReviewState(page, viewport, name) {
  if (viewport.width !== 390) return;
  await mkdir(reviewCaptureDirectory, { recursive: true });
  await page.screenshot({ path: `${reviewCaptureDirectory}/${name}.png` });
}

async function testSquadWorkspace(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });

  await page.getByRole('status').getByText('Exeter Gently squad ready for review.', { exact: true }).waitFor();
  const pitch = page.locator('section[aria-label="Squad pitch"]');
  await pitch.waitFor();
  const upwardsRows = pitch.locator('.squad-page__pitch-row');
  if (!await upwardsRows.first().getAttribute('class').then((value) => value?.includes('position-fwd'))) {
    throw new Error('Attack upwards should place forwards at the top of the pitch');
  }
  if (!await upwardsRows.last().getAttribute('class').then((value) => value?.includes('position-gkp'))) {
    throw new Error('Attack upwards should place the goalkeeper at the bottom of the pitch');
  }
  const upwardsFieldPosition = await pitch.locator('.squad-page__pitch-field').evaluate((element) => {
    const field = element.getBoundingClientRect();
    const pitchElement = element.closest('.squad-page__pitch')?.getBoundingClientRect();
    return pitchElement
      ? { fieldBottom: field.bottom, fieldTop: field.top, pitchBottom: pitchElement.bottom, pitchTop: pitchElement.top, transform: getComputedStyle(element).transform }
      : null;
  });
  if (!upwardsFieldPosition || upwardsFieldPosition.transform !== 'none' || Math.abs(upwardsFieldPosition.fieldBottom - upwardsFieldPosition.pitchBottom) > 1 || upwardsFieldPosition.fieldTop >= upwardsFieldPosition.pitchTop) {
    throw new Error(`Attack upwards should anchor the untransformed pitch field at the bottom (received ${JSON.stringify(upwardsFieldPosition)})`);
  }
  const upwardsGoalBoxPositions = await pitch.locator('.squad-page__pitch-markings span:nth-child(3), .squad-page__pitch-markings span:nth-child(4)').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  const upwardsCircleTop = await pitch.locator('.squad-page__pitch-markings span:nth-child(2)').evaluate((element) => element.getBoundingClientRect().top);
  if (!(upwardsCircleTop < upwardsGoalBoxPositions[1])) {
    throw new Error('Attack upwards should place the centre circle above the bottom goal-box marking');
  }
  const upwardsCircleGeometry = await pitch.locator('.squad-page__pitch-markings span:nth-child(2)').evaluate((element) => {
    const circle = element.getBoundingClientRect();
    const halfwayLine = element.parentElement?.querySelector('span:nth-child(1)')?.getBoundingClientRect();
    const pitchElement = element.closest('.squad-page__pitch')?.getBoundingClientRect();
    return pitchElement && halfwayLine
      ? {
        circleBottom: circle.bottom,
        circleCenter: (circle.top + circle.bottom) / 2,
        circleTop: circle.top,
        halfwayLineCenter: (halfwayLine.top + halfwayLine.bottom) / 2,
        pitchBottom: pitchElement.bottom,
        pitchTop: pitchElement.top,
      }
      : null;
  });
  if (!upwardsCircleGeometry
    || upwardsCircleGeometry.circleTop < upwardsCircleGeometry.pitchTop
    || upwardsCircleGeometry.circleBottom > upwardsCircleGeometry.pitchBottom
    || Math.abs(upwardsCircleGeometry.circleCenter - upwardsCircleGeometry.halfwayLineCenter) > 1) {
    throw new Error(`Attack upwards should keep the centre circle fully visible and bisected by the halfway line (received ${JSON.stringify(upwardsCircleGeometry)})`);
  }
  const upwardsPitchOutlineTop = await pitch.locator('.squad-page__pitch').evaluate((element) => Number.parseFloat(getComputedStyle(element, '::before').top));
  if (!(upwardsPitchOutlineTop < 0)) {
    throw new Error(`Attack upwards should extend the pitch perimeter beyond the top of the pitch container (received ${upwardsPitchOutlineTop})`);
  }
  const upwardsGoalBoxBottomOffset = await pitch.locator('.squad-page__pitch-markings span:nth-child(4)').evaluate((element) => {
    const pitchElement = element.closest('.squad-page__pitch');
    if (!pitchElement) return null;
    const pitchStyles = getComputedStyle(pitchElement);
    const pitchOutlineStyles = getComputedStyle(pitchElement, '::before');
    const outlineBottom = pitchElement.getBoundingClientRect().bottom
      - parseFloat(pitchStyles.borderBottomWidth)
      - parseFloat(pitchOutlineStyles.bottom);
    return element.getBoundingClientRect().bottom - outlineBottom;
  });
  if (upwardsGoalBoxBottomOffset === null || Math.abs(upwardsGoalBoxBottomOffset) > 2) {
    throw new Error(`Attack upwards should bring the bottom goal-box marking into contact with the pitch outline (received ${upwardsGoalBoxBottomOffset})`);
  }

  await page.goto(`${baseUrl}/account`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /RdYlGn/ }).click();
  await page.locator('.profile-fdr-scale-option').filter({ hasText: 'Viridis' }).click();
  await page.getByRole('status').getByText('Appearance preference saved.', { exact: true }).waitFor();
  await page.locator('.profile-fdr-reverse-toggle input').click();
  await page.getByRole('status').getByText('Appearance preference saved.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Attack downwards/ }).click();
  await page.getByRole('status').getByText('Appearance preference saved.', { exact: true }).waitFor();
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });
  const downPitch = page.locator('section[aria-label="Squad pitch"]');
  await downPitch.waitFor();
  const downwardsRows = downPitch.locator('.squad-page__pitch-row');
  if (!await downwardsRows.first().getAttribute('class').then((value) => value?.includes('position-gkp'))) {
    throw new Error('Attack downwards should place the goalkeeper at the top of the pitch');
  }
  if (!await downwardsRows.last().getAttribute('class').then((value) => value?.includes('position-fwd'))) {
    throw new Error('Attack downwards should place forwards at the bottom of the pitch');
  }
  const downwardsFieldPosition = await downPitch.locator('.squad-page__pitch-field').evaluate((element) => {
    const field = element.getBoundingClientRect();
    const pitchElement = element.closest('.squad-page__pitch')?.getBoundingClientRect();
    return pitchElement
      ? { fieldBottom: field.bottom, fieldTop: field.top, pitchBottom: pitchElement.bottom, pitchTop: pitchElement.top, transform: getComputedStyle(element).transform }
      : null;
  });
  if (!downwardsFieldPosition || downwardsFieldPosition.transform !== 'none' || Math.abs(downwardsFieldPosition.fieldTop - downwardsFieldPosition.pitchTop) > 1 || downwardsFieldPosition.fieldBottom <= downwardsFieldPosition.pitchBottom) {
    throw new Error(`Attack downwards should anchor the untransformed pitch field at the top (received ${JSON.stringify(downwardsFieldPosition)})`);
  }
  const downwardsGoalBoxPositions = await downPitch.locator('.squad-page__pitch-markings span:nth-child(3), .squad-page__pitch-markings span:nth-child(4)').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  const downwardsCircleGeometry = await downPitch.locator('.squad-page__pitch-markings span:nth-child(2)').evaluate((element) => {
    const circle = element.getBoundingClientRect();
    const halfwayLine = element.parentElement?.querySelector('span:nth-child(1)')?.getBoundingClientRect();
    const pitchElement = element.closest('.squad-page__pitch')?.getBoundingClientRect();
    return pitchElement && halfwayLine
      ? {
        circleBottom: circle.bottom,
        circleCenter: (circle.top + circle.bottom) / 2,
        circleTop: circle.top,
        halfwayLineCenter: (halfwayLine.top + halfwayLine.bottom) / 2,
        pitchBottom: pitchElement.bottom,
        pitchTop: pitchElement.top,
      }
      : null;
  });
  if (!(downwardsGoalBoxPositions[0] < downwardsCircleGeometry?.circleTop)) {
    throw new Error('Attack downwards should place the top goal-box marking above the centre circle');
  }
  if (!downwardsCircleGeometry
    || downwardsCircleGeometry.circleTop < downwardsCircleGeometry.pitchTop
    || downwardsCircleGeometry.circleBottom > downwardsCircleGeometry.pitchBottom
    || Math.abs(downwardsCircleGeometry.circleCenter - downwardsCircleGeometry.halfwayLineCenter) > 1) {
    throw new Error(`Attack downwards should keep the centre circle fully visible and bisected by the halfway line (received ${JSON.stringify(downwardsCircleGeometry)})`);
  }
  const downwardsPitchOutlineTop = await downPitch.locator('.squad-page__pitch').evaluate((element) => Number.parseFloat(getComputedStyle(element, '::before').top));
  if (!(downwardsPitchOutlineTop < 0)) {
    throw new Error(`Attack downwards should extend the pitch perimeter beyond the top of the pitch container (received ${downwardsPitchOutlineTop})`);
  }
  const downwardsGoalBoxTopOffset = await downPitch.locator('.squad-page__pitch-markings span:nth-child(3)').evaluate((element) => {
    const pitchElement = element.closest('.squad-page__pitch');
    if (!pitchElement) return null;
    const pitchStyles = getComputedStyle(pitchElement);
    const pitchOutlineStyles = getComputedStyle(pitchElement, '::before');
    const outlineTop = pitchElement.getBoundingClientRect().top
      + parseFloat(pitchStyles.borderTopWidth)
      + parseFloat(pitchOutlineStyles.top);
    return outlineTop - element.getBoundingClientRect().top;
  });
  if (downwardsGoalBoxTopOffset === null || Math.abs(downwardsGoalBoxTopOffset) > 2) {
    throw new Error(`Attack downwards should keep the top goal-box marking in contact with the pitch outline (received ${downwardsGoalBoxTopOffset})`);
  }
  await captureReviewState(page, viewport, 'squad-reference-pitch');
  await pitch.getByRole('button', { name: 'View Alex Keeper details' }).click();

  const playerDrawer = page.locator('.squad-page__drawer--profile');
  await playerDrawer.getByRole('toolbar', { name: 'Squad-management actions' }).waitFor();
  await playerDrawer.locator('.player-profile__shirt-token').waitFor();
  const profileCoverage = await playerDrawer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const navigation = document.querySelector('.global-mobile-navigation');
    const navigationRect = navigation?.getBoundingClientRect();
    const bottomElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 2);
    return {
      bottom: rect.bottom,
      bottomElementInsideDrawer: bottomElement instanceof Element && Boolean(bottomElement.closest('.squad-page__drawer--profile')),
      height: rect.height,
      left: rect.left,
      navigationTop: navigationRect?.top ?? null,
      top: rect.top,
      width: rect.width,
    };
  });
  if (profileCoverage.left > 1 || profileCoverage.top > 1 || profileCoverage.width < viewport.width - 1 || profileCoverage.height < viewport.height - 1 || !profileCoverage.bottomElementInsideDrawer) {
    throw new Error(`Expected the player profile to replace the full viewport and cover mobile navigation (received ${JSON.stringify(profileCoverage)})`);
  }
  await captureReviewState(page, viewport, 'squad-reference-player-drawer');
  await playerDrawer.getByRole('button', { name: 'Open player actions' }).click();
  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/scouting/players'),
    playerDrawer.getByRole('menuitem', { name: 'Compare player' }).click(),
  ]);

  const comparisonSearch = page.getByRole('textbox', { name: 'Search comparison players' });
  await comparisonSearch.fill('Rival Winger');
  await page.getByText('Rival Winger', { exact: true }).waitFor();
  await page.getByRole('button').filter({ hasText: 'Rival Winger' }).last().click();
  const comparisonCards = page.locator('.squad-page__compare-card');
  if (await comparisonCards.count() !== 2) throw new Error('Expected two comparison cards');
  await comparisonCards.nth(0).getByText('Alex Keeper', { exact: true }).waitFor();
  await comparisonCards.nth(1).getByText('Rival Winger', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Close drawer', exact: true }).last().click();
  await pitch.getByRole('button', { name: 'View Alex Keeper details' }).click();
  const profileAfterCompare = page.locator('.squad-page__drawer--profile');
  await profileAfterCompare.getByRole('button', { name: 'Remove' }).click();
  await profileAfterCompare.getByRole('heading', { name: 'Remove player' }).waitFor();
  await captureReviewState(page, viewport, 'squad-reference-remove-action');
  await profileAfterCompare.getByRole('dialog', { name: 'Remove player' }).getByRole('button', { name: 'Close action dialog' }).click();
  await profileAfterCompare.getByRole('button', { name: 'Close player profile' }).click();

  await page.getByRole('button', { name: 'View as list' }).click();
  await page.locator('[aria-label="Starting XI players table"]').waitFor();
  await captureReviewState(page, viewport, 'squad-reference-list');
  await context.close();
}

async function testMarketPersistence(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`${baseUrl}/scouting`, { waitUntil: 'networkidle' });

  const search = page.getByRole('textbox', { name: 'Search market players' });
  await search.fill('Casey');
  await page.getByRole('button', { name: 'Add Casey Midfielder to Interests' }).click();
  await page.getByRole('status').getByText('Casey Midfielder added to Interests.', { exact: true }).waitFor();

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Interests' }).click();
  await page.locator('section[aria-label="Your Interests"]').getByText('Casey Midfielder', { exact: true }).waitFor();

  await context.close();
}

async function run() {
  const browser = await chromium.launch();
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await testSquadWorkspace(browser, viewport);
  }
  await testMarketPersistence(browser);
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
