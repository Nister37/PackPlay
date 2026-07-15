import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { NavBar } from '@/components/layout/NavBar';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { Group, GroupActivity, SharedItemWithCoverage } from '@/types';

// ─── Persistence helpers ──────────────────────────────────────────────────────

function skipKey(userId: string, activityId: string) {
  return `pack:skip:${userId}:${activityId}`;
}

function loadSkipped(userId: string, activityId: string): Set<string> {
  try {
    const raw = localStorage.getItem(skipKey(userId, activityId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSkipped(userId: string, activityId: string, ids: Set<string>) {
  try {
    localStorage.setItem(skipKey(userId, activityId), JSON.stringify([...ids]));
  } catch {}
}

// ─── Group Selector ───────────────────────────────────────────────────────────

function GroupPills({
  groups,
  selectedId,
  onSelect,
}: {
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
      {groups.map((g) => {
        const active = g.id === selectedId;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={[
              'shrink-0 font-headline font-bold text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors whitespace-nowrap',
              active
                ? 'bg-primary border-primary text-white'
                : 'bg-white/10 border-white/30 text-white hover:bg-white/20',
            ].join(' ')}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Swipe Card ───────────────────────────────────────────────────────────────

function SwipeCard({
  item,
  slideDir,
  dragX,
  isDragging,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  item: SharedItemWithCoverage;
  slideDir: 'left' | 'right' | null;
  dragX: number;
  isDragging: boolean;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}) {
  const coveredQty = item.coverage.committedQuantity;
  const totalQty = item.requiredQuantity;
  const stillNeeded = item.coverage.uncoveredQuantity;

  const dragRatio = Math.min(Math.abs(dragX) / 100, 1);
  const showRight = isDragging ? dragX > 30 : slideDir === 'right';
  const showLeft = isDragging ? dragX < -30 : slideDir === 'left';

  let transform: string;
  if (isDragging) {
    transform = `translateX(${dragX}px) rotate(${dragX * 0.035}deg)`;
  } else if (slideDir === 'right') {
    transform = 'translateX(130%) rotate(12deg)';
  } else if (slideDir === 'left') {
    transform = 'translateX(-130%) rotate(-12deg)';
  } else {
    transform = 'translateX(0) rotate(0deg)';
  }

  return (
    <div
      className="relative w-full"
      style={{
        transform,
        transition: isDragging ? 'none' : 'transform 260ms ease-in-out',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Right-swipe label: I'LL BRING IT */}
      {showRight && (
        <div
          className="absolute top-5 left-4 z-10 border-4 border-[#2D6A4F] rounded px-3 py-1"
          style={{ opacity: Math.min(dragRatio * 1.5, 1), transform: 'rotate(-18deg)' }}
        >
          <span className="font-headline font-bold text-base text-[#2D6A4F] uppercase tracking-widest leading-none">
            I'LL BRING IT
          </span>
        </div>
      )}

      {/* Left-swipe label: NOT MY JOB */}
      {showLeft && (
        <div
          className="absolute top-5 right-4 z-10 border-4 border-[#916F65] rounded px-3 py-1"
          style={{ opacity: Math.min(dragRatio * 1.5, 1), transform: 'rotate(18deg)' }}
        >
          <span className="font-headline font-bold text-base text-[#916F65] uppercase tracking-widest leading-none">
            NOT MY JOB
          </span>
        </div>
      )}

      {/* Card body */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-sm">
        {/* Top strip */}
        <div className="bg-[#1A1A1A] px-4 py-2 flex items-center justify-between">
          <span className="font-headline text-[10px] uppercase tracking-widest text-[#916F65]">
            ITEM NEEDED
          </span>
          <span
            className="font-headline font-bold text-xs uppercase tracking-widest"
            style={{ color: stillNeeded > 0 ? '#FF4D00' : '#2D6A4F' }}
          >
            {stillNeeded > 0 ? `${stillNeeded} STILL NEEDED` : 'COVERED ✓'}
          </span>
        </div>

        {/* Content */}
        <div className="px-5 pt-8 pb-5">
          <p className="font-headline font-bold text-4xl uppercase tracking-tight text-[#1A1A1A] leading-none mb-2">
            {item.name}
          </p>
          {item.notes && (
            <p className="font-body text-sm text-[#5C4037] mt-1">{item.notes}</p>
          )}

          {/* Coverage row */}
          <div className="mt-6">
            <div className="flex items-end justify-between mb-1.5">
              <span className="font-headline text-[10px] uppercase tracking-widest text-[#5C4037]">
                COMMITTED
              </span>
              <span className="font-headline font-bold text-2xl text-[#1A1A1A] leading-none">
                {coveredQty}
                <span className="text-base font-normal text-[#5C4037]"> / {totalQty}</span>
              </span>
            </div>
            <div className="w-full h-2 border border-[#1A1A1A] bg-[#FCF9F8]">
              <div
                className="h-full transition-all"
                style={{
                  width: `${totalQty > 0 ? Math.min((coveredQty / totalQty) * 100, 100) : 0}%`,
                  background: coveredQty >= totalQty ? '#2D6A4F' : '#FF4D00',
                }}
              />
            </div>
          </div>

          {/* Who's already bringing it */}
          {item.responsibilities.filter(r => ['COMMITTED', 'PACKED'].includes(r.status)).length > 0 && (
            <div className="mt-4 flex flex-col gap-1">
              {item.responsibilities
                .filter(r => ['COMMITTED', 'PACKED'].includes(r.status))
                .map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                      <span className="font-headline font-bold text-[8px] text-white">
                        {r.user.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-body text-xs text-[#5C4037] truncate">
                      {r.user.name} · {r.committedQuantity} unit{r.committedQuantity !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[#1A1A1A]/20 px-5 py-3 flex items-center justify-between bg-[#FCF9F8]">
          <span className="font-headline text-[10px] uppercase tracking-widest text-[#916F65]">
            ← NOT MY JOB
          </span>
          <span className="font-headline text-[10px] uppercase tracking-widest text-[#2D6A4F]">
            I'LL BRING IT →
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function GeneralPackingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [decidedIds, setDecidedIds] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number>(0);

  // ── Fetch groups ──────────────────────────────────────────────────────────
  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data),
  });

  useEffect(() => {
    if (groups && groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const handleSelectGroup = (id: string) => {
    if (id === selectedGroupId) return;
    setSelectedGroupId(id);
    setDecidedIds(new Set());
    setSlideDir(null);
    setIsAnimating(false);
    setDragX(0);
  };

  // ── Fetch activities ──────────────────────────────────────────────────────
  const { data: activities, isLoading: activitiesLoading } = useQuery<GroupActivity[]>({
    queryKey: ['activities', selectedGroupId],
    queryFn: () =>
      api.get(`/groups/${selectedGroupId}/activities`).then((r) => r.data),
    enabled: !!selectedGroupId,
  });

  const activityId = activities?.[0]?.id;

  // ── Load persisted skips when activity changes ────────────────────────────
  useEffect(() => {
    if (!activityId || !user?.id) return;
    setSkippedIds(loadSkipped(user.id, activityId));
    setDecidedIds(new Set());
  }, [activityId, user?.id]);

  // ── Fetch shared items ────────────────────────────────────────────────────
  const { data: sharedItems, isLoading: itemsLoading } = useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () =>
      api.get(`/activities/${activityId}/shared-items`).then((r) => r.data),
    enabled: !!activityId,
  });

  // ── Pending items: uncovered + not already decided by this user ───────────
  const pendingItems = useMemo(() => {
    if (!sharedItems) return [];
    const userId = user?.id;
    return sharedItems.filter((item) => {
      // Already covered by enough commitments → skip
      if (item.coverage.uncoveredQuantity <= 0) return false;
      // Current user already has an active commitment → skip
      if (
        userId &&
        item.responsibilities.some(
          (r) => r.userId === userId && ['COMMITTED', 'PACKED'].includes(r.status),
        )
      )
        return false;
      // User explicitly said "not my job" → skip
      if (skippedIds.has(item.id)) return false;
      // User already decided this item in the current session → skip
      if (decidedIds.has(item.id)) return false;
      return true;
    });
  }, [sharedItems, skippedIds, decidedIds, user?.id]);

  const currentItem = pendingItems[0] ?? null;
  const decidedCount = decidedIds.size;
  const totalCards = pendingItems.length + decidedCount;
  const isDone = !itemsLoading && activityId != null && pendingItems.length === 0;

  // ── Claim mutation ────────────────────────────────────────────────────────
  const claimMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      api.post(`/shared-items/${itemId}/claim`, { quantity: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  // ── Card advance ──────────────────────────────────────────────────────────
  const advance = () => {
    setDragX(0);
    setSlideDir(null);
    setIsAnimating(false);
  };

  const handleAction = (dir: 'left' | 'right') => {
    if (isAnimating || !currentItem) return;
    setIsAnimating(true);
    setIsDragging(false);
    setSlideDir(dir);

    // Immediately mark as decided so it's removed from pendingItems
    const nextDecided = new Set(decidedIds);
    nextDecided.add(currentItem.id);
    setDecidedIds(nextDecided);

    if (dir === 'right') {
      // Claim: "I'll bring it"
      claimMutation.mutate({
        itemId: currentItem.id,
        qty: currentItem.coverage.uncoveredQuantity,
      });
    } else {
      // Skip: "Not my job" — persist in localStorage
      if (user?.id && activityId) {
        const next = new Set(skippedIds);
        next.add(currentItem.id);
        setSkippedIds(next);
        saveSkipped(user.id, activityId, next);
      }
    }

    setTimeout(advance, 280);
  };

  // ── Touch handlers ────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setDragX(e.touches[0].clientX - touchStartX.current);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragX) > 80) {
      handleAction(dragX > 0 ? 'right' : 'left');
    } else {
      setDragX(0);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FCF9F8] flex flex-col" style={{ paddingBottom: '80px' }}>
      {/* Dark header */}
      <div className="bg-[#1A1A1A] px-4 pt-12 pb-4">
        <div className="max-w-[390px] mx-auto">
          <h1 className="font-headline font-bold text-lg text-white uppercase tracking-wide mb-3">
            PACKING
          </h1>

          {groupsLoading ? (
            <div className="h-8 flex items-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : groups && groups.length > 0 ? (
            <GroupPills
              groups={groups}
              selectedId={selectedGroupId}
              onSelect={handleSelectGroup}
            />
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col max-w-[390px] mx-auto w-full px-4">
        {/* No groups */}
        {!groupsLoading && (!groups || groups.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <p className="font-headline font-bold text-sm uppercase tracking-widest text-brand-text mb-2">
              NO MISSIONS
            </p>
            <p className="font-body text-xs text-brand-muted mb-6">
              Join or create a group to start packing.
            </p>
            <Button variant="urgent" onClick={() => navigate('/groups/new')}>
              + CREATE MISSION
            </Button>
          </div>
        )}

        {/* Loading */}
        {selectedGroupId && (activitiesLoading || itemsLoading) && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* No activity */}
        {!activitiesLoading && selectedGroupId && activities && activities.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <p className="font-headline font-bold text-sm uppercase tracking-widest text-brand-muted mb-2">
              NO ACTIVITY SCHEDULED
            </p>
            <p className="font-body text-xs text-brand-muted">
              This group has no active mission yet.
            </p>
          </div>
        )}

        {/* All done */}
        {isDone && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 rounded-full bg-[#2D6A4F] flex items-center justify-center mb-4 border-2 border-[#1A1A1A]">
              <span className="text-white text-3xl font-bold">✓</span>
            </div>
            <p className="font-headline font-bold text-xl uppercase tracking-widest text-[#2D6A4F] mb-1">
              YOU'RE DONE!
            </p>
            <p className="font-body text-sm text-brand-muted mb-6 max-w-[260px]">
              You've responded to all items. Check the group page to see the full manifest.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (selectedGroupId) navigate(`/groups/${selectedGroupId}`);
                }}
                className="font-headline font-bold text-xs uppercase tracking-widest bg-[#1A1A1A] text-white px-4 py-3"
              >
                VIEW GROUP →
              </button>
              <button
                type="button"
                onClick={() => {
                  setDecidedIds(new Set());
                  queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
                }}
                className="font-headline text-xs uppercase tracking-widest text-brand-muted border border-brand-border px-4 py-3"
              >
                REFRESH
              </button>
            </div>
          </div>
        )}

        {/* Swipe cards */}
        {!itemsLoading && !isDone && currentItem && (
          <div className="flex-1 flex flex-col justify-between pt-5 pb-4">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-headline text-[10px] uppercase tracking-widest text-brand-muted">
                {decidedCount + 1} / {totalCards}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: totalCards }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full"
                    style={{
                      width: i === decidedCount ? '24px' : '8px',
                      background:
                        i < decidedCount ? '#2D6A4F' : i === decidedCount ? '#FF4D00' : '#E0D4CE',
                      transition: 'all 200ms',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Card */}
            <div className="flex-1 flex items-center">
              <div className="w-full">
                <SwipeCard
                  item={currentItem}
                  slideDir={slideDir}
                  dragX={dragX}
                  isDragging={isDragging}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => handleAction('left')}
                disabled={isAnimating}
                className="flex-1 min-h-[52px] border-2 border-[#1A1A1A] bg-white font-headline font-bold text-xs uppercase tracking-widest text-[#1A1A1A] flex items-center justify-center disabled:opacity-50"
              >
                ← NOT MY JOB
              </button>
              <button
                type="button"
                onClick={() => handleAction('right')}
                disabled={isAnimating || claimMutation.isPending}
                className="flex-1 min-h-[52px] bg-primary border-2 border-primary font-headline font-bold text-xs uppercase tracking-widest text-white flex items-center justify-center disabled:opacity-50"
              >
                {claimMutation.isPending ? '...' : "I'LL BRING IT →"}
              </button>
            </div>
          </div>
        )}
      </div>

      <NavBar />
    </div>
  );
}
