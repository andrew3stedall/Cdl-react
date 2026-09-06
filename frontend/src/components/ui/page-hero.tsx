import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';

interface PageHeroProps {
  actions: ReactNode;
  actionsLabel: string;
  context?: ReactNode;
  title: string;
  titleId: string;
}

export function PageHero({ actions, actionsLabel, context, title, titleId }: PageHeroProps) {
  return (
    <header className="cdl-page-hero">
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
      </div>
    </header>
  );
}
