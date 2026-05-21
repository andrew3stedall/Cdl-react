import type { RuleSection } from './contracts';
import { RulesPage } from './RulesPage';
import { getDefaultThemePreset } from './theme-presets';

const rulesVersion = {
  version: '2026.05',
  effectiveDate: '2026-05-22',
  status: 'active',
  source: 'docs/features/active/rules-knowledge-base.md',
};

const featuredRules: RuleSection[] = [
  {
    id: 'squad-size',
    title: 'Squad Size',
    category: 'squads',
    summary: 'Squads must remain within approved roster limits.',
    body: ['Validation errors should link to this stable rule identifier.'],
    tags: ['squad', 'validation'],
    anchors: ['squad-size'],
    relatedRuleIds: ['transfer-deadline'],
    version: rulesVersion,
  },
  {
    id: 'trade-window',
    title: 'Trade Window',
    category: 'trades',
    summary: 'Trades are only valid during configured trade windows.',
    body: ['Trade proposals can only be accepted while the trade window is open.'],
    tags: ['trades', 'commissioner'],
    anchors: ['trade-window'],
    relatedRuleIds: ['commissioner-decisions'],
    version: rulesVersion,
  },
];

export function App() {
  const preset = getDefaultThemePreset();

  return (
    <RulesPage
      categories={['squads', 'trades']}
      sections={featuredRules}
      preset={preset}
    />
  );
}
