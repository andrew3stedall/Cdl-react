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

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await mockApi(page);

  await testTeamSelection(page);

  await context.close();
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
