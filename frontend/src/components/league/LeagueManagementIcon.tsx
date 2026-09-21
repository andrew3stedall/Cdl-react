import type { SVGProps } from 'react';

interface LeagueManagementIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Small, theme-aware castle-and-ball mark for commissioner tools.
 *
 * The single-colour treatment keeps the icon legible in the compact League
 * selector while the castle silhouette retains the Castle Draft League cue.
 */
export function LeagueManagementIcon({ size = 24, ...props }: LeagueManagementIconProps) {
  return (
    <svg
      {...props}
      aria-hidden={props['aria-hidden'] ?? true}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 21.25V3.25h2.4v3h1.45v-3h2.4v3h1.45v7.1h-3v10.9H2.5Zm12.3 0v-10.9h-3v-7.1h1.45v3h1.45v-3h2.4v3h1.45v-3h2.4v18h-6.15Z"
        fill="currentColor"
      />
      <path
        d="M7.2 10.35h9.6v10.9H7.2V10.35Z"
        fill="currentColor"
      />
      <circle cx="12" cy="16.55" fill="var(--card)" r="3.7" stroke="currentColor" strokeWidth="1.45" />
      <path
        d="m12 12.85 1.15 1.65-.44 1.95H11.3l-.45-1.95L12 12.85Zm-2.95 2.1 1.66.3m2.58 0 1.66-.3m-4.15 1.2-.82 1.45m3.94-1.45.82 1.45m-3.14 1.1h1.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="0.9"
      />
    </svg>
  );
}
