import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { SquadApiNotification, SquadClient } from '../../squad-api';
import { HttpSquadClient } from '../../squad-api';

interface GlobalNotificationsContextValue {
  close: () => void;
  notifications: SquadApiNotification[];
  open: boolean;
  toggle: () => void;
}

const GlobalNotificationsContext = createContext<GlobalNotificationsContextValue | null>(null);
const defaultSquadClient = new HttpSquadClient();

export function GlobalNotificationsProvider({
  children,
  squadClient = defaultSquadClient,
}: {
  children: ReactNode;
  squadClient?: Pick<SquadClient, 'getNotifications'>;
}) {
  const [notifications, setNotifications] = useState<SquadApiNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void squadClient.getNotifications()
      .then((response) => {
        if (active) setNotifications(response.notifications ?? []);
      })
      .catch(() => {
        if (active) setNotifications([]);
      });

    return () => {
      active = false;
    };
  }, [squadClient]);

  const value = useMemo<GlobalNotificationsContextValue>(() => ({
    close: () => setOpen(false),
    notifications,
    open,
    toggle: () => setOpen((current) => !current),
  }), [notifications, open]);

  return (
    <GlobalNotificationsContext.Provider value={value}>
      {children}
    </GlobalNotificationsContext.Provider>
  );
}

export function GlobalNotifications({ onNavigate }: { onNavigate: (href: string) => void }) {
  const context = useContext(GlobalNotificationsContext);
  if (!context) return null;

  const { close, notifications, open, toggle } = context;
  const navigate = useCallback((href: string) => {
    close();
    onNavigate(href);
  }, [close, onNavigate]);

  return (
    <div className="global-notifications">
      <button
        aria-expanded={open}
        aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ''}`}
        className="global-notifications__button"
        onClick={toggle}
        title="Notifications"
        type="button"
      >
        <svg aria-hidden="true" className="global-notifications__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        <span className="global-notifications__label">Notifications</span>
        {notifications.length ? <span className="global-notifications__count">{notifications.length}</span> : null}
      </button>
      {open ? (
        <div aria-label="Notifications" className="global-notifications__popover" role="dialog">
          <div className="global-notifications__heading">
            <strong>Notifications</strong>
            <span>{notifications.length}</span>
          </div>
          {notifications.length === 0 ? <p className="global-notifications__empty">You are all caught up.</p> : notifications.map((notification) => (
            <a
              className="global-notifications__item"
              href={notification.action_href || '#'}
              key={notification.id}
              onClick={(event) => {
                if (!notification.action_href) {
                  event.preventDefault();
                  return;
                }
                event.preventDefault();
                navigate(notification.action_href);
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

export function GlobalPageHeader({
  children,
  className,
  onNavigate,
}: {
  children: ReactNode;
  className?: string;
  onNavigate?: (href: string) => void;
}) {
  return (
    <header className={`global-page-header${className ? ` ${className}` : ''}`}>
      <div className="global-page-header__copy">{children}</div>
      {onNavigate ? <GlobalNotifications onNavigate={onNavigate} /> : null}
    </header>
  );
}
