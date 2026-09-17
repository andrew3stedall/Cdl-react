import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';

import { GlobalNotifications } from './global-notifications';

export interface PageHeroViewOption {
  ariaLabel?: string;
  value: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

interface PageHeroProps {
  actions: ReactNode;
  actionsLabel: string;
  context?: ReactNode;
  onNavigate?: (href: string) => void;
  title: string;
  titleId: string;
}

export function PageHero({ actions, actionsLabel, context, onNavigate, title, titleId }: PageHeroProps) {
  return (
    <header className="cdl-page-hero" data-page-hero="shared">
      <div className="cdl-page-hero__brand-lockup">
        <span aria-hidden="true" className="cdl-page-hero__brand-mark"><Shield size={25} /></span>
        <div className="cdl-page-hero__copy">
          <p className="cdl-page-hero__brand-name">Castle Draft League</p>
          <h1 id={titleId}>{title}</h1>
          {context ? <p className="cdl-page-hero__context">{context}</p> : null}
        </div>
      </div>
      <div aria-label={actionsLabel} className="cdl-page-hero__actions">
        {actions}
        {onNavigate ? <GlobalNotifications onNavigate={onNavigate} /> : null}
      </div>
    </header>
  );
}

export function PageHeroViewToggle({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: PageHeroViewOption[];
  value: string;
}) {
  return (
    <div aria-label={ariaLabel} className="cdl-page-hero__view-toggle" role="group">
      {options.map((option) => (
        <button
          aria-label={option.ariaLabel ?? option.label}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          title={option.label}
          type="button"
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function PageHeroControls({ children }: { children: ReactNode }) {
  return <div className="cdl-page-hero__controls">{children}</div>;
}
