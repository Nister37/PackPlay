import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white border border-brand-border rounded-lg p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
