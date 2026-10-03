import { expect, test } from '@playwright/test';

const positions = [
  'GKP',
  'DEF', 'DEF', 'DEF', 'DEF',
  'MID', 'MID', 'MID', 'MID', 'MID',
  'FWD', 'FWD', 'FWD',
  'GKP', 'DEF', 'MID', 'FWD',
  'GKP', 'DEF', 'MID',
];

const playerFixture = positions.map((position, index) => ({
  id: `player-${index + 1}`,
  display_name: `Fixture Player ${index + 1}`,
  position,
  epl_team: { id: `club-${index % 4}`, name: `Club ${index % 4}`, short_name: `C${index % 4}` },
  draft_team: { id: 'team-browser-fixture', name: 'Browser Fixture FC', short_name: 'BFC' },
  status: 'owned',
  points: 10 + index,
  form: 2.5,
  value: 45,
  slot: index < 11 ? 'starter' : index < 16 ? 'bench' : 'reserve',
  slot_order: index < 11
    ? index + 1
    : index < 16
      ? ([1, 2, 0, 3, 4][index - 11] ?? 0)
      : index - 15,
  is_captain: index === 0,
  is_vice_captain: index === 1,
}));

const chips = [
  { id: 'triple-captain', name: 'Triple Captain', status: 'available' },
  { id: 'dual-captain', name: 'Dual Captain', status: 'available' },
  { id: 'auto-captain', name: 'Auto Captain', status: 'available' },
  { id: 'bench-boost', name: 'Bench Boost', status: 'available' },
  { id: 'best-xi', name: 'Best XI', status: 'available' },
];

let lineup = structuredClone(playerFixture);
let currentChips = structuredClone(chips);
let savedLineups: Array<Array<Record<string, unknown>>> = [];

function teamSelectionResponse() {
  return {
    manager_team: { id: 'team-browser-fixture', name: 'Browser Fixture FC', short_name: 'BFC' },
    gameweek: { id: 'gw-browser-fixture', name: 'Matchweek 1', number: 1, deadline_at: '2099-01-01T00:00:00Z' },
    lineup,
    chips: currentChips,
    validation_messages: [],
    fixture_lock: { locked: false, fixture_id: null, fixture_type: null, lock_scope: null, locked_at: null, reason: null },
  };
}

test.beforeEach(async ({ page }) => {
  lineup = structuredClone(playerFixture);
  currentChips = structuredClone(chips);
  savedLineups = [];
  await page.route('**/api/auth/session', (route) => route.fulfill({
    json: {
      is_authenticated: true,
      user: { id: 'browser-manager', email: 'manager@example.test', display_name: 'Browser Manager', roles: ['manager'] },
      expires_at: '2099-01-01T00:00:00Z',
    },
  }));
  await page.route('**/api/auth/google/config', (route) => route.fulfill({ json: { enabled: false, client_id: null } }));
  await page.route('**/api/auth/apple/config', (route) => route.fulfill({ json: { enabled: false } }));
  await page.route('**/api/auth/passkeys/config', (route) => route.fulfill({ json: { enabled: false, rp_id: null } }));
  await page.route('**/api/team-selection/lineup', async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as { players: Array<Record<string, unknown>> };
      savedLineups.push(structuredClone(payload.players));
      lineup = lineup.map((player) => {
        const next = payload.players.find((candidate) => candidate.player_id === player.id);
        return next
          ? { ...player, slot: next.slot, slot_order: next.slot_order, is_captain: next.is_captain, is_vice_captain: next.is_vice_captain }
          : player;
      });
    }
    await route.fulfill({ json: teamSelectionResponse() });
  });
  await page.route('**/api/team-selection/chips/*', async (route) => {
    const chipId = new URL(route.request().url()).pathname.split('/').at(-1);
    const { active } = route.request().postDataJSON() as { active: boolean };
    currentChips = currentChips.map((chip) => ({
      ...chip,
      status: chip.id === chipId && active ? 'active' : chip.status === 'active' ? 'available' : chip.status,
    }));
    await route.fulfill({ json: teamSelectionResponse() });
  });
  await page.route('**/api/team-selection', (route) => route.fulfill({ json: teamSelectionResponse() }));
  await page.route('**/api/squad/workspace', (route) => route.fulfill({
    json: {
      summary: {
        manager_team: { id: 'team-browser-fixture', name: 'Browser Fixture FC', short_name: 'BFC' },
        gameweek: { id: 'gw-browser-fixture', name: 'Matchweek 1', number: 1, deadline_at: '2099-01-01T00:00:00Z' },
        players: lineup.map(({ id, display_name, position, epl_team, draft_team, status, points, form, value }) => ({
          id,
          display_name,
          position,
          epl_team,
          draft_team,
          status,
          points,
          form,
          value,
        })),
      },
      notifications: { notifications: [], proposed_trade_count: 0 },
    },
  }));
});

test('current 20-player and five-chip selection fits and persists captaincy/chip updates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/team-selection');

  await expect(page.getByRole('heading', { name: 'Squad' })).toBeVisible();
  await page.getByRole('button', { name: 'View as list' }).click();
  await expect(page.getByLabel('Chip controls').getByRole('button')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'View Fixture Player 20 details' })).toHaveCount(1);
  await expect(page.locator('.squad-page__list-table tbody tr')).toHaveCount(20);

  await page.getByRole('button', { name: 'View Fixture Player 2 details' }).click();
  await page.getByRole('button', { name: 'Captain' }).click();
  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expect.poll(() => savedLineups.length).toBe(1);
  expect(savedLineups[0]).toHaveLength(20);
  expect(savedLineups[0].find((player) => player.player_id === 'player-2')).toMatchObject({
    is_captain: true,
    is_vice_captain: false,
  });
  await page.getByRole('button', { name: 'Close player profile' }).click();

  await page.getByRole('button', { name: 'Triple Captain, available' }).click();
  await expect(page.getByRole('button', { name: 'Triple Captain, active' })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Triple Captain, active' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'View as list' }).click();
  await page.getByRole('button', { name: 'View Fixture Player 2 details' }).click();
  await expect(page.getByRole('button', { name: 'Captain' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close player profile' }).click();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
  const chipBounds = await page.getByRole('button', { name: 'Triple Captain, active' }).boundingBox();
  expect(chipBounds).not.toBeNull();
  expect(chipBounds!.x).toBeGreaterThanOrEqual(0);
  expect(chipBounds!.x + chipBounds!.width).toBeLessThanOrEqual(390);
});
