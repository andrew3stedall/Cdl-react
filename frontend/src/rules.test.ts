import { expect, test } from 'vitest';

import type { RuleSection } from './contracts';
import { buildRuleHref, filterRules, getRuleDeepLink } from './rules';

const version = {
  version: '2026.05',
  effectiveDate: '2026-05-22',
  status: 'active',
  source: 'docs/features/active/rules-knowledge-base.md',
};

const sections: RuleSection[] = [
  {
    id: 'squad-size',
    title: 'Squad Size',
    category: 'squads',
    summary: 'Squads must remain within approved roster limits.',
    body: ['Roster limits are validated before submission.'],
    tags: ['squad', 'validation'],
    anchors: ['squad-size'],
    relatedRuleIds: ['transfer-deadline'],
    version,
  },
  {
    id: 'trade-window',
    title: 'Trade Window',
    category: 'trades',
    summary: 'Trades are only valid during configured windows.',
    body: ['Trades are reviewed against constraints.'],
    tags: ['trade'],
    anchors: ['trade-window'],
    relatedRuleIds: [],
    version,
  },
];

test('filters rules by query and category', () => {
  expect(filterRules(sections, 'roster', 'squads')).toHaveLength(1);
  expect(filterRules(sections, 'roster', 'trades')).toHaveLength(0);
});

test('builds stable rule links and resolves deep links', () => {
  expect(buildRuleHref('trade-window')).toBe('/rules#trade-window');
  expect(getRuleDeepLink(sections, 'squad-size')?.title).toBe('Squad Size');
});
