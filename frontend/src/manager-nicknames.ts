/** Canonical manager nicknames used by league-facing UI labels. */

export interface ManagerLabelTeam {
  id?: string;
  name?: string;
  managerName?: string;
}

const TEAM_MANAGER_NICKNAMES: Record<string, string> = {
  'team-stan-still-sells-tik': 'Andrew',
  'team-wilde-boars': 'DJ',
  'team-bayer-neverlusen': 'Kev',
  'team-class-of-84': 'Warren',
  'team-sporting-lesbians': 'Daniel',
  'team-dicks-dribbling-xi': 'Rich',
  'team-koden-all-stars': 'Nath',
  'team-exeter-gently': 'Dilson',
};

const TEAM_NAME_MANAGER_NICKNAMES: Record<string, string> = {
  'Stan Still Sells Tik': 'Andrew',
  'Wilde Boars': 'DJ',
  'Bayer Neverlusen': 'Kev',
  'Class of 84': 'Warren',
  'Sporting Lesbians': 'Daniel',
  'Dicks Dribbling XI': 'Rich',
  'Koden All Stars': 'Nath',
  'Exeter Gently': 'Dilson',
};

const LEGACY_MANAGER_NICKNAMES: Record<string, string> = {
  kevin: 'Kev',
  nielsen: 'Nath',
  nilson: 'Nath',
  richard: 'Rich',
};

export function managerNicknameForTeam(team: ManagerLabelTeam): string {
  return (team.id ? TEAM_MANAGER_NICKNAMES[team.id] : undefined)
    ?? (team.name ? TEAM_NAME_MANAGER_NICKNAMES[team.name] : undefined)
    ?? managerNicknameForName(team.managerName)
    ?? team.name
    ?? 'Unknown team';
}

export function managerNicknameForName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return LEGACY_MANAGER_NICKNAMES[name.trim().toLowerCase()] ?? name;
}
