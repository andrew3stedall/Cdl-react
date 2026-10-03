import { useEffect, useState } from 'react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { PageHero } from './components/ui/page-hero';
import type { RulesIndexResponse, ThemePreset } from './contracts';
import { fetchRules } from './rules';
import { RulesPage } from './RulesPage';

export function RulesWorkspacePage({ onNavigate, preset, loadRules = fetchRules }: {
  onNavigate?: (href: string) => void;
  preset: ThemePreset;
  loadRules?: () => Promise<RulesIndexResponse>;
}) {
  const [rules, setRules] = useState<RulesIndexResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadRules().then((response) => {
      if (active) setRules(response);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, loadRules]);

  useEffect(() => {
    if (!rules) return;
    const scrollToRule = () => {
      const anchor = window.location.hash.slice(1);
      if (anchor) document.getElementById(anchor)?.scrollIntoView?.({ block: 'start' });
    };
    scrollToRule();
    window.addEventListener('hashchange', scrollToRule);
    return () => window.removeEventListener('hashchange', scrollToRule);
  }, [rules]);

  if (rules) return <RulesPage categories={rules.categories} onNavigate={onNavigate} preset={preset} sections={rules.sections} />;

  return <main aria-labelledby="rules-title" className="feature-screen rules-page" data-density={preset.tokens.density} data-preset={preset.name}>
    <PageHero actions={null} actionsLabel="Rules actions" onNavigate={onNavigate} title="Rules" titleId="rules-title" />
    <Card>
      {failed ? <><p role="alert">Rules could not be loaded.</p><Button onClick={() => { setFailed(false); setAttempt((value) => value + 1); }} type="button">Retry</Button></> : <p role="status">Loading rules…</p>}
    </Card>
  </main>;
}
