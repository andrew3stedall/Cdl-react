import type { SVGProps } from 'react';

interface LeagueManagementIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Small, theme-aware castle mark for commissioner tools.
 *
 * The single-colour silhouette keeps the icon legible in the compact League
 * selector while matching the Castle Draft League cue.
 */
export function LeagueManagementIcon({ size = 24, ...props }: LeagueManagementIconProps) {
  return (
    <svg
      {...props}
      aria-hidden={props['aria-hidden'] ?? true}
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.2 21.5V2.5h2v2.7h1.6V2.5h2v2.7h1.6v16.3H2.2Z"
        fill="currentColor"
      />
      <path
        d="M14.6 21.5V5.2h1.6V2.5h2v2.7h1.6V2.5h2v19h-7.2Z"
        fill="currentColor"
      />
      <path
        d="M6.6 21.5V8.2h1.7V5.5h1.9v2.7h1.7V5.5h1.9v2.7h1.7V5.5h1.9v2.7h1.7v13.3H6.6Zm3.7 0v-3.8a1.7 1.7 0 0 1 3.4 0v3.8h-3.4Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
