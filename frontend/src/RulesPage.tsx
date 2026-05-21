import type { RuleCategory, RuleSection, ThemePreset } from './contracts';
import { buildRuleHref, filterRules } from './rules';

interface RulesPageProps {
  sections: RuleSection[];
  categories: RuleCategory[];
  query?: string;
  category?: RuleCategory | 'all';
  preset: ThemePreset;
}

export function RulesPage({
  sections,
  categories,
  query = '',
  category = 'all',
  preset,
}: RulesPageProps) {
  const filteredSections = filterRules(sections, query, category);

  return (
    <main aria-labelledby="rules-title" data-preset={preset.name}>
      <header>
        <p>Castle Draft League</p>
        <h1 id="rules-title">Rules Knowledge Base</h1>
        <p>Searchable rule sections with stable identifiers for validation errors.</p>
      </header>

      <section aria-label="Rules filters">
        <label htmlFor="rules-search">Search rules</label>
        <input id="rules-search" name="q" defaultValue={query} placeholder="Search squads, trades, chips" />
        <label htmlFor="rules-category">Category</label>
        <select id="rules-category" name="category" defaultValue={category}>
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      <nav aria-label="Rules table of contents">
        <ul>
          {filteredSections.map((section) => (
            <li key={section.id}>
              <a href={buildRuleHref(section.id)}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-label="Rule sections">
        {filteredSections.map((section) => (
          <article id={section.id} key={section.id}>
            <p>{section.category}</p>
            <h2>{section.title}</h2>
            <p>{section.summary}</p>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p>Rule ID: {section.id}</p>
            <p>Version: {section.version.version}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
