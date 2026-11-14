import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Item3DViewer } from '@/components/3d/Item3DViewer';

import { packingService } from '@/services/packing.service';
import { equipmentService } from '@/services/equipment.service';
import type { EquipmentItem, PackingSession, SharedItemWithCoverage } from '@/types';

type DecisionType = 'PACKED' | 'NOT_PACKED' | 'SKIPPED';

interface DecidedItem {
  item: EquipmentItem;
  decision: DecisionType;
  reason?: MissingReason;
}

type MissingReason = 'FORGOT' | 'COULD_NOT_BRING' | 'REPLACEMENT_ARRANGED' | 'NOT_NEEDED';

export function PackingSessionPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activityId = searchParams.get('activityId');

  const [session, setSession] = useState<PackingSession | null>(null);
  const [remainingItems, setRemainingItems] = useState<EquipmentItem[]>([]);
  const [unresolvedGroupItems, setUnresolvedGroupItems] = useState<SharedItemWithCoverage[]>([]);
  const [unresolvedAcknowledged, setUnresolvedAcknowledged] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [decidedItems, setDecidedItems] = useState<DecidedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Card animation & drag state
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartX = useRef<number>(0);

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
        const sessions = await packingService.listSessions('IN_PROGRESS');
        let activeSession = sessions.find((s) => s.groupActivityId === activityId) ?? null;

        if (!activeSession) {
          activeSession = await packingService.startSession({ groupActivityId: activityId ?? undefined });
        }

        if (cancelled) return;
        setSession(activeSession);

        const [remaining, sharedItems] = await Promise.all([
          packingService.getRemainingItems(activeSession.id),
          equipmentService.listSharedItems(activityId!),
        ]);

        if (cancelled) return;
        setRemainingItems(remaining);
        setUnresolvedGroupItems(sharedItems.filter((item) => item.coverage.uncoveredQuantity > 0));
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
      equipmentItemId,
      decision,
      reason,
    }: {
      sessionId: string;
      equipmentItemId: string;
      decision: DecisionType;
      reason?: MissingReason;
    }) =>
      packingService.recordDecision(sessionId, { equipmentItemId, decision, reason }),
  });

  const completeMutation = useMutation({
    mutationFn: (sessionId: string) => packingService.completeSession(sessionId),
    onSuccess: () => setIsComplete(true),
  });

  const abandonMutation = useMutation({
    mutationFn: (sessionId: string) => packingService.abandonSession(sessionId),
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
    async (decision: DecisionType, reason?: MissingReason) => {
      if (!session || remainingItems.length === 0 || isAnimating) return;
      const currentItem = remainingItems[currentIndex];
      if (!currentItem) return;

      setSessionLoading(true);
      try {
        await recordDecision.mutateAsync({
          sessionId: session.id,
          equipmentItemId: currentItem.id,
          decision,
          reason,
        });

        setDecidedItems((prev) => [...prev, { item: currentItem, decision, reason }]);

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
        setShowReasonPicker(false);
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
          <span className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> GO BACK
          </span>
        </Button>
      </div>
    );
  }

  // Completion screen
  if (isComplete || (remainingItems.length === 0 && decidedCount > 0)) {
    return (
      <div className="min-h-screen bg-[#2D6A4F] flex flex-col items-center justify-center text-center px-6">
        <CheckCircle2 className="w-20 h-20 text-white" />
        <h1 className="font-headline font-bold text-2xl uppercase tracking-wider text-white mt-4">
          MISSION COMPLETE
        </h1>
        <p className="text-white/80 text-lg mt-2 font-body">
          {packedCount} ITEMS PACKED
        </p>
        {unresolvedGroupItems.length > 0 && (
          <div className="mt-6 w-full max-w-[320px] border border-white/60 p-4 text-left text-white">
            <p className="font-headline text-sm font-bold uppercase">Unresolved group items</p>
            <ul className="mt-2 text-sm list-disc pl-5">
              {unresolvedGroupItems.map((item) => <li key={item.id}>{item.name} ({item.coverage.uncoveredQuantity} missing)</li>)}
            </ul>
            <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={unresolvedAcknowledged} onChange={(event) => setUnresolvedAcknowledged(event.target.checked)} />I reviewed these unresolved items</label>
          </div>
        )}
        <div className="mt-8 w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={handleComplete}
            disabled={completeMutation.isPending || (unresolvedGroupItems.length > 0 && !unresolvedAcknowledged)}
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isAnimating) return;
    pointerStartX.current = e.clientX;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragX(e.clientX - pointerStartX.current);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX > 75) {
      handleDecision('PACKED');
    } else if (dragX < -75) {
      setShowReasonPicker(true);
    }
    setDragX(0);
  };

  const currentItem = remainingItems[currentIndex];

  return (
    <div className="min-h-screen bg-[#FCF9F8] flex flex-col max-w-md md:max-w-xl mx-auto w-full shadow-sm">
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
            className="w-10 h-10 flex items-center justify-center border border-[#1A1A1A] font-headline font-bold text-brand-text disabled:opacity-30 shrink-0 hover:bg-black/5 transition-colors"
            aria-label="Previous item"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Card */}
          <div className="flex-1 overflow-hidden">
            {currentItem && (
              <div
                className="bg-white border-2 border-[#1A1A1A] rounded-lg p-6 select-none cursor-grab active:cursor-grabbing relative"
                style={{
                  transform: isDragging
                    ? `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`
                    : slideDir === 'left'
                      ? 'translateX(-100%)'
                      : slideDir === 'right'
                        ? 'translateX(100%)'
                        : 'translateX(0)',
                  transition: isDragging ? 'none' : 'transform 0.25s ease-in-out',
                  opacity: slideDir ? 0 : 1,
                  touchAction: 'none',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {/* Mandatory chip */}
                <div className="mb-4">
                  <span className="font-headline text-[10px] uppercase tracking-widest border border-[#FF4D00] text-[#FF4D00] px-2 py-0.5">
                    MANDATORY
                  </span>
                </div>

                {/* Item name */}
                <h2 className="font-headline font-bold text-3xl uppercase tracking-wide text-brand-text mb-2">
                  {currentItem.name}
                </h2>

                {/* 3D Item Visualization */}
                <Item3DViewer
                  name={currentItem.name}
                  category={currentItem.category ?? undefined}
                  height={170}
                  className="my-3 shadow-inner"
                />

                {/* Requirements */}
                <p className="font-headline text-sm text-brand-muted uppercase tracking-wider mb-1">
                  REQ: {currentItem.quantity} UNIT(S)
                </p>
                {currentItem.category && (
                  <p className="font-headline text-sm text-brand-muted uppercase tracking-wider mb-1">
                    CATEGORY: {currentItem.category}
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
            className="w-10 h-10 flex items-center justify-center border border-[#1A1A1A] font-headline font-bold text-brand-text disabled:opacity-30 shrink-0 hover:bg-black/5 transition-colors"
            aria-label="Next item"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="bg-white border-t-2 border-[#1A1A1A] px-4 py-4 shrink-0">
        {showReasonPicker ? (
          <div className="grid grid-cols-2 gap-2">
            {(['FORGOT', 'COULD_NOT_BRING', 'REPLACEMENT_ARRANGED', 'NOT_NEEDED'] as const).map((reason) => (
              <button key={reason} onClick={() => handleDecision('NOT_PACKED', reason)} disabled={sessionLoading} className="min-h-[48px] border border-[#1A1A1A] px-2 font-headline text-[10px] uppercase">{reason.replace(/_/g, ' ')}</button>
            ))}
            <button onClick={() => setShowReasonPicker(false)} className="col-span-2 text-xs uppercase underline">Cancel</button>
          </div>
        ) : <div className="flex gap-3">
          <button
            onClick={() => setShowReasonPicker(true)}
            disabled={sessionLoading || isAnimating}
            className="flex-1 min-h-[52px] border border-[#1A1A1A] bg-transparent font-headline font-bold uppercase tracking-wider text-brand-text disabled:opacity-50"
          >
            NOT PACKED
          </button>
          <button
            onClick={() => handleDecision('PACKED')}
            disabled={sessionLoading || isAnimating}
            className="flex-1 min-h-[52px] bg-[#FF4D00] text-white font-headline font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {sessionLoading ? '...' : (
              <span className="flex items-center justify-center gap-1.5">
                PACKED
              </span>
            )}
          </button>
        </div>}
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
