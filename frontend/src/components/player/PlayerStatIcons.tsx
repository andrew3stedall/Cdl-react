import { RectangleVertical, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';

import './player-stat-icons.css';

export interface PlayerStatSummary {
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  ownGoals?: number;
  defensiveContributions: number;
  bonusPoints: number;
}

interface StatIconProps {
  'aria-hidden'?: boolean;
  fill?: string;
  size?: number;
}

type StatIcon = (props: StatIconProps) => ReactNode;

export function PlayerStatIcons({ className = '', position, stats }: { className?: string; position: string | null; stats: PlayerStatSummary }) {
  const icons: Array<{ key: string; label: string; value: number; icon: StatIcon; tone?: 'yellow' | 'red' }> = [
    { key: 'goals', label: 'Goals scored', value: stats.goals, icon: SoccerBallIcon },
    { key: 'assists', label: 'Assists', value: stats.assists, icon: SoccerBootIcon },
    { key: 'clean-sheets', label: 'Clean sheets', value: stats.cleanSheets, icon: CastleWallIcon },
    { key: 'saves', label: 'Saves', value: stats.saves, icon: GoalkeeperGlovesIcon },
    { key: 'yellow-cards', label: 'Yellow cards', value: stats.yellowCards, icon: renderLucideIcon(RectangleVertical), tone: 'yellow' },
    { key: 'red-cards', label: 'Red cards', value: stats.redCards, icon: renderLucideIcon(RectangleVertical), tone: 'red' },
    { key: 'defensive-contributions', label: 'Defensive contributions', value: stats.defensiveContributions, icon: DefensiveShieldIcon },
    { key: 'bonus', label: 'Bonus points', value: stats.bonusPoints, icon: renderLucideIcon(Trophy) },
  ];

  return (
    <span className={`player-profile__stat-icons${className ? ` ${className}` : ''}`}>
      {icons
        .filter((stat) => stat.key === 'defensive-contributions'
          ? earnedDefensiveContributionPoints(stats.defensiveContributions, position)
          : stat.value > 0)
        .map((stat) => (
          <span
            aria-label={`${stat.label}: ${stat.value}`}
            className={`player-profile__stat-icon${stat.tone ? ` player-profile__stat-icon--${stat.tone}` : ''}`}
            data-stat-key={stat.key}
            key={stat.key}
            role="img"
            title={`${stat.label}: ${stat.value}`}
          >
            {stat.icon({ 'aria-hidden': true, fill: stat.tone ? 'currentColor' : 'none', size: 11 })}
            {stat.value > 1 ? <b className="player-profile__stat-multiplier">×{stat.value}</b> : null}
          </span>
        ))}
    </span>
  );
}

function renderLucideIcon(Icon: typeof RectangleVertical): StatIcon {
  return (props) => <Icon {...props} />;
}

function StatSvg({ children, fill = 'none', size = 11 }: StatIconProps & { children: ReactNode }) {
  return <svg aria-hidden="true" fill={fill} height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">{children}</svg>;
}

function SoccerBallIcon({ fill, size }: StatIconProps) {
  return <StatSvg fill={fill} size={size}>
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="m12 7.35 3.25 2.36-1.24 3.82h-4.02L8.75 9.71 12 7.35Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    <path d="M12 3.5v3.85m8.07 5.02-4.56.38m1.02 6.65-2.52-3.83m-4.02 3.83 2.52-3.83m-7.58-3.2 4.56.38" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
  </StatSvg>;
}

function SoccerBootIcon({ fill, size }: StatIconProps) {
  return <StatSvg fill={fill} size={size}>
    <path d="M4.8 17.55c1.7-1.24 3.45-1.63 4.76-2.52 1.23-.84 1.7-2.34 1.94-4.17.1-.77 1.03-1.08 1.6-.55l2.36 2.16c.68.62 1.46 1.02 2.35 1.2l1.7.35a2.23 2.23 0 0 1 1.77 2.19v1.34H5.25c-.7 0-.99-.59-.45-1Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    <path d="M5.1 17.55h16.2m-8.1-6.33 3.14 2.36" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
  </StatSvg>;
}

function CastleWallIcon({ fill, size }: StatIconProps) {
  return <StatSvg fill={fill} size={size}>
    <path d="M4 20V8h3v3h3V8h4v3h3V8h3v12H4Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    <path d="M4 15h16m-12 0v5m8-5v5" fill="none" stroke="currentColor" strokeWidth="1.7" />
  </StatSvg>;
}

function DefensiveShieldIcon({ fill, size }: StatIconProps) {
  return <StatSvg fill={fill} size={size}>
    <path d="m12 3.35 7.05 2.58v5.21c0 4.21-2.57 7.68-7.05 9.51-4.48-1.83-7.05-5.3-7.05-9.51V5.93L12 3.35Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
  </StatSvg>;
}

function GoalkeeperGlovesIcon({ fill, size }: StatIconProps) {
  return <StatSvg fill={fill} size={size}>
    <path d="M3.45 16.75V9.18a.9.9 0 0 1 1.8 0v3.08V6.28a.9.9 0 0 1 1.8 0v6.05V5.56a.9.9 0 0 1 1.8 0v6.98l.63-3.26a.9.9 0 0 1 1.77.34l-.75 6.03c-.25 2.02-1.52 3.1-3.38 3.1H5.83a2.38 2.38 0 0 1-2.38-2.05Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M20.55 16.75V9.18a.9.9 0 0 0-1.8 0v3.08V6.28a.9.9 0 0 0-1.8 0v6.05V5.56a.9.9 0 0 0-1.8 0v6.98l-.63-3.26a.9.9 0 0 0-1.77.34l.75 6.03c.25 2.02 1.52 3.1 3.38 3.1h1.29a2.38 2.38 0 0 0 2.38-2.05Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
  </StatSvg>;
}

export function earnedDefensiveContributionPoints(value: number, position: string | null): boolean {
  const normalizedPosition = position?.toUpperCase();
  const threshold = normalizedPosition === 'DEF' ? 10 : normalizedPosition === 'MID' || normalizedPosition === 'FWD' ? 12 : null;
  return threshold !== null && value >= threshold;
}
