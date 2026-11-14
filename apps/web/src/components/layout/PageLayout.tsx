import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
  maxWidthClassName?: string;
}

export function PageLayout({
  children,
  maxWidthClassName = 'max-w-md md:max-w-4xl lg:max-w-6xl',
}: PageLayoutProps) {
  return (
    <div className={`mx-auto relative w-full flex-1 ${maxWidthClassName}`}>
      <main
        className="px-4 pt-2 md:px-8 md:pt-6 animate-fadeIn pb-24 md:pb-12"
        role="main"
      >
        {children}
      </main>
    </div>
  );
}
