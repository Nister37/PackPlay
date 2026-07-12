import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface LiveTakeoverAlertProps {
  message: string;
  itemName: string;
  onDismiss: () => void;
  onTakeOver?: () => void;
}

const AUTO_DISMISS_MS = 10_000;

export function LiveTakeoverAlert({
  message,
  itemName,
  onDismiss,
  onTakeOver,
}: LiveTakeoverAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed bottom-20 left-1/2 z-50 w-full"
      style={{
        maxWidth: '390px',
        transform: 'translateX(-50%)',
        padding: '0 1rem',
      }}
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-white border-l-4 border-l-primary border border-brand-border rounded-lg px-4 py-3 flex items-start gap-3">
        {/* Icon */}
        <span
          className="text-primary text-lg leading-none flex-shrink-0 mt-0.5"
          role="img"
          aria-hidden="true"
        >
          ⚠
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-headline font-bold text-xs uppercase tracking-wider text-brand-text leading-snug">
            {message}
          </p>
          <p className="font-headline font-bold text-sm uppercase tracking-wider text-primary mt-0.5 truncate">
            {itemName}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-1">
          {onTakeOver && (
            <Button
              variant="urgent"
              size="md"
              onClick={() => {
                onTakeOver();
                onDismiss();
              }}
              className="text-xs px-3 min-h-[36px]"
            >
              TAKE OVER
            </Button>
          )}
          <button
            onClick={onDismiss}
            className="font-headline font-bold text-sm text-brand-muted hover:text-brand-text transition-colors leading-none flex-shrink-0"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
