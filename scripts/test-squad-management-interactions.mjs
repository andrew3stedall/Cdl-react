import { chromium } from 'playwright';

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173';

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
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
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
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
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
      slot: 'bench',
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

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/auth/session') return route.fulfill({ json: authenticatedSession });
    if (path === '/api/squad/summary') return route.fulfill({ json: squadSummary });
    if (path === '/api/team-selection') return route.fulfill({ json: teamSelection });
    if (path === '/api/scouting/players') return route.fulfill({ json: scoutingPlayers });

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

async function testSquadWorkspace(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });

  await page.getByRole('status').getByText('Exeter Gently squad ready for review.', { exact: true }).waitFor();
  const pitch = page.locator('section[aria-label="Squad pitch"]');
  await pitch.waitFor();
  await pitch.getByRole('button', { name: 'View Alex Keeper details' }).click();

  const playerDrawer = page.locator('.squad-page__drawer');
  await playerDrawer.getByText('Release to Free Agency', { exact: true }).waitFor();
  await playerDrawer.getByRole('button', { name: 'Compare', exact: true }).click();

  const comparisonSearch = page.getByRole('textbox', { name: 'Search comparison players' });
  await comparisonSearch.fill('Rival Winger');
  await page.getByRole('button').filter({ hasText: 'Rival Winger' }).last().click();
  const comparisonCards = page.locator('.squad-page__compare-card');
  if (await comparisonCards.count() !== 2) throw new Error('Expected two comparison cards');
  await comparisonCards.nth(0).getByText('Alex Keeper', { exact: true }).waitFor();
  await comparisonCards.nth(1).getByText('Rival Winger', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Close drawer', exact: true }).last().click();
  await pitch.getByRole('button', { name: 'View Alex Keeper details' }).click();
  await page.getByRole('button', { name: 'Release to Free Agency', exact: true }).click();

  const changes = page.locator('aside[aria-label="Squad changes"]');
  await changes.getByText('Pending Removal', { exact: true }).waitFor();
  await changes.getByText('Removed', { exact: true }).waitFor();
  await changes.getByText('Alex Keeper', { exact: true }).waitFor();
  await changes.getByRole('button', { name: 'Submit Squad Changes', exact: true }).click();
  const review = page.getByRole('dialog');
  await review.getByText('Add 1 draw-won player before confirming.', { exact: true }).waitFor();
  await review.getByRole('button', { name: 'Back', exact: true }).click();
  await changes.getByRole('button', { name: 'Restore to Squad', exact: true }).click();
  await page.getByRole('status').getByText('Alex Keeper restored to the squad.', { exact: true }).waitFor();
  await changes.getByRole('button', { name: /Squad Changes/ }).click();

  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.locator('[aria-label="Squad players table"]').waitFor();
  await context.close();
}

async function testMarketPersistence(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`${baseUrl}/scouting`, { waitUntil: 'networkidle' });

  await page.getByRole('tab', { name: /Player pool/ }).click();
  const search = page.getByRole('textbox', { name: 'Search players' });
  await search.fill('Casey');
  await page.getByRole('button', { name: 'Add Casey Midfielder to interests' }).click();
  await page.getByRole('status').getByText('Casey Midfielder added to interests.', { exact: true }).waitFor();

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Activity/ }).click();
  await page.locator('section[aria-label="Interests and proposed trades"]').getByText('Casey Midfielder', { exact: true }).waitFor();

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