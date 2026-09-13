export type ChipIconVariant = 'triple-captain' | 'dual-captain' | 'bench-boost' | 'auto-captain';

interface ChipIconProps {
  className?: string;
  variant: ChipIconVariant;
}

/**
 * The chip artwork is deliberately inline SVG so it remains crisp at the
 * compact squad-control size and can follow the app's theme foreground.
 * `currentColor` is the visible mark; surface-coloured details are cut-outs.
 */
export function ChipIcon({ className = '', variant }: ChipIconProps) {
  const classNames = ['chip-icon', `chip-icon--${variant}`, className].filter(Boolean).join(' ');

  return (
    <svg
      aria-hidden="true"
      className={classNames}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      {variant === 'triple-captain' ? <TripleCaptainIcon /> : null}
      {variant === 'dual-captain' ? <DualCaptainIcon /> : null}
      {variant === 'bench-boost' ? <BenchBoostIcon /> : null}
      {variant === 'auto-captain' ? <AutoCaptainIcon /> : null}
    </svg>
  );
}

function CaptainBadge({ label }: { label: 'x2' | 'x3' }) {
  return (
    <>
      <circle cx="10" cy="11" fill="currentColor" r="8.05" />
      <circle cx="17.2" cy="16.75" fill="currentColor" r="4.95" />
      <text
        dominantBaseline="middle"
        fill="var(--surface)"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.6"
        fontWeight="800"
        textAnchor="middle"
        x="10"
        y="11.15"
      >
        {label === 'x3' ? 'C' : 'VC'}
      </text>
      <text
        dominantBaseline="middle"
        fill="var(--surface)"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="4.5"
        fontWeight="800"
        textAnchor="middle"
        x="17.2"
        y="16.95"
      >
        {label}
      </text>
    </>
  );
}

function TripleCaptainIcon() {
  return (
    <>
      <path d="M7.1 4.7 10.1 2.5h3.8l3 2.2 4.05 3.55-2.35 3.2-2.42-1.7v10.1H7.82V9.75l-2.42 1.7-2.35-3.2Z" fill="currentColor" />
      <path d="M10.1 2.5h1.35v15.35H10.1Zm2.45 0h1.35v15.35h-1.35Z" fill="var(--surface)" opacity=".82" />
      <path d="M7.1 4.7 10.1 2.5h3.8l3 2.2 4.05 3.55-2.35 3.2-2.42-1.7v10.1H7.82V9.75l-2.42 1.7-2.35-3.2Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth=".7" />
      <circle cx="18.55" cy="6.35" fill="currentColor" r="4.05" />
      <text
        dominantBaseline="middle"
        fill="var(--surface)"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="5.6"
        fontWeight="800"
        textAnchor="middle"
        x="18.55"
        y="6.45"
      >
        C
      </text>
      <rect fill="currentColor" height="4.1" rx="2.05" width="9.6" x="7.2" y="18.15" />
      <text
        dominantBaseline="middle"
        fill="var(--surface)"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="4.7"
        fontWeight="800"
        textAnchor="middle"
        x="12"
        y="20.25"
      >
        x3
      </text>
    </>
  );
}

function DualCaptainIcon() {
  return <CaptainBadge label="x2" />;
}

function BenchBoostIcon() {
  return (
    <>
      <circle cx="12" cy="12" fill="currentColor" r="9.15" />
      <g fill="var(--surface)">
        <rect height="1.95" rx="0.98" width="16.3" x="3.85" y="12.2" />
        <rect height="1.95" rx="0.98" width="16.3" x="3.85" y="15.05" />
        <rect height="2.65" rx="0.8" width="1.45" x="5.2" y="16.1" />
        <rect height="2.65" rx="0.8" width="1.45" x="17.35" y="16.1" />
      </g>
      <g stroke="var(--surface)" strokeLinecap="round" strokeWidth="1.45">
        <path d="M5.45 8.7h2.35M6.63 7.53v2.35" />
        <path d="M8.72 8.7h2.35M9.9 7.53v2.35" />
        <path d="M11.99 8.7h2.35M13.17 7.53v2.35" />
        <path d="M15.26 8.7h2.35M16.44 7.53v2.35" />
        <path d="M18.53 8.7h.02M18.54 7.53v2.35" />
      </g>
    </>
  );
}

function AutoCaptainIcon() {
  return (
    <>
      <circle cx="10" cy="11" fill="currentColor" r="8.05" />
      <circle cx="17.2" cy="16.75" fill="currentColor" r="4.95" />
      <text
        dominantBaseline="middle"
        fill="var(--surface)"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.6"
        fontWeight="800"
        textAnchor="middle"
        x="10"
        y="11.15"
      >
        C
      </text>
      <path
        d="M19.55 14.35a3.25 3.25 0 0 0-4.72-.54l-.52.48m.52-.48-.1 1.3m.1-1.3 1.27.2M14.85 18.95a3.25 3.25 0 0 0 4.72.54l.52-.48m-.52.48.1-1.3m-.1 1.3-1.27-.2"
        fill="none"
        stroke="var(--surface)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.18"
      />
      <path d="m15.15 14.5 1.55-.15-.86 1.3Z" fill="var(--surface)" />
      <path d="m19.18 18.8-1.55.15.86-1.3Z" fill="var(--surface)" />
    </>
  );
}
