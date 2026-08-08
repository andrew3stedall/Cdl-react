import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SquadManagementPage } from './SquadManagementPage';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/squad/summary') {
        return new Response(
          JSON.stringify({
            manager_team: { name: 'Exeter Gently' },
            gameweek: { name: 'Gameweek 1' },
            players: [
              {
                id: 'fpl-411',
                display_name: 'Haaland',
                position: 'FWD',
                epl_team: { name: 'Manchester City', short_name: 'MCI' },
                status: 'owned',
                points: 52,
                form: 7.1,
                value: 14.0,
                selected_by_percent: 58.4,
                expected_goals: 8.21,
                expected_assists: 1.34,
                availability_status: 'a',
                availability_news: '',
                chance_of_playing_next_round: 100,
              },
              {
                id: 'fpl-235',
                display_name: 'Pickford',
                position: 'GKP',
                epl_team: { name: 'Everton', short_name: 'EVE' },
                status: 'owned',
                points: 31,
                form: 4.2,
                value: 5.0,
                selected_by_percent: 14.2,
                expected_goals: 0,
                expected_assists: 0,
                availability_status: 'a',
                availability_news: '',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/team-selection') {
        return new Response(
          JSON.stringify({
            manager_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
            gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
            lineup: [
              {
                id: 'fpl-411',
                display_name: 'Haaland',
                position: 'FWD',
                epl_team: { id: 'mci', name: 'Manchester City', short_name: 'MCI' },
                slot: 'starter',
                slot_order: 1,
                is_captain: true,
                is_vice_captain: false,
              },
              {
                id: 'fpl-235',
                display_name: 'Pickford',
                position: 'GKP',
                epl_team: { id: 'eve', name: 'Everton', short_name: 'EVE' },
                slot: 'bench',
                slot_order: 1,
                is_captain: false,
                is_vice_captain: false,
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
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/scouting/players') {
        return new Response(
          JSON.stringify({
            players: [
              {
                id: 'fpl-411',
                display_name: 'Haaland',
                position: 'FWD',
                epl_team: { name: 'Manchester City', short_name: 'MCI' },
                status: 'owned',
                points: 52,
                form: 7.1,
                value: 14.0,
                selected_by_percent: 58.4,
                expected_goals: 8.21,
                expected_assists: 1.34,
                availability_status: 'a',
                availability_news: '',
                chance_of_playing_next_round: 100,
              },
              {
                id: 'fpl-235',
                display_name: 'Pickford',
                position: 'GKP',
                epl_team: { name: 'Everton', short_name: 'EVE' },
                status: 'owned',
                points: 31,
                form: 4.2,
                value: 5.0,
              },
              {
                id: 'fpl-154',
                display_name: 'Palmer',
                position: 'MID',
                epl_team: { name: 'Chelsea', short_name: 'CHE' },
                status: 'available',
                points: 48,
                form: 6.8,
                value: 10.5,
                selected_by_percent: 45.1,
                expected_goals: 5.7,
                expected_assists: 6.1,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/fpl/players/fpl-411/history') {
        return new Response(
          JSON.stringify({
            player_id: 'fpl-411',
            fetched_at: '2026-08-09T04:30:00Z',
            response_sha256: 'a'.repeat(64),
            history: [
              {
                gameweek: 1,
                fixture_id: 100,
                opponent_team_id: 2,
                total_points: 8,
                minutes: 90,
                expected_goals: 0.84,
                expected_assists: 0.12,
              },
            ],
            fixtures: [
              {
                fixture_id: 101,
                gameweek: 2,
                opponent_team_id: 3,
                difficulty: 3,
                is_home: false,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path.startsWith('/api/fpl/players/')) {
        return new Response(
          JSON.stringify({
            player_id: path.split('/')[4],
            fetched_at: '2026-08-09T04:30:00Z',
            response_sha256: 'b'.repeat(64),
            history: [],
            fixtures: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/interests' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'interest-player-3',
            player: { id: 'fpl-154', display_name: 'Palmer' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/trades') {
        return new Response(JSON.stringify({ trades: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function renderPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SquadManagementPage preset={getDefaultThemePreset()} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  expect(button).toBeDefined();
  button?.click();
}

describe('SquadManagementPage', () => {
  test('starts on the persisted pitch and switches to the complete list', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Exeter Gently');
    expect(container.querySelector('[aria-label="Squad pitch"]')).not.toBeNull();
    expect(container.textContent).toContain('Haaland');
    expect(container.textContent).toContain('Form 7.1');
    expect(container.querySelector('[aria-label="Bench"]')?.textContent).toContain('Pickford');
    expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Pitch');
    expect(container.textContent).not.toContain('Palmer');
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);

    await act(async () => {
      clickButton(container, 'List');
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Players table"]')).not.toBeNull();
    expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toContain('List');

    await act(async () => {
      clickButton(container, 'Player pool');
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Search the shared player pool');
    expect(container.textContent).toContain('Palmer');
  });

  test('adds a player to interests from the player pool', async () => {
    const { container } = await renderPage();
    await act(async () => {
      clickButton(container, 'Player pool');
      await Promise.resolve();
    });

    const interestButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Interest') && !button.disabled,
    ) as HTMLButtonElement;
    await act(async () => {
      interestButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Palmer added to interests.');
    expect(container.textContent).toContain('Watching');

    await act(async () => {
      clickButton(container, 'Activity');
      await Promise.resolve();
    });
    expect(container.querySelector('section[aria-label="Interests and proposed trades"]')?.textContent).toContain('Palmer');
  });

  test('opens player detail with official metrics, availability, and cached history', async () => {
    const { container } = await renderPage();

    const pitchPlayer = container.querySelector(
      'button[aria-label="View Haaland details"]',
    ) as HTMLButtonElement;
    await act(async () => {
      pitchPlayer.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const drawer = container.querySelector('[role="dialog"]');
    expect(drawer?.textContent).toContain('Haaland');
    expect(drawer?.textContent).toContain('FPL availability');
    expect(drawer?.textContent).toContain('58.4%');
    expect(drawer?.textContent).toContain('8.21');
    expect(drawer?.textContent).toContain('FPL gameweek history');
    expect(drawer?.querySelector('[aria-label="Recent FPL gameweek history"]')?.textContent).toContain('0.84');
    expect(drawer?.textContent).toContain('Next fixture: GW2 · FDR 3 · Away');
    expect(container.textContent).not.toContain('Propose sample trade');
  });
});
