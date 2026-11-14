import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'urgent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-headline font-bold uppercase tracking-wider text-sm border border-brand-border transition-all duration-150 ease-out active:scale-[0.97] hover:brightness-105 active:brightness-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

  const variants = {
    primary: 'bg-brand-border text-white',
    urgent: 'bg-primary text-white border-primary',
    ghost: 'bg-transparent text-brand-text',
  };

  const sizes = {
    sm: 'min-h-[36px] px-3 text-xs',
    md: 'min-h-[48px] px-4',
    lg: 'min-h-[56px] px-6 text-base',
  };

  return (
    <button
      className={clsx(
        base,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
}
