import {
  Footprints,
  RectangleVertical,
  Shield,
  ShieldCheck,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import './player-stat-icons.css';

export interface PlayerStatSummary {
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  defensiveContributions: number;
  bonusPoints: number;
}

export function PlayerStatIcons({ className = '', position, stats }: { className?: string; position: string | null; stats: PlayerStatSummary }) {
  const icons: Array<{ key: string; label: string; value: number; icon: LucideIcon; tone?: 'yellow' | 'red' }> = [
    { key: 'goals', label: 'Goals scored', value: stats.goals, icon: Target },
    { key: 'assists', label: 'Assists', value: stats.assists, icon: Footprints },
    { key: 'clean-sheets', label: 'Clean sheets', value: stats.cleanSheets, icon: ShieldCheck },
    { key: 'yellow-cards', label: 'Yellow cards', value: stats.yellowCards, icon: RectangleVertical, tone: 'yellow' },
    { key: 'red-cards', label: 'Red cards', value: stats.redCards, icon: RectangleVertical, tone: 'red' },
    { key: 'defensive-contributions', label: 'Defensive contributions', value: stats.defensiveContributions, icon: Shield },
    { key: 'bonus', label: 'Bonus points', value: stats.bonusPoints, icon: Trophy },
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
            key={stat.key}
            role="img"
            title={`${stat.label}: ${stat.value}`}
          >
            <stat.icon aria-hidden="true" fill={stat.tone ? 'currentColor' : 'none'} size={11} />
            {stat.value > 1 ? <b className="player-profile__stat-multiplier">×{stat.value}</b> : null}
          </span>
        ))}
    </span>
  );
}

export function earnedDefensiveContributionPoints(value: number, position: string | null): boolean {
  const normalizedPosition = position?.toUpperCase();
  const threshold = normalizedPosition === 'DEF' ? 10 : normalizedPosition === 'MID' || normalizedPosition === 'FWD' ? 12 : null;
  return threshold !== null && value >= threshold;
}
