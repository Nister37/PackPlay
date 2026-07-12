import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col">
      {label && (
        <label
          htmlFor={inputId}
          className="font-headline text-xs uppercase tracking-wider mb-1 text-brand-text"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'w-full border border-brand-border px-3 py-2 bg-white font-body text-brand-text rounded-none',
          'focus:border-2 focus:border-brand-border',
          error && 'border-error focus:border-error',
          className,
        )}
        {...props}
      />
      {error && (
        <span className="text-error text-xs mt-1 font-body">{error}</span>
      )}
    </div>
  );
}
