import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { LeagueInvitePage } from './LeagueInvitePage';
import type { LeagueClient } from './league-api';
import type { SessionState } from './contracts';

const session: SessionState = {
  isAuthenticated: true,
  user: {
    id: 'user-1',
    email: 'manager@example.com',
    displayName: 'New Manager',
    roles: ['manager'],
  },
  expiresAt: null,
};

describe('LeagueInvitePage', () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  test('automatically claims the invited team for a signed-in account', async () => {
    const acceptedTokens: string[] = [];
    const client: LeagueClient = {
      getLeagueSnapshot: async () => {
        throw new Error('not used');
      },
      previewLeagueInvite: async () => ({
        leagueName: 'CDL',
        teamId: 'drafton',
        teamName: 'Drafton Rovers',
        availableTeamCount: 1,
      }),
      acceptLeagueInvite: async (token) => {
        acceptedTokens.push(token);
        return {
          leagueName: 'CDL',
          teamId: 'drafton',
          teamName: 'Drafton Rovers',
          alreadyMember: false,
        };
      },
    };
    container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LeagueInvitePage
          currentPath="/join/team-invite"
          leagueClient={client}
          onNavigate={() => undefined}
          session={session}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(acceptedTokens).toEqual(['team-invite']);
    expect(container.textContent).toContain('Your team is Drafton Rovers.');
    root.unmount();
  });
});
