import './team-crest.css';

export type TeamCrestTeam = {
  id?: string | null;
  name: string;
  shortName?: string | null;
};

export type TeamCrestAsset =
  | 'bayer-neverlusen'
  | 'class-of-84'
  | 'dicks-dribbling-xi'
  | 'exeter-gently'
  | 'koden-all-stars'
  | 'stan-still-sells-tik'
  | 'wilde-boars';

const teamCrestAssets: Record<string, TeamCrestAsset> = {
  'team-bayer-neverlusen': 'bayer-neverlusen',
  'team-class-of-84': 'class-of-84',
  'team-dicks-dribbling-xi': 'dicks-dribbling-xi',
  'team-exeter-gently': 'exeter-gently',
  'team-koden-all-stars': 'koden-all-stars',
  'team-stan-still-sells-tik': 'stan-still-sells-tik',
  'team-wilde-boars': 'wilde-boars',
};

const teamCrestAssetsByName: Record<string, TeamCrestAsset> = {
  'bayer neverlusen': 'bayer-neverlusen',
  'class of 84': 'class-of-84',
  'dicks dribbling xi': 'dicks-dribbling-xi',
  'exeter gently': 'exeter-gently',
  'koden all stars': 'koden-all-stars',
  'stan still sells tik': 'stan-still-sells-tik',
  'wilde boars': 'wilde-boars',
};

export function teamCrestAsset(team: TeamCrestTeam): TeamCrestAsset | null {
  return (team.id ? teamCrestAssets[team.id] : undefined) ?? teamCrestAssetsByName[normaliseTeamName(team.name)] ?? null;
}

export function TeamCrest({ className = '', team }: { className?: string; team: TeamCrestTeam }) {
  const asset = teamCrestAsset(team);
  const classNames = ['team-crest', asset ? '' : 'team-crest--fallback', className].filter(Boolean).join(' ');

  if (!asset) {
    return <span aria-hidden="true" className={classNames}>{teamInitials(team)}</span>;
  }

  return (
    <span aria-hidden="true" className={classNames}>
      <img alt="" className="team-crest__on-light" decoding="async" src={`/team-crests/${asset}-dark.svg`} />
      <img alt="" className="team-crest__on-dark" decoding="async" src={`/team-crests/${asset}-light.svg`} />
    </span>
  );
}

function normaliseTeamName(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function teamInitials(team: TeamCrestTeam): string {
  return team.shortName?.trim().toUpperCase() || team.name.slice(0, 3).toUpperCase() || 'CD';
}
