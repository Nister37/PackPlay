import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import type { SharedItemWithCoverage } from '@/types';

interface LiveTakeoverAlertProps {
  item: SharedItemWithCoverage;
  isTakingOver: boolean;
  error?: string | null;
  onCannotHelp: () => void;
  onTakeOver: () => void;
}

const MISSING_STATUSES = new Set(['FORGOT', 'COULD_NOT_BRING']);
const DISMISS_DRAG_PX = 90;

export function LiveTakeoverAlert({
  item,
  isTakingOver,
  error,
  onCannotHelp,
  onTakeOver,
}: LiveTakeoverAlertProps) {
  const [isEntered, setIsEntered] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const takeOverButtonRef = useRef<HTMLButtonElement>(null);
  const cannotHelpButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      setIsEntered(true);
      takeOverButtonRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const missingResponsibility = item.responsibilities.find((responsibility) =>
    MISSING_STATUSES.has(responsibility.status),
  );
  const previousOwner = missingResponsibility?.user.name;
  const alertMessage = previousOwner
    ? `${item.name} is no longer covered. ${previousOwner} could not bring it.`
    : `${item.name} is not covered. The group still needs ${item.coverage.uncoveredQuantity}.`;
  const statusMessage = previousOwner
    ? `Status: Unassigned from ${previousOwner}.`
    : 'Status: Unassigned.';

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    setTouchStartY(event.touches[0].clientY);
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (touchStartY == null) return;
    setDragY(Math.max(0, event.touches[0].clientY - touchStartY));
  };

  const handleTouchEnd = () => {
    if (dragY >= DISMISS_DRAG_PX) {
      onCannotHelp();
      return;
    }
    setTouchStartY(null);
    setDragY(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCannotHelp();
      return;
    }
    if (event.key !== 'Tab') return;

    const firstButton = takeOverButtonRef.current;
    const lastButton = cannotHelpButtonRef.current;
    if (!firstButton || !lastButton) return;
    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="takeover-alert-title"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-[#1C1B1B]/40 backdrop-blur-[6px]"
        onClick={onCannotHelp}
        aria-label="Dismiss critical availability alert"
        tabIndex={-1}
      />

      <section
        className="fixed bottom-0 left-1/2 z-10 w-full max-w-[390px] border-t-2 border-[#1C1B1B] bg-white transition-transform duration-500 ease-out"
        style={{
          transform: `translate(-50%, ${isEntered ? dragY : 520}px)`,
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-2 w-full bg-[#AA3000]" />
        <div className="space-y-6 px-4 pb-10 pt-6">
          <div className="flex items-center gap-2 text-[#AA3000]">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#AA3000] font-headline text-xs font-bold text-white"
              aria-hidden="true"
            >
              !
            </span>
            <h2
              id="takeover-alert-title"
              className="font-headline text-xs font-bold uppercase leading-none tracking-[0.05em]"
            >
              Critical Availability Alert
            </h2>
          </div>

          <div className="space-y-2">
            <p className="font-headline text-2xl font-bold uppercase leading-[1.1] tracking-[-0.01em] text-[#1C1B1B]">
              {alertMessage}
            </p>
            <div className="flex min-h-20 items-start gap-4 border border-[#1C1B1B] bg-[#F0EDED] p-4">
              <div
                className="h-20 w-20 shrink-0 border border-[#1C1B1B] bg-white"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-headline text-xs font-bold uppercase leading-none tracking-[0.05em] text-[#5C4037]">
                  Missing Equipment
                </p>
                <p className="mt-1 font-body text-lg font-bold leading-6 text-[#1C1B1B]">
                  {item.name}
                </p>
                <p className="mt-1 font-body text-base leading-6 text-[#5C4037]">{statusMessage}</p>
              </div>
            </div>
          </div>

          {error ? (
            <p className="font-body text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-4">
            <button
              ref={takeOverButtonRef}
              type="button"
              onClick={onTakeOver}
              disabled={isTakingOver}
              className="flex h-16 w-full items-center justify-center gap-4 border border-[#1C1B1B] bg-[#D43F00] font-headline text-xl font-bold uppercase text-white shadow-[4px_4px_0_0_#1A1A1A] transition-[transform,box-shadow] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTakingOver ? 'TAKING OVER…' : 'TAKE OVER'}
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                <path d="M13.15 2.25 5.5 13.1h5.42l-.86 8.65 8.44-11.9h-5.73l.38-7.6Zm1.48 9.6-2.04 2.88.28-3.63H9.36l1.79-2.54-.16 3.29h3.64Z" />
              </svg>
            </button>
            <button
              ref={cannotHelpButtonRef}
              type="button"
              onClick={onCannotHelp}
              disabled={isTakingOver}
              className="h-12 w-full font-headline text-xs font-bold uppercase tracking-[0.05em] text-[#5C4037] disabled:opacity-60"
            >
              Cannot Help
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
