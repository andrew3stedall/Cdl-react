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
    <Card aria-label="Account settings" className="manager-account-section">
      <div className="manager-account-section__summary">
        <span aria-hidden="true" className="manager-account-section__avatar">{initials}</span>
        <div>
          <strong>{displayName}</strong>
          <span>Signed in</span>
        </div>
      </div>

      <div className="manager-account-section__actions">
        <Button onClick={() => onNavigate('/account')} type="button" variant="secondary">
          <UserRound aria-hidden="true" size={18} />
          Account
        </Button>
        <Button onClick={onSignOut} type="button" variant="ghost">
          <LogOut aria-hidden="true" size={18} />
          Sign out
        </Button>
      </div>
    </Card>
  );
}
