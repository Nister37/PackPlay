interface ProgressBarProps {
  value: number;
  label?: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="font-headline text-xs uppercase tracking-wider text-brand-text">
            {label}
          </span>
          <span className="font-headline text-xs text-brand-text">
            {clamped}%
          </span>
        </div>
      )}
      <div
        className="w-full border border-brand-border overflow-hidden"
        style={{ height: '8px' }}
      >
        <div
          className="h-full bg-secondary transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
