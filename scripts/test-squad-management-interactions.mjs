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

const squadSummary = {
  manager_team: { id: 'team-exeter-gently', name: 'Exeter Gently' },
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
  players: [
    { id: 'player-1', display_name: 'Alex Keeper', position: 'GKP', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'owned', points: 48, value: 5.0 },
  ],
};

const scoutingPlayers = {
  players: [
    ...squadSummary.players,
    { id: 'player-3', display_name: 'Casey Midfielder', position: 'MID', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'available', points: 61, value: 7.5 },
  ],
};

function browserTrade() {
  return {
    id: 'trade-browser-1',
    status: 'proposed',
    assets: [
      { player: { id: 'player-1', display_name: 'Alex Keeper' } },
      { player: { id: 'player-4', display_name: 'Dev Forward' } },
    ],
  };
}

async function mockApi(page) {
  const interests = [];
  const trades = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/session') {
      return route.fulfill({ json: authenticatedSession });
    }
    if (path === '/api/squad/summary') {
      return route.fulfill({ json: squadSummary });
    }
    if (path === '/api/scouting/players') {
      return route.fulfill({ json: scoutingPlayers });
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
        player: { id: 'player-3', display_name: 'Casey Midfielder' },
        gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
        note: null,
      };
      interests.push(interest);
      return route.fulfill({ json: interest });
    }
    if (path === '/api/trades' && request.method() === 'GET') {
      return route.fulfill({ json: { trades } });
    }
    if (path === '/api/trades' && request.method() === 'POST') {
      if (trades.length > 0) {
        return route.fulfill({
          status: 422,
          json: { code: 'validation_error', message: 'Trade proposal already exists.', issues: [] },
        });
      }
      const trade = browserTrade();
      trades.push(trade);
      return route.fulfill({ json: trade });
    }
    if (path === '/api/health' || path === '/health') {
      return route.fulfill({ json: { status: 'ok' } });
    }
    if (path === '/api/contracts/theme-presets') {
      return route.fulfill({ json: { presets: [] } });
    }
    return route.fulfill({ json: {} });
  });
}

async function expectStatus(page, expected) {
  await page.getByRole('status').getByText(expected, { exact: true }).waitFor();
}

async function testSquadPersistence(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });
  await expectStatus(page, 'Exeter Gently loaded from staging PostgreSQL.');

  const search = page.getByRole('textbox', { name: 'Search players' });
  await search.fill('Casey');
  await page.getByRole('button', { name: 'Interest', exact: true }).click();
  await expectStatus(page, 'Casey Midfielder added to interests.');

  const activity = page.locator('section[aria-label="Interests and proposed trades"]');
  await activity.getByText('Casey Midfielder', { exact: true }).waitFor();

  const createdTrade = await page.evaluate(async () => {
    const response = await fetch('/api/trades', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offered_player_id: 'player-1', requested_player_id: 'player-4' }),
    });
    return { ok: response.ok, payload: await response.json() };
  });
  if (!createdTrade.ok) {
    throw new Error(`Expected Trade proposal created. Received ${JSON.stringify(createdTrade.payload)}`);
  }

  await page.reload({ waitUntil: 'networkidle' });
  await expectStatus(page, 'Exeter Gently loaded from staging PostgreSQL.');
  await activity.getByText('Casey Midfielder', { exact: true }).waitFor();
  await activity.getByText('Trade proposed: Alex Keeper ↔ Dev Forward', { exact: true }).waitFor();

  await page.getByRole('textbox', { name: 'Search players' }).fill('Casey');
  await page.getByRole('button', { name: 'Interest', exact: true }).click();
  await expectStatus(page, 'Interest already exists.');
  if (await activity.getByText('Casey Midfielder', { exact: true }).count() !== 1) {
    throw new Error('Expected the rejected duplicate interest to leave persisted server state unchanged');
  }

  const duplicateTrade = await page.evaluate(async () => {
    const response = await fetch('/api/trades', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offered_player_id: 'player-1', requested_player_id: 'player-4' }),
    });
    return { status: response.status, payload: await response.json() };
  });
  if (duplicateTrade.status !== 422 || duplicateTrade.payload.message !== 'Trade proposal already exists.') {
    throw new Error(`Expected Trade proposal already exists. Received ${JSON.stringify(duplicateTrade)}`);
  }
  if (await activity.getByText('Trade proposed: Alex Keeper ↔ Dev Forward', { exact: true }).count() !== 1) {
    throw new Error('Expected the rejected duplicate trade to leave persisted server state unchanged');
  }

  await context.close();
}

async function testUnauthorizedMutations(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/session') {
      return route.fulfill({ json: authenticatedSession });
    }
    if (path === '/api/squad/summary') {
      return route.fulfill({ json: squadSummary });
    }
    if (path === '/api/scouting/players') {
      return route.fulfill({ json: scoutingPlayers });
    }
    if (path === '/api/interests' && request.method() === 'GET') {
      return route.fulfill({ json: [] });
    }
    if (path === '/api/trades' && request.method() === 'GET') {
      return route.fulfill({ json: { trades: [] } });
    }
    if (
      (path === '/api/interests' || path === '/api/trades')
      && request.method() === 'POST'
    ) {
      return route.fulfill({ status: 401, json: { detail: 'Authentication required.' } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: 'Search players' }).fill('Casey');
  await page.getByRole('button', { name: 'Interest', exact: true }).click();
  await expectStatus(page, 'Authentication required.');
  await page.getByText('No interests registered yet.', { exact: true }).waitFor();

  await context.close();
}

async function run() {
  const browser = await chromium.launch();
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await testSquadPersistence(browser, viewport);
  }
  await testUnauthorizedMutations(browser);
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
