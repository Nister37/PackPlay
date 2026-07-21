import { Link, useLocation } from 'react-router-dom';

const PackingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="1"/>
    <path d="m16 7-4-4-4 4"/>
    <path d="M12 12v5"/>
    <path d="M9 15h6"/>
  </svg>
);

const GroupIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="7" r="4"/>
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
    <circle cx="19" cy="7" r="2"/>
    <path d="M23 21v-1a4 4 0 0 0-3-3.87"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const tabs = [
  { label: 'PACKING', path: '/packing', Icon: PackingIcon },
  { label: 'CHECKLISTS', path: '/checklists', Icon: PackingIcon },
  { label: 'MY GROUP', path: '/groups', Icon: GroupIcon },
  { label: 'CREATE\nGROUP', path: '/groups/new', Icon: PlusIcon },
];

export function NavBar() {
  const { pathname } = useLocation();

  function isActive(path: string): boolean {
    if (path === '/groups/new') {
      return pathname === '/groups/new';
    }
    if (path === '/groups') {
      return pathname.startsWith('/groups') && pathname !== '/groups/new';
    }
    return pathname.startsWith(path);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-brand-border z-50">
      <div className="flex max-w-[390px] mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center justify-center h-16 gap-1 transition-colors ${
                active ? 'text-[#FF4D00] border-t-2 border-[#FF4D00]' : 'text-[#1A1A1A] border-t-2 border-transparent'
              }`}
            >
              <tab.Icon />
              <span
                className="font-headline text-[10px] uppercase tracking-widest leading-tight text-center whitespace-pre-line"
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
