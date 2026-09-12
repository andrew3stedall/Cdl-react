import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';

export interface PageHeroViewOption {
  ariaLabel?: string;
  value: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

export interface PageHeroNotification {
  id: string;
  title: string;
  message: string;
  actionHref?: string | null;
}

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

export function PageHeroNotificationButton({
  notifications,
  onNavigate,
  onToggle,
  open,
}: {
  notifications: PageHeroNotification[];
  onNavigate: (href: string) => void;
  onToggle: () => void;
  open: boolean;
}) {
  return (
    <div className="cdl-page-hero__notifications">
      <button
        aria-expanded={open}
        aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ''}`}
        className="cdl-page-hero__notification-button"
        onClick={onToggle}
        title="Notifications"
        type="button"
      >
        <svg aria-hidden="true" className="cdl-page-hero__notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {notifications.length ? <span className="cdl-page-hero__notification-count">{notifications.length}</span> : null}
      </button>
      {open ? (
        <div aria-label="Notifications" className="cdl-page-hero__notifications-popover" role="dialog">
          <div className="cdl-page-hero__notifications-heading">
            <strong>Notifications</strong>
            <span>{notifications.length}</span>
          </div>
          {notifications.length === 0 ? <p className="cdl-page-hero__empty-copy">You are all caught up.</p> : notifications.map((notification) => (
            <a
              className="cdl-page-hero__notification"
              href={notification.actionHref ?? '#'}
              key={notification.id}
              onClick={(event) => {
                if (!notification.actionHref) {
                  event.preventDefault();
                  return;
                }
                event.preventDefault();
                onNavigate(notification.actionHref);
              }}
            >
              <strong>{notification.title}</strong>
              <span>{notification.message}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PageHeroControls({ children }: { children: ReactNode }) {
  return <div className="cdl-page-hero__controls">{children}</div>;
}
