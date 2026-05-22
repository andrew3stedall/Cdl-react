import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import type { FdrClient, FdrCombinedResponse, FdrFilters } from './fdr-api';
import { FixtureDifficultyPage } from './FixtureDifficultyPage';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const response: FdrCombinedResponse = {
  scales: [
    {
      rating: 1,
      band: 'very_easy',
      label: 'Very easy',
      foregroundToken: 'fdr-1-foreground',
      backgroundToken: 'fdr-1-background',
      contrastRatio: 7.8,
    },
    {
      rating: 2,
      band: 'easy',
      label: 'Easy',
      foregroundToken: 'fdr-2-foreground',
      backgroundToken: 'fdr-2-background',
      contrastRatio: 6.9,
    },
    {
      rating: 3,
      band: 'medium',
      label: 'Medium',
      foregroundToken: 'fdr-3-foreground',
      backgroundToken: 'fdr-3-background',
      contrastRatio: 5.4,
    },
    {
      rating: 4,
      band: 'hard',
      label: 'Hard',
      foregroundToken: 'fdr-4-foreground',
      backgroundToken: 'fdr-4-background',
      contrastRatio: 6.1,
    },
    {
      rating: 5,
      band: 'very_hard',
      label: 'Very hard',
      foregroundToken: 'fdr-5-foreground',
      backgroundToken: 'fdr-5-background',
      contrastRatio: 7.2,
    },
  ],
  attack: {
    view: 'attack',
    filters: { season: '2025/26', teamId: null, gameweekStart: 12, gameweekEnd: 13 },
    scales: [],
    availableTeams: [
      { id: 'arsenal', name: 'Arsenal', shortName: 'ARS' },
      { id: 'man-city', name: 'Manchester City', shortName: 'MCI' },
    ],
    availableGameweeks: [
      { id: 'gw-12', name: 'Gameweek 12', number: 12 },
      { id: 'gw-13', name: 'Gameweek 13', number: 13 },
    ],
    rows: [
      {
        team: { id: 'arsenal', name: 'Arsenal', shortName: 'ARS' },
        averageRating: 2.5,
        fixtures: [
          {
            id: 'attack-arsenal-12',
            opponent: { id: 'man-city', name: 'Manchester City', shortName: 'MCI' },
            gameweek: { id: 'gw-12', name: 'Gameweek 12', number: 12 },
            venue: 'H',
            rating: 2,
            band: 'easy',
            abbreviation: 'MCI (H)',
          },
          {
            id: 'attack-arsenal-13',
            opponent: { id: 'man-city', name: 'Manchester City', shortName: 'MCI' },
            gameweek: { id: 'gw-13', name: 'Gameweek 13', number: 13 },
            venue: 'A',
            rating: 3,
            band: 'medium',
            abbreviation: 'MCI (A)',
          },
        ],
      },
    ],
  },
  defence: {
    view: 'defence',
    filters: { season: '2025/26', teamId: null, gameweekStart: 12, gameweekEnd: 13 },
    scales: [],
    availableTeams: [
      { id: 'arsenal', name: 'Arsenal', shortName: 'ARS' },
      { id: 'man-city', name: 'Manchester City', shortName: 'MCI' },
    ],
    availableGameweeks: [
      { id: 'gw-12', name: 'Gameweek 12', number: 12 },
      { id: 'gw-13', name: 'Gameweek 13', number: 13 },
    ],
    rows: [
      {
        team: { id: 'arsenal', name: 'Arsenal', shortName: 'ARS' },
        averageRating: 3.5,
        fixtures: [
          {
            id: 'defence-arsenal-12',
            opponent: { id: 'man-city', name: 'Manchester City', shortName: 'MCI' },
            gameweek: { id: 'gw-12', name: 'Gameweek 12', number: 12 },
            venue: 'H',
            rating: 3,
            band: 'medium',
            abbreviation: 'MCI (H)',
          },
          {
            id: 'defence-arsenal-13',
            opponent: { id: 'man-city', name: 'Manchester City', shortName: 'MCI' },
            gameweek: { id: 'gw-13', name: 'Gameweek 13', number: 13 },
            venue: 'A',
            rating: 4,
            band: 'hard',
            abbreviation: 'MCI (A)',
          },
        ],
      },
    ],
  },
};

class MemoryFdrClient implements FdrClient {
  requests: FdrFilters[] = [];

  async getFdr(filters: FdrFilters): Promise<FdrCombinedResponse> {
    this.requests.push(filters);
    return response;
  }
}

async function renderPage(client = new MemoryFdrClient()) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<FixtureDifficultyPage fdrClient={client} />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return { client, container, root };
}

describe('FixtureDifficultyPage', () => {
  test('renders attack table, defence table, and rating legend', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Attack FDR');
    expect(container.textContent).toContain('Defence FDR');
    expect(container.textContent).toContain('Rating scale');
    expect(container.textContent).toContain('MCI (H)');
    expect(container.textContent).toContain('Very hard');
  });

  test('requeries FDR when team filter changes', async () => {
    const { client, container } = await renderPage();
    const teamSelect = container.querySelector('select') as HTMLSelectElement;

    await act(async () => {
      teamSelect.value = 'arsenal';
      teamSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(client.requests.at(-1)?.teamId).toBe('arsenal');
  });

  test('uses rating classes for token-driven colour scale', async () => {
    const { container } = await renderPage();

    expect(container.querySelector('.fdr-rating-4')?.textContent).toContain('4');
    expect(container.querySelector('.fdr-rating-5')?.textContent).toContain('Very hard');
  });
});
