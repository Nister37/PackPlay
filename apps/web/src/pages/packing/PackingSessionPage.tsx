import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/api';
import type { PackingSession, SharedItem } from '@/types';

type DecisionType = 'PACKED' | 'NOT_PACKED' | 'SKIPPED';

interface DecidedItem {
  item: SharedItem;
  decision: DecisionType;
}

export function PackingSessionPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activityId = searchParams.get('activityId');

  const [session, setSession] = useState<PackingSession | null>(null);
  const [remainingItems, setRemainingItems] = useState<SharedItem[]>([]);
  const [decidedItems, setDecidedItems] = useState<DecidedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Card animation state
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Initialize session
  useEffect(() => {
    if (!activityId) {
      setInitError('No activity selected.');
      setIsInitializing(false);
      return;
    }

    let cancelled = false;

    async function init() {
      setIsInitializing(true);
      setInitError('');
      try {
        const listResp = await api.get('/packing-sessions', {
          params: { status: 'IN_PROGRESS' },
        });
        const sessions: PackingSession[] = listResp.data;
        let activeSession = sessions.find((s) => s.groupActivityId === activityId) ?? null;

        if (!activeSession) {
          const createResp = await api.post('/packing-sessions', { groupActivityId: activityId });
          activeSession = createResp.data as PackingSession;
        }

        if (cancelled) return;
        setSession(activeSession);

        const remainingResp = await api.get(`/packing-sessions/${activeSession!.id}/remaining`);
        const remaining: SharedItem[] = remainingResp.data;

        if (cancelled) return;
        setRemainingItems(remaining);
        setTotalItems(remaining.length);
        setCurrentIndex(0);
      } catch {
        if (!cancelled) setInitError('Failed to start packing session. Please try again.');
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const recordDecision = useMutation({
    mutationFn: ({
      sessionId,
      sharedItemId,
      decision,
    }: {
      sessionId: string;
      sharedItemId: string;
      decision: DecisionType;
    }) =>
      api
        .post(`/packing-sessions/${sessionId}/decisions`, { sharedItemId, decision })
        .then((r) => r.data),
  });

  const completeMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api.post(`/packing-sessions/${sessionId}/complete`).then((r) => r.data),
    onSuccess: () => setIsComplete(true),
  });

  const abandonMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api.post(`/packing-sessions/${sessionId}/abandon`).then((r) => r.data),
    onSuccess: () => navigate(`/groups/${groupId}`),
  });

  const goToNext = useCallback(() => {
    if (isAnimating) return;
    setSlideDir('left');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setSlideDir(null);
      setIsAnimating(false);
    }, 250);
  }, [isAnimating]);

  const goToPrev = useCallback(() => {
    if (isAnimating || currentIndex === 0) return;
    setSlideDir('right');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i - 1);
      setSlideDir(null);
      setIsAnimating(false);
    }, 250);
  }, [isAnimating, currentIndex]);

  const handleDecision = useCallback(
    async (decision: DecisionType) => {
      if (!session || remainingItems.length === 0 || isAnimating) return;
      const currentItem = remainingItems[currentIndex];
      if (!currentItem) return;

      setSessionLoading(true);
      try {
        await recordDecision.mutateAsync({
          sessionId: session.id,
          sharedItemId: currentItem.id,
          decision,
        });

        setDecidedItems((prev) => [...prev, { item: currentItem, decision }]);

        setRemainingItems((prev) => {
          const next = [...prev];
          next.splice(currentIndex, 1);
          return next;
        });

        setCurrentIndex((prev) => {
          const nextRemaining = remainingItems.length - 1;
          return Math.min(prev, nextRemaining - 1 < 0 ? 0 : nextRemaining - 1);
        });
      } catch {
        // silently keep current item shown
      } finally {
        setSessionLoading(false);
      }
    },
    [session, remainingItems, currentIndex, recordDecision, isAnimating],
  );

  const handleComplete = () => {
    if (!session) return;
    completeMutation.mutate(session.id);
  };

  const handleAbandon = () => {
    if (!session) return;
    abandonMutation.mutate(session.id);
  };

  const packedCount = decidedItems.filter((d) => d.decision === 'PACKED').length;
  const decidedCount = decidedItems.length;
  const progressTotal = totalItems || 1;
  const progressValue = Math.round((decidedCount / progressTotal) * 100);

  // Loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] flex flex-col items-center justify-center gap-4">
        <LoadingSpinner />
        <p className="font-headline text-xs uppercase tracking-wider text-brand-muted">
          LOADING PACKING SESSION...
        </p>
      </div>
    );
  }

  // Init error
  if (initError) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] flex flex-col items-center justify-center gap-6 text-center px-6">
        <p className="font-headline font-bold text-xl uppercase tracking-wider text-brand-text">
          SOMETHING WENT WRONG
        </p>
        <p className="font-body text-sm text-brand-muted">{initError}</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          ← GO BACK
        </Button>
      </div>
    );
  }

  // Completion screen
  if (isComplete || (remainingItems.length === 0 && decidedCount > 0)) {
    return (
      <div className="min-h-screen bg-[#2D6A4F] flex flex-col items-center justify-center text-center px-6">
        <span className="font-headline font-bold text-8xl text-white">✓</span>
        <h1 className="font-headline font-bold text-2xl uppercase tracking-wider text-white mt-4">
          MISSION COMPLETE
        </h1>
        <p className="text-white/80 text-lg mt-2 font-body">
          {packedCount} ITEMS PACKED
        </p>
        <div className="mt-8 w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={handleComplete}
            disabled={completeMutation.isPending}
            className="w-full min-h-[52px] bg-white text-[#2D6A4F] border-2 border-white font-headline font-bold uppercase tracking-wider disabled:opacity-60"
          >
            {completeMutation.isPending ? 'SAVING...' : 'COMPLETE MISSION'}
          </button>
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="w-full min-h-[52px] bg-transparent text-white border-2 border-white/50 font-headline font-bold uppercase tracking-wider"
          >
            RETURN TO GROUP
          </button>
        </div>
      </div>
    );
  }

  const currentItem = remainingItems[currentIndex];

  return (
    <div className="min-h-screen bg-[#FCF9F8] flex flex-col" style={{ maxWidth: '390px', margin: '0 auto' }}>
      {/* Header */}
      <div className="bg-[#1A1A1A] px-4 py-3 flex justify-between items-center shrink-0">
        <h1 className="font-headline font-bold text-white uppercase tracking-wide">PACKING</h1>
        <div className="flex items-center gap-3">
          <span className="font-headline text-xs text-[#2D6A4F] uppercase tracking-widest">
            ● LIVE SYNC
          </span>
          <button
            onClick={() => setShowAbandonConfirm(true)}
            className="font-headline text-[10px] text-[#FF4D00] uppercase tracking-widest"
          >
            ABANDON
          </button>
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-[#FCF9F8] px-4 py-3 border-b border-[#1A1A1A] shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-headline font-bold text-base text-brand-text">
            {decidedCount} / {totalItems} ITEMS
          </span>
          <span className="font-headline text-xs text-brand-muted uppercase tracking-widest">
            {progressValue}% READINESS
          </span>
        </div>
        <ProgressBar value={progressValue} />
      </div>

      {/* Main Swiper Area */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full flex items-center gap-3">
          {/* Prev arrow */}
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0 || isAnimating}
            className="w-10 h-10 flex items-center justify-center border border-[#1A1A1A] font-headline font-bold text-brand-text disabled:opacity-30 shrink-0"
            aria-label="Previous item"
          >
            ◀
          </button>

          {/* Card */}
          <div className="flex-1 overflow-hidden">
            {currentItem && (
              <div
                className="bg-white border-2 border-[#1A1A1A] rounded-lg p-6"
                style={{
                  transform:
                    slideDir === 'left'
                      ? 'translateX(-100%)'
                      : slideDir === 'right'
                        ? 'translateX(100%)'
                        : 'translateX(0)',
                  transition: 'transform 0.25s ease-in-out',
                  opacity: slideDir ? 0 : 1,
                }}
              >
                {/* Mandatory chip */}
                <div className="mb-4">
                  <span className="font-headline text-[10px] uppercase tracking-widest border border-[#FF4D00] text-[#FF4D00] px-2 py-0.5">
                    MANDATORY
                  </span>
                </div>

                {/* Item name */}
                <h2 className="font-headline font-bold text-3xl uppercase tracking-wide text-brand-text mb-4">
                  {currentItem.name}
                </h2>

                {/* Requirements */}
                <p className="font-headline text-sm text-brand-muted uppercase tracking-wider mb-1">
                  REQ: {currentItem.requiredQuantity}{' '}
                  {currentItem.unit ? currentItem.unit.toUpperCase() : 'UNIT'}
                </p>
                {currentItem.coveredQuantity != null && currentItem.coveredQuantity > 0 && (
                  <p className="font-headline text-sm text-brand-muted uppercase tracking-wider mb-1">
                    YOUR RESPONSIBILITY: {currentItem.coveredQuantity}{' '}
                    {currentItem.unit ? currentItem.unit.toUpperCase() : 'UNIT'}
                  </p>
                )}

                {/* Divider */}
                <div className="border-t border-dashed border-brand-border my-4" />

                {/* Counter */}
                <p className="font-headline text-xs text-brand-muted text-center uppercase tracking-widest">
                  Item {currentIndex + 1} of {remainingItems.length}
                </p>
              </div>
            )}
          </div>

          {/* Next arrow */}
          <button
            onClick={goToNext}
            disabled={currentIndex >= remainingItems.length - 1 || isAnimating}
            className="w-10 h-10 flex items-center justify-center border border-[#1A1A1A] font-headline font-bold text-brand-text disabled:opacity-30 shrink-0"
            aria-label="Next item"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="bg-white border-t-2 border-[#1A1A1A] px-4 py-4 shrink-0">
        <div className="flex gap-3">
          <button
            onClick={() => handleDecision('SKIPPED')}
            disabled={sessionLoading || isAnimating}
            className="flex-1 min-h-[52px] border border-[#1A1A1A] bg-transparent font-headline font-bold uppercase tracking-wider text-brand-text disabled:opacity-50"
          >
            SKIP
          </button>
          <button
            onClick={() => handleDecision('PACKED')}
            disabled={sessionLoading || isAnimating}
            className="flex-1 min-h-[52px] bg-[#FF4D00] text-white font-headline font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {sessionLoading ? '...' : 'PACKED ✓'}
          </button>
        </div>
      </div>

      {/* Abandon confirmation dialog */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full max-w-[390px] mx-auto bg-white border-t border-brand-border p-6 flex flex-col gap-4">
            <h3 className="font-headline font-bold text-lg uppercase tracking-wider text-brand-text">
              ABANDON SESSION?
            </h3>
            <p className="font-body text-sm text-brand-muted">
              Your progress will be lost. This cannot be undone.
            </p>
            <Button
              variant="urgent"
              fullWidth
              onClick={handleAbandon}
              loading={abandonMutation.isPending}
            >
              YES, ABANDON
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setShowAbandonConfirm(false)}
            >
              KEEP PACKING
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
