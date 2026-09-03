import { ChevronRight } from 'lucide-react';

import type { LeagueFixture } from '../../league-api';
import { TeamCrest } from '../team/TeamCrest';

export function LeagueFixture({ compact = false, fixture, onOpen }: { compact?: boolean; fixture: LeagueFixture; onOpen: (fixture: LeagueFixture) => void }) {
  const action = fixture.status === 'pending' ? 'Open preview' : fixture.status === 'started' ? 'Open live fixture' : 'Open finished fixture';
  return (
    <button aria-label={`${action} for ${fixtureParticipantName(fixture.homeTeam)} versus ${fixtureParticipantName(fixture.awayTeam)}`} className={`league-fixture-row${compact ? ' league-fixture-row--compact' : ''}`} onClick={() => onOpen(fixture)} type="button">
      <FixtureTeams compact fixture={fixture} />
      <ChevronRight aria-hidden="true" className="league-fixture-row__arrow" size={17} />
    </button>
  );
}

function FixtureTeams({ compact = false, fixture }: { compact?: boolean; fixture: LeagueFixture }) {
  return (
    <div className={`league-fixture-teams${compact ? ' league-fixture-teams--compact' : ''}`}>
      <div className="league-team-line"><TeamCrest className="league-team-mark" team={fixture.homeTeam} /><strong>{fixtureParticipantName(fixture.homeTeam)}</strong></div>
      <div className="league-score"><strong>{fixture.score.homeScore ?? '—'}</strong><span>{' - '}</span><strong>{fixture.score.awayScore ?? '—'}</strong></div>
      <div className="league-team-line league-team-line--away"><strong>{fixtureParticipantName(fixture.awayTeam)}</strong><TeamCrest className="league-team-mark" team={fixture.awayTeam} /></div>
    </div>
  );
}

export function fixtureParticipantName(team: LeagueFixture['homeTeam']): string {
  return team.managerName ?? team.name;
}
