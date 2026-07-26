import { chromium } from 'playwright';

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173';

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path === '/api/health' || path === '/health') {
      return route.fulfill({ json: { status: 'ok' } });
    }

    if (path === '/api/contracts/theme-presets') {
      return route.fulfill({ json: { presets: [] } });
    }

    return route.fulfill({ status: 404, json: { error: `No interaction-test mock for ${path}` } });
  });
}

async function expectStatus(page, expected) {
  const status = page.getByRole('status');
  await status.waitFor({ state: 'visible' });
  const message = (await status.textContent()) ?? '';

  if (!message.includes(expected)) {
    throw new Error(`Expected status to include "${expected}", received "${message.trim()}"`);
  }
}

async function testTeamSelection(page) {
  await page.goto(`${baseUrl}/team-selection`, { waitUntil: 'networkidle' });
  await expectStatus(page, 'Team selection loaded.');

  const alexSlot = page.getByLabel('Move Alex Keeper');
  await alexSlot.selectOption('bench');
  await expectStatus(page, 'Player moved to bench.');

  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Invalid lineup.');

  await alexSlot.selectOption('starter');
  await expectStatus(page, 'Player moved to starter.');

  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Lineup saved and validated.');
}

async function testSquadManagement(page) {
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });
  await expectStatus(page, 'Squad data loaded.');

  const search = page.getByRole('textbox', { name: 'Search players' });
  await search.fill('Casey');

  await page.getByRole('button', { name: 'Interest' }).click();
  await expectStatus(page, 'Casey Midfielder added to interests.');

  const interests = page.locator('section[aria-label="Interests and proposed trades"]');
  await interests.getByText('Casey Midfielder', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Casey Midfielder', exact: true }).click();
  const playerDialog = page.getByRole('dialog', { name: 'Player detail' });
  await playerDialog.getByRole('heading', { name: 'Casey Midfielder' }).waitFor();
  await playerDialog.getByText('Points: 61 · Value: £7.5m', { exact: true }).waitFor();
  await playerDialog.getByRole('button', { name: 'Close' }).click();
  await playerDialog.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: 'Propose sample trade' }).click();
  await page.getByText('Trade proposal created.', { exact: false }).waitFor();

  const rulesLink = page.getByRole('link', { name: 'Trade Window' });
  const href = await rulesLink.getAttribute('href');
  if (href !== '/rules#trade-window') {
    throw new Error(`Expected Trade Window link to target /rules#trade-window, received "${href}"`);
  }
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await mockApi(page);

  await testTeamSelection(page);
  await testSquadManagement(page);

  await context.close();
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
