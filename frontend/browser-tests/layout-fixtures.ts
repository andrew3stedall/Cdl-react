import type { Page } from '@playwright/test';

/**
 * Keeps browser layout checks on the same authenticated shell fixture as
 * current-contract.spec.ts while allowing the page's real loading/error states
 * to settle without needing backend services.
 */
export async function installLayoutFixtures(page: Page, apiDelayMs = 900) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') {
      await route.fulfill({
        json: {
          is_authenticated: true,
          user: {
            id: 'layout-manager',
            email: 'layout@example.test',
            display_name: 'Layout Fixture',
            roles: ['manager'],
          },
          expires_at: '2099-01-01T00:00:00Z',
        },
      });
      return;
    }
    if (path === '/api/auth/google/config') {
      await route.fulfill({ json: { enabled: false, client_id: null } });
      return;
    }
    if (path === '/api/auth/apple/config') {
      await route.fulfill({ json: { enabled: false } });
      return;
    }
    if (path === '/api/auth/passkeys/config') {
      await route.fulfill({ json: { enabled: false, rp_id: null } });
      return;
    }
    if (path === '/api/squad/notifications') {
      await route.fulfill({ json: { notifications: [] } });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, apiDelayMs));
    await route.fulfill({ status: 503, json: { message: 'Layout fixture data is pending.' } });
  });
}
