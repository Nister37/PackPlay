import type { ReactNode } from 'react';
import { NavBar } from '@/components/layout/NavBar';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface PageLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function PageLayout({ children, hideNav = false }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <div
        className="mx-auto relative"
        style={{ maxWidth: '390px', paddingBottom: hideNav ? 0 : '80px' }}
      >
        {!hideNav ? (
          <header className="sticky top-0 z-40 flex justify-end px-4 pt-3 pointer-events-none">
            <div className="pointer-events-auto">
              <NotificationBell />
            </div>
          </header>
        ) : null}
        <div className="px-4">{children}</div>
      </div>
      {!hideNav && <NavBar />}
    </div>
  );
}
