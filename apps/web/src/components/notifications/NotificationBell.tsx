import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/types';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}M AGO`;
  if (diffHours < 24) return `${diffHours}H AGO`;
  return `${diffDays}D AGO`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markRead(notification.id);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative flex items-center justify-center w-10 h-10 border border-brand-border bg-white hover:bg-brand-bg transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <span className="text-lg leading-none" role="img" aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-headline font-bold px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-[340px] max-w-[calc(100vw-2rem)] bg-white border border-brand-border z-50 max-h-[480px] flex flex-col">
          {/* Dropdown Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border flex-shrink-0">
            <h2 className="font-headline font-bold text-sm uppercase tracking-wider text-brand-text">
              NOTIFICATIONS
            </h2>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="font-headline text-xs uppercase tracking-wider text-brand-muted hover:text-brand-text transition-colors"
              >
                MARK ALL READ
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 px-4">
                <p className="font-headline text-xs uppercase tracking-wider text-brand-muted text-center">
                  NO NEW NOTIFICATIONS
                </p>
              </div>
            ) : (
              <ul>
                {notifications.map((notification, index) => (
                  <li key={notification.id}>
                    <button
                      className={[
                        'w-full text-left px-4 py-3 transition-colors hover:bg-brand-bg',
                        !notification.read
                          ? 'bg-white border-l-2 border-l-primary'
                          : 'bg-brand-bg border-l-2 border-l-transparent',
                        index < notifications.length - 1 ? 'border-b border-brand-border' : '',
                      ].join(' ')}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-headline font-bold text-sm text-brand-text leading-snug">
                          {notification.title}
                        </p>
                        <span className="font-headline text-[10px] uppercase tracking-wider text-brand-muted flex-shrink-0 mt-0.5">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="font-body text-xs text-brand-muted mt-1 leading-relaxed">
                        {notification.body}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
