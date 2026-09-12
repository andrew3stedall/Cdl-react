import { managerNicknameForTeam } from './manager-nicknames';

type ApiTeam = {
  id: string;
  name: string;
  short_name?: string | null;
  manager_name?: string | null;
};

type ApiTableRow = {
  team: ApiTeam;
  wins: number;
  draws: number;
  losses: number;
};

type ApiTableResponse = {
  rows: ApiTableRow[];
};

const RECORD_ATTRIBUTE = 'data-league-fixture-record';
const TEAM_SELECTOR = '.league-gameweek-section--upcoming .league-gameweek-team';

let recordByNickname = new Map<string, string>();
let observer: MutationObserver | null = null;
let applyQueued = false;

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function scheduleApply(): void {
  if (applyQueued) return;
  applyQueued = true;
  window.requestAnimationFrame(() => {
    applyQueued = false;
    applyLeagueRecords();
  });
}

function applyLeagueRecords(): void {
  if (recordByNickname.size === 0) return;

  document.querySelectorAll<HTMLElement>(TEAM_SELECTOR).forEach((teamElement) => {
    const managerName = teamElement.querySelector<HTMLElement>(':scope > strong')?.textContent;
    if (!managerName) return;

    const record = recordByNickname.get(normalise(managerName));
    const existing = teamElement.querySelector<HTMLElement>(`:scope > [${RECORD_ATTRIBUTE}]`);

    if (!record) {
      existing?.remove();
      return;
    }

    if (existing) {
      if (existing.textContent !== record) existing.textContent = record;
      return;
    }

    const recordElement = document.createElement('span');
    recordElement.className = 'league-gameweek-team__record';
    recordElement.setAttribute(RECORD_ATTRIBUTE, 'true');
    recordElement.textContent = record;
    teamElement.querySelector(':scope > strong')?.insertAdjacentElement('afterend', recordElement);
  });
}

async function loadLeagueRecords(): Promise<void> {
  try {
    const response = await fetch('/api/league/table', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;

    const payload = await response.json() as ApiTableResponse;
    recordByNickname = new Map(payload.rows.map((row) => {
      const nickname = managerNicknameForTeam({
        id: row.team.id,
        name: row.team.name,
        shortName: row.team.short_name ?? undefined,
        managerName: row.team.manager_name ?? undefined,
      });
      return [normalise(nickname), `${row.wins}W ${row.draws}D ${row.losses}L`];
    }));
    scheduleApply();
  } catch {
    // The league page already handles API availability. This enhancement is
    // intentionally non-blocking so fixture rendering is never held up.
  }
}

export function registerLeagueFixtureDeskPolish(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (observer) return;

  observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  void loadLeagueRecords();
}
