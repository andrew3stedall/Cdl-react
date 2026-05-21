import type { RuleCategory, RuleSection, RulesIndexResponse } from './contracts';
import { canAccessProtectedRoute } from './auth';
import type { SessionState } from './contracts';

function toRuleVersion(payload: Record<string, unknown>) {
  return {
    version: String(payload.version),
    effectiveDate: String(payload.effective_date),
    status: String(payload.status),
    source: String(payload.source),
  };
}

function toRuleSection(payload: Record<string, unknown>): RuleSection {
  return {
    id: String(payload.id),
    title: String(payload.title),
    category: payload.category as RuleCategory,
    summary: String(payload.summary),
    body: payload.body as string[],
    tags: payload.tags as string[],
    anchors: payload.anchors as string[],
    relatedRuleIds: payload.related_rule_ids as string[],
    version: toRuleVersion(payload.version as Record<string, unknown>),
  };
}

function toRulesIndex(payload: Record<string, unknown>): RulesIndexResponse {
  return {
    version: toRuleVersion(payload.version as Record<string, unknown>),
    categories: payload.categories as RuleCategory[],
    sections: (payload.sections as Record<string, unknown>[]).map(toRuleSection),
  };
}

export async function fetchRules(category?: RuleCategory): Promise<RulesIndexResponse> {
  const params = new URLSearchParams();
  if (category) {
    params.set('category', category);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`/api/rules${suffix}`, { credentials: 'include' });
  return toRulesIndex((await response.json()) as Record<string, unknown>);
}

export async function searchRules(query: string, category?: RuleCategory): Promise<RulesIndexResponse> {
  const params = new URLSearchParams({ q: query });
  if (category) {
    params.set('category', category);
  }
  const response = await fetch(`/api/rules/search?${params.toString()}`, { credentials: 'include' });
  return toRulesIndex((await response.json()) as Record<string, unknown>);
}

export function filterRules(
  sections: RuleSection[],
  query: string,
  category: RuleCategory | 'all' = 'all',
): RuleSection[] {
  const normalized = query.trim().toLowerCase();
  return sections.filter((section) => {
    const categoryMatches = category === 'all' || section.category === category;
    const queryMatches =
      !normalized ||
      section.title.toLowerCase().includes(normalized) ||
      section.summary.toLowerCase().includes(normalized) ||
      section.tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
      section.body.some((paragraph) => paragraph.toLowerCase().includes(normalized));
    return categoryMatches && queryMatches;
  });
}

export function buildRuleHref(ruleId: string): string {
  return `/rules#${ruleId}`;
}

export function getRuleDeepLink(sections: RuleSection[], ruleId: string): RuleSection | null {
  return sections.find((section) => section.id === ruleId || section.anchors.includes(ruleId)) ?? null;
}

export function getRulesRouteRedirect(session: SessionState): string | null {
  return canAccessProtectedRoute(session) ? null : '/login?next=/rules';
}
