import { useState } from 'react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { PageHero } from './components/ui/page-hero';
import { Select } from './components/ui/select';
import type { RuleCategory, RuleSection, ThemePreset } from './contracts';
import { buildRuleHref, filterRules } from './rules';
import './rules-page.css';

interface RulesPageProps {
  sections: RuleSection[];
  categories: RuleCategory[];
  query?: string;
  category?: RuleCategory | 'all';
  onNavigate?: (href: string) => void;
  preset: ThemePreset;
}

export function RulesPage({ sections, categories, query = '', category = 'all', onNavigate, preset }: RulesPageProps) {
  const [search, setSearch] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState<RuleCategory | 'all'>(category);
  const filteredSections = filterRules(sections, search, selectedCategory);

  return (
    <main aria-labelledby="rules-title" className="feature-screen rules-page" data-density={preset.tokens.density} data-preset={preset.name}>
      <PageHero actions={null} actionsLabel="Rules actions" onNavigate={onNavigate} title="Rules" titleId="rules-title" />
      <Card className="rules-page__filters">
        <label htmlFor="rules-search">Search rules
          <input id="rules-search" name="q" onChange={(event) => setSearch(event.target.value)} placeholder="Search rules" type="search" value={search} />
        </label>
        <Select label="Category" onChange={(event) => setSelectedCategory(event.target.value as RuleCategory | 'all')} options={[{ label: 'All categories', value: 'all' }, ...categories.map((item) => ({ label: item, value: item }))]} value={selectedCategory} />
        <Button onClick={() => { setSearch(''); setSelectedCategory('all'); }} type="button" variant="secondary">Clear filters</Button>
      </Card>
      <p aria-live="polite" className="rules-page__count">{filteredSections.length} rules</p>
      {filteredSections.length === 0 ? <Card>No rules match these filters.</Card> : null}
      <nav aria-label="Rules table of contents" className="rules-page__contents">
        {filteredSections.map((section) => <a href={buildRuleHref(section.id)} key={section.id}>{section.title}</a>)}
      </nav>
      <section aria-label="Rule sections" className="rules-page__sections">
        {filteredSections.map((section) => (
          <Card className="rules-page__section" id={section.id} key={section.id}>
            {section.anchors.filter((anchor) => anchor !== section.id).map((anchor) => <span id={anchor} key={anchor} />)}
            <p className="rules-page__category">{section.category}</p>
            <h2>{section.title}</h2>
            <p>{section.summary}</p>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <small>Version {section.version.version}</small>
          </Card>
        ))}
      </section>
    </main>
  );
}
