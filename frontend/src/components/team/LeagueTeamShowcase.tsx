import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { LeagueTableRow } from '../../league-api';
import { TeamCrest, type TeamCrestTeam } from './TeamCrest';
import { WebGLTeamCrest } from './WebGLTeamCrest';
import './league-team-showcase.css';

type ShowcaseTeam = TeamCrestTeam & { id: string; row?: LeagueTableRow };

const KNOWN_TEAMS: Array<TeamCrestTeam & { id: string }> = [
  { id: 'team-stan-still-sells-tik', name: 'Stan Still Sells Tik', shortName: 'SST' },
  { id: 'team-wilde-boars', name: 'Wilde Boars', shortName: 'WIL' },
  { id: 'team-bayer-neverlusen', name: 'Bayer Neverlusen', shortName: 'BAY' },
  { id: 'team-class-of-84', name: 'Class of 84', shortName: 'C84' },
  { id: 'team-sporting-lesbians', name: 'Sporting Lesbians', shortName: 'SPL' },
  { id: 'team-dicks-dribbling-xi', name: 'Dicks Dribbling XI', shortName: 'DDX' },
  { id: 'team-koden-all-stars', name: 'Koden All Stars', shortName: 'KOD' },
  { id: 'team-exeter-gently', name: 'Exeter Gently', shortName: 'EXE' },
];

const TEAM_ACCENTS: Record<string, string> = {
  'team-stan-still-sells-tik': '#20d6c1',
  'team-wilde-boars': '#e6a446',
  'team-bayer-neverlusen': '#f05c5c',
  'team-class-of-84': '#a78bfa',
  'team-sporting-lesbians': '#fa76ad',
  'team-dicks-dribbling-xi': '#f59e0b',
  'team-koden-all-stars': '#60a5fa',
  'team-exeter-gently': '#84cc16',
};

export function LeagueTeamShowcase({ rows }: { rows: LeagueTableRow[] }) {
  const teams = useMemo<ShowcaseTeam[]>(() => {
    if (rows.length) return [...rows].sort((a, b) => a.team.name.localeCompare(b.team.name)).map((row) => ({ ...row.team, row }));
    return KNOWN_TEAMS.map((team) => ({ ...team }));
  }, [rows]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = Math.max(0, teams.findIndex((team) => team.id === selectedId));
  const selected = teams[selectedIndex] ?? teams[0];

  if (!selected) return null;

  const select = (index: number) => setSelectedId(teams[(index + teams.length) % teams.length]?.id ?? null);

  return (
    <section aria-label="League teams" className="league-team-showcase">
      <div className="league-team-showcase__stage" style={{ '--team-accent': TEAM_ACCENTS[selected.id] ?? '#20d6c1' } as CSSProperties}>
        <div className="league-team-showcase__stage-copy">
          <span className="league-team-showcase__eyebrow"><Sparkles aria-hidden="true" size={14} /> TEAM CREST · WEBGL</span>
          <h2>{selected.name}</h2>
          <p>{selected.row ? `League position ${selected.row.position} · ${selected.row.leaguePoints} points` : 'League side'}</p>
        </div>
        <WebGLTeamCrest className="league-team-showcase__animation" team={selected} accent={TEAM_ACCENTS[selected.id] ?? '#20d6c1'} />
        <div aria-label="Team navigation" className="league-team-showcase__controls">
          <button aria-label="Previous team" onClick={() => select(selectedIndex - 1)} type="button"><ArrowLeft aria-hidden="true" size={18} /></button>
          <span>{String(selectedIndex + 1).padStart(2, '0')} <i>/</i> {String(teams.length).padStart(2, '0')}</span>
          <button aria-label="Next team" onClick={() => select(selectedIndex + 1)} type="button"><ArrowRight aria-hidden="true" size={18} /></button>
        </div>
      </div>
      <div aria-label="Choose a team crest" className="league-team-showcase__team-list" role="group">
        {teams.map((team, index) => (
          <button aria-pressed={team.id === selected.id} className="league-team-showcase__team" key={team.id} onClick={() => select(index)} style={{ '--team-accent': TEAM_ACCENTS[team.id] ?? '#20d6c1' } as CSSProperties} type="button">
            <span className="league-team-showcase__mini-crest"><TeamCrest team={team} /></span>
            <span>{team.name}</span>
            <small>{team.row ? `#${team.row.position}` : team.shortName}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
