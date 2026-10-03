import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { HeadToHeadView, KnockoutView } from './LeagueCompetitionViews';

test('unresolved knockout tie has no invented winner and exposes aggregate/goals', () => {
  const html = renderToStaticMarkup(<KnockoutView knockout={{ rounds: [], matches: [], brackets: [{ id: 'top', label: 'Championship', status: 'in_progress', ties: [{ id: 'semi', roundLabel: 'Semifinal', teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], legs: [], aggregate: { a: 100, b: 100 }, scoringLineupGoals: { a: 4, b: 4 }, winner: null, tiebreakStatus: 'unresolved' }] }] }} onOpenFixture={() => {}} />);
  expect(html).toContain('awaiting approved tiebreak decision');
  expect(html).toContain('Aggregate');
  expect(html).not.toContain('Winner:');
});

test('head-to-head renders real records and distinguishes empty state', () => {
  const html = renderToStaticMarkup(<HeadToHeadView records={[{ team: { id: 'a', name: 'A' }, opponent: { id: 'b', name: 'B' }, played: 3, wins: 2, draws: 0, losses: 1, pointsFor: 120, pointsAgainst: 100 }]} />);
  expect(html).toContain('2-0-1');
  expect(renderToStaticMarkup(<HeadToHeadView records={[]} />)).toContain('No completed');
});
