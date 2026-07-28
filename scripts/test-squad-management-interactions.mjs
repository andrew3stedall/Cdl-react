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

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') {
      return route.fulfill({ json: authenticatedSession });
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

async function testSquadInterestPersistence(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await mockApi(page);

  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await expectStatus(page, 'Squad data loaded.');

  const search = page.getByRole('textbox', { name: 'Search players' });
  await search.fill('Casey');
  await page.getByRole('button', { name: 'Interest', exact: true }).click();
  await expectStatus(page, 'Casey Midfielder added to interests.');

  const interests = page.locator('section[aria-label="Interests and proposed trades"]');
  await interests.getByText('Casey Midfielder', { exact: true }).waitFor();

  await page.reload({ waitUntil: 'networkidle' });
  await expectStatus(page, 'Squad data loaded.');
  await interests.getByText('Casey Midfielder', { exact: true }).waitFor();

  await page.getByRole('textbox', { name: 'Search players' }).fill('Casey');
  await page.getByRole('button', { name: 'Interest', exact: true }).click();
  await expectStatus(page, 'Casey Midfielder is already registered as an interest.');

  const persistedEntries = interests.getByText('Casey Midfielder', { exact: true });
  if (await persistedEntries.count() !== 1) {
    throw new Error('Expected the invalid duplicate interest mutation to leave one persisted entry');
  }

  await context.close();
}

async function run() {
  const browser = await chromium.launch();
  const viewports = [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await testSquadInterestPersistence(browser, viewport);
  }

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
