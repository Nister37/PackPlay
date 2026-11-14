import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Luggage,
  ClipboardList,
  Users,
  PlusCircle,
  Settings as SettingsIcon,
} from 'lucide-react';

export const navTabs = [
  { label: 'PACKING', path: '/packing', Icon: Luggage },
  { label: 'CHECKLISTS', path: '/checklists', Icon: ClipboardList },
  { label: 'MY GROUP', path: '/groups', Icon: Users },
  { label: 'CREATE\nGROUP', path: '/groups/new', Icon: PlusCircle },
  { label: 'SETTINGS', path: '/settings', Icon: SettingsIcon },
];

let lastMobileIndicator: { left: number; width: number; ready: boolean } | null = null;

export function NavBar() {
  const { pathname } = useLocation();
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>(() => lastMobileIndicator || {
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
      lastMobileIndicator = next;
    } else if (activeIndex < 0) {
      setIndicatorStyle((prev) => ({ ...prev, ready: false }));
    }
  };

  useEffect(() => {
    updatePosition();
    // Re-check on next frame in case of dynamic layout settling
    const frameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frameId);
  }, [activeIndex, pathname]);

  useEffect(() => {
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [activeIndex]);

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t-2 border-brand-border z-50 shadow-lg md:hidden"
    >
      <div className="relative max-w-md mx-auto px-2">
        <div ref={navContainerRef} className="flex relative">
          {/* Animated sliding orange bar perfectly aligned to button */}
          <div
            className="absolute top-0 h-1 bg-[#FF4D00] rounded-b shadow-[0_2px_8px_rgba(255,77,0,0.5)] pointer-events-none z-10"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.ready ? 1 : 0,
              transition: 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1), width 300ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease',
            }}
          />

          {navTabs.map((tab, idx) => {
            const active = idx === activeIndex;
            return (
              <Link
                key={tab.path}
                ref={(el) => (tabRefs.current[idx] = el)}
                to={tab.path}
                className={`flex-1 flex flex-col items-center justify-center h-16 gap-1 pt-1 transition-all duration-300 ease-out active:scale-95 group select-none ${
                  active
                    ? 'text-[#FF4D00]'
                    : 'text-[#1A1A1A] hover:text-[#FF4D00]'
                }`}
              >
                <tab.Icon
                  className={`w-5 h-5 transition-all duration-300 ease-out ${
                    active
                      ? 'scale-110 stroke-[2.25] text-[#FF4D00]'
                      : 'scale-100 stroke-[1.75] text-[#1A1A1A] group-hover:text-[#FF4D00]'
                  }`}
                />
                <span
                  className={`font-headline text-[10px] uppercase tracking-widest leading-tight text-center whitespace-pre-line transition-colors duration-300 ease-out ${
                    active
                      ? 'font-bold text-[#FF4D00]'
                      : 'font-medium text-[#1A1A1A] group-hover:text-[#FF4D00]'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
