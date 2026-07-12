import type { ReactNode } from 'react';
import { NavBar } from '@/components/layout/NavBar';

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
        <div className="px-4">{children}</div>
      </div>
      {!hideNav && <NavBar />}
    </div>
  );
}
