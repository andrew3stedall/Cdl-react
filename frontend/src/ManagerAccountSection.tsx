import { LogOut, UserRound } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { SessionState } from './contracts';

interface ManagerAccountSectionProps {
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  session: SessionState;
}

export function ManagerAccountSection({
  onNavigate,
  onSignOut,
  session,
}: ManagerAccountSectionProps) {
  const displayName = session.user?.displayName ?? 'Authenticated user';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';

  return (
    <details className="manager-account-menu">
      <summary aria-label={`Account menu for ${displayName}`}>
        <span aria-hidden="true" className="manager-account-menu__avatar">{initials}</span>
      </summary>
      <Card aria-label="Account menu" className="manager-account-menu__popover">
        <div className="manager-account-menu__header">
          <strong>{displayName}</strong>
          <span>Signed in</span>
        </div>
        <div className="manager-account-menu__actions">
          <Button onClick={() => onNavigate('/account')} type="button" variant="secondary">
            <UserRound aria-hidden="true" size={17} />
            Account
          </Button>
          <Button onClick={onSignOut} type="button" variant="ghost">
            <LogOut aria-hidden="true" size={17} />
            Sign out
          </Button>
        </div>
      </Card>
    </details>
  );
}
