import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Luggage,
  ClipboardList,
  Users,
  PlusCircle,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/hooks/useAuth';

const desktopTabs = [
  { label: 'PACKING', path: '/packing', Icon: Luggage },
  { label: 'CHECKLISTS', path: '/checklists', Icon: ClipboardList },
  { label: 'MY GROUP', path: '/groups', Icon: Users },
  { label: 'CREATE GROUP', path: '/groups/new', Icon: PlusCircle },
  { label: 'SETTINGS', path: '/settings', Icon: SettingsIcon },
];

let lastDesktopIndicator: { left: number; width: number; ready: boolean } | null = null;

export function DesktopHeader() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navContainerRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>(() => lastDesktopIndicator || {
    left: 0,
    width: 0,
    ready: false,
  });

  function getActiveIndex(): number {
    if (pathname === '/groups/new') return 3;
    if (pathname.startsWith('/groups')) return 2;
    if (pathname.startsWith('/packing')) return 0;
    if (pathname.startsWith('/checklists')) return 1;
    if (pathname.startsWith('/settings')) return 4;
    return -1;
  }

  const activeIndex = getActiveIndex();

  const updatePosition = () => {
    if (activeIndex >= 0 && tabRefs.current[activeIndex] && navContainerRef.current) {
      const el = tabRefs.current[activeIndex]!;
      const container = navContainerRef.current;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const next = {
        left: elRect.left - containerRect.left,
        width: elRect.width,
        ready: true,
      };
      setIndicatorStyle(next);
      lastDesktopIndicator = next;
    } else if (activeIndex < 0) {
      setIndicatorStyle((prev) => ({ ...prev, ready: false }));
    }
  };

  useEffect(() => {
    updatePosition();
    const frameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frameId);
  }, [activeIndex, pathname]);

  useEffect(() => {
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [activeIndex]);

  return (
    <header className="hidden md:block sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b-2 border-brand-border shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Brand / Logo */}
        <Link
          to="/dashboard"
          className="flex items-center gap-3 group transition-transform active:scale-95"
        >
          <img
            src="/packplay-logo.png"
            alt="PackPlay"
            className="w-9 h-9 object-contain"
          />
          <div>
            <span className="font-headline font-bold text-lg tracking-wider text-[#1A1A1A] block leading-none">
              PACKPLAY
            </span>
            <span className="font-headline text-[9px] uppercase tracking-widest text-[#FF4D00] block mt-0.5">
              READINESS OS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation with sliding orange underline indicator */}
        <nav ref={navContainerRef} className="relative flex items-center h-full">
          {/* Animated sliding orange bar perfectly aligned to button */}
          <div
            className="absolute bottom-0 h-1 bg-[#FF4D00] rounded-t shadow-[0_-2px_8px_rgba(255,77,0,0.5)] pointer-events-none z-10"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.ready ? 1 : 0,
              transition: 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1), width 300ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease',
            }}
          />

          <div className="flex h-full">
            {desktopTabs.map((tab, idx) => {
              const active = idx === activeIndex;
              return (
                <Link
                  key={tab.path}
                  ref={(el) => (tabRefs.current[idx] = el)}
                  to={tab.path}
                  className={`group flex items-center gap-2 px-4 h-full font-headline text-xs uppercase tracking-wider font-bold transition-all duration-300 ease-out select-none active:scale-95 ${
                    active
                      ? 'text-[#FF4D00] bg-[#FF4D00]/10'
                      : 'text-[#1A1A1A] hover:text-[#FF4D00] hover:bg-black/5'
                  }`}
                >
                  <tab.Icon
                    className={`w-4 h-4 transition-all duration-300 ${
                      active
                        ? 'scale-110 stroke-[2.25] text-[#FF4D00]'
                        : 'scale-100 stroke-[1.75] text-[#1A1A1A] group-hover:text-[#FF4D00]'
                    }`}
                  />
                  <span
                    className={`transition-colors duration-300 ${
                      active ? 'text-[#FF4D00]' : 'text-[#1A1A1A] group-hover:text-[#FF4D00]'
                    }`}
                  >
                    {tab.label.replace('\n', ' ')}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right Area: User Pill & Notifications */}
        <div className="flex items-center gap-4">
          <NotificationBell />

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-brand-border">
              <div className="flex flex-col text-right">
                <span className="font-headline text-xs font-bold text-[#1A1A1A] max-w-[120px] truncate">
                  {user.name || user.email.split('@')[0]}
                </span>
                <span className="font-headline text-[9px] uppercase text-[#916F65] tracking-widest">
                  ACTIVE
                </span>
              </div>
              <button
                onClick={logout}
                title="Log Out"
                className="w-8 h-8 rounded border border-brand-border flex items-center justify-center text-brand-muted hover:text-error hover:border-error transition-colors"
                aria-label="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
