import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Item3DViewer } from '@/components/3d/Item3DViewer';
import { useAuth } from '@/hooks/useAuth';
import { groupsService } from '@/services/groups.service';
import { equipmentService } from '@/services/equipment.service';
import { packingService } from '@/services/packing.service';
import type { Group, GroupActivity, SharedItemWithCoverage } from '@/types';

// ─── Persistence helpers ──────────────────────────────────────────────────────

function swipedKeys(userId?: string | null, activityId?: string | null): string[] {
  const keys: string[] = [];
  if (activityId) {
    if (userId) keys.push(`pack:swiped:${userId}:${activityId}`);
    keys.push(`pack:swiped:${activityId}`);
  }
  return keys;
}

function loadSwiped(userId?: string | null, activityId?: string | null): Set<string> {
  const result = new Set<string>();
  if (!activityId) return result;
  for (const k of swipedKeys(userId, activityId)) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        arr.forEach((id) => result.add(id));
      }
    } catch {}
  }
  return result;
}

function saveSwiped(userId: string | null | undefined, activityId: string, ids: Set<string>) {
  const arr = [...ids];
  const json = JSON.stringify(arr);
  for (const k of swipedKeys(userId, activityId)) {
    try {
      localStorage.setItem(k, json);
    } catch {}
  }
}

function skipKey(userId?: string | null, activityId?: string | null) {
  return `pack:skip:${userId || 'anon'}:${activityId || 'default'}`;
}

function loadSkipped(userId?: string | null, activityId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(skipKey(userId, activityId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSkipped(userId: string | null | undefined, activityId: string, ids: Set<string>) {
  try {
    localStorage.setItem(skipKey(userId, activityId), JSON.stringify([...ids]));
  } catch {}
}

// ─── Group & Activity Selectors ───────────────────────────────────────────────

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
              'shrink-0 font-headline font-bold text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-all duration-200 whitespace-nowrap active:scale-95',
              active
                ? 'bg-primary border-primary text-white shadow-sm'
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

const SwipeCard = memo(function SwipeCard({
  item,
  slideDir = null,
  dragX = 0,
  isDragging = false,
  isBackgroundCard = false,
  currentUserId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  item: SharedItemWithCoverage;
  slideDir?: 'left' | 'right' | null;
  dragX?: number;
  isDragging?: boolean;
  isBackgroundCard?: boolean;
  currentUserId?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
}) {
  const coveredQty = item.coverage.committedQuantity;
  const totalQty = item.requiredQuantity;
  const stillNeeded = item.coverage.uncoveredQuantity;

  const myResp = item.responsibilities.find((r) => r.userId === currentUserId);
  const isMyItem = !!myResp && ['COMMITTED', 'PACKED'].includes(myResp.status);
  const isAlreadyPacked = myResp?.status === 'PACKED';

  const dragRatio = Math.min(Math.abs(dragX) / 100, 1);
  const showRight = !isBackgroundCard && (isDragging ? dragX > 30 : slideDir === 'right');
  const showLeft = !isBackgroundCard && (isDragging ? dragX < -30 : slideDir === 'left');

  let transform: string;
  let opacity = 1;
  let filter = 'none';

  if (isBackgroundCard) {
    transform = 'none';
    opacity = 1;
    filter = 'none';
  } else if (isDragging) {
    transform = `translateX(${dragX}px) rotate(${dragX * 0.035}deg)`;
    opacity = 1;
    filter = 'none';
  } else if (slideDir === 'right') {
    transform = 'translateX(180%) rotate(22deg) scale(0.85)';
    opacity = 0;
    filter = 'blur(6px)';
  } else if (slideDir === 'left') {
    transform = 'translateX(-180%) rotate(-22deg) scale(0.85)';
    opacity = 0;
    filter = 'blur(6px)';
  } else {
    transform = 'translateX(0) rotate(0deg) scale(1)';
    opacity = 1;
    filter = 'none';
  }

  const rightBadgeText = isMyItem
    ? isAlreadyPacked
      ? 'PACKED ✓'
      : 'MARK PACKED'
    : stillNeeded > 0
    ? "I'LL BRING IT"
    : 'ALL SET';

  return (
    <div
      className={`relative w-full select-none ${
        isBackgroundCard ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        transform,
        opacity,
        filter,
        transition: isDragging
          ? 'none'
          : 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms cubic-bezier(0.4, 0, 0.8, 1), filter 320ms ease-out',
        touchAction: 'none',
      }}
      onPointerDown={isBackgroundCard ? undefined : onPointerDown}
      onPointerMove={isBackgroundCard ? undefined : onPointerMove}
      onPointerUp={isBackgroundCard ? undefined : onPointerUp}
      onPointerCancel={isBackgroundCard ? undefined : onPointerUp}
    >
      {/* Right-swipe label */}
      {showRight && (
        <div
          className="absolute top-5 left-4 z-20 border-4 border-[#2D6A4F] bg-white/95 rounded px-3 py-1 shadow-md pointer-events-none"
          style={{ opacity: Math.min(dragRatio * 1.5, 1), transform: 'rotate(-18deg)' }}
        >
          <span className="font-headline font-bold text-base text-[#2D6A4F] uppercase tracking-widest leading-none flex items-center gap-1.5">
            <Check className="w-5 h-5" /> {rightBadgeText}
          </span>
        </div>
      )}

      {/* Left-swipe label: NOT MY JOB */}
      {showLeft && (
        <div
          className="absolute top-5 right-4 z-20 border-4 border-[#916F65] bg-white/95 rounded px-3 py-1 shadow-md pointer-events-none"
          style={{ opacity: Math.min(dragRatio * 1.5, 1), transform: 'rotate(18deg)' }}
        >
          <span className="font-headline font-bold text-base text-[#916F65] uppercase tracking-widest leading-none">
            NOT MY JOB
          </span>
        </div>
      )}

      {/* Card body */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-md transition-shadow hover:shadow-lg">
        {/* Top strip */}
        <div className="bg-[#1A1A1A] px-4 py-2.5 flex items-center justify-between">
          <span className="font-headline text-[10px] uppercase tracking-widest text-[#916F65] font-bold">
            {isMyItem ? (isAlreadyPacked ? 'MY PACKED ITEM' : 'MY ASSIGNED ITEM') : 'ITEM NEEDED'}
          </span>
          <span
            className="font-headline font-bold text-xs uppercase tracking-widest flex items-center gap-1"
            style={{ color: stillNeeded > 0 ? '#FF4D00' : '#2D6A4F' }}
          >
            {isAlreadyPacked ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>PACKED</span>
              </>
            ) : stillNeeded > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{stillNeeded} STILL NEEDED</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>COVERED</span>
              </>
            )}
          </span>
        </div>

        {/* Content */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-headline font-bold text-3xl uppercase tracking-tight text-[#1A1A1A] leading-tight">
                {item.name}
              </p>
              {item.category && (
                <span className="inline-block mt-1 text-[10px] font-headline uppercase tracking-wider px-2 py-0.5 rounded bg-brand-bg border border-brand-border text-brand-muted">
                  {item.category}
                </span>
              )}
            </div>
            {item.isMandatory && (
              <span className="shrink-0 text-[9px] font-headline font-bold uppercase tracking-widest px-2 py-0.5 border border-primary text-primary">
                MANDATORY
              </span>
            )}
          </div>

          {item.notes && (
            <p className="font-body text-xs text-[#5C4037] mb-2 bg-[#FCF9F8] p-2 rounded border border-brand-border/40">
              {item.notes}
            </p>
          )}

          {/* 3D Item Visualization with drag isolation */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="touch-none"
          >
            <Item3DViewer
              name={item.name}
              category={item.category ?? undefined}
              height={190}
              className="my-3 shadow-inner"
            />
          </div>

          {/* Coverage row */}
          <div className="mt-3">
            <div className="flex items-end justify-between mb-1.5">
              <span className="font-headline text-[10px] uppercase tracking-widest text-[#5C4037]">
                COMMITTED
              </span>
              <span className="font-headline font-bold text-xl text-[#1A1A1A] leading-none">
                {coveredQty}
                <span className="text-sm font-normal text-[#5C4037]"> / {totalQty}</span>
              </span>
            </div>
            <div className="w-full h-2.5 border border-[#1A1A1A] bg-[#FCF9F8] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${totalQty > 0 ? Math.min((coveredQty / totalQty) * 100, 100) : 0}%`,
                  background: coveredQty >= totalQty ? '#2D6A4F' : '#FF4D00',
                }}
              />
            </div>
          </div>

          {/* Who's already bringing it */}
          {item.responsibilities.filter((r) => ['COMMITTED', 'PACKED'].includes(r.status)).length > 0 && (
            <div className="mt-3 pt-3 border-t border-brand-border flex flex-col gap-1.5">
              <span className="font-headline text-[9px] uppercase tracking-widest text-brand-muted">
                Assigned Squad Members:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {item.responsibilities
                  .filter((r) => ['COMMITTED', 'PACKED'].includes(r.status))
                  .map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#FCF9F8] border border-brand-border text-xs text-brand-text font-body"
                    >
                      <span className="w-4 h-4 rounded-full bg-[#1A1A1A] text-white text-[8px] font-bold flex items-center justify-center">
                        {r.user.name.slice(0, 1).toUpperCase()}
                      </span>
                      {r.user.name} ({r.committedQuantity})
                      {r.status === 'PACKED' && <Check className="w-3 h-3 text-[#2D6A4F]" />}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[#1A1A1A]/20 px-5 py-2.5 flex items-center justify-between bg-[#FCF9F8]">
          <span className="font-headline text-[10px] uppercase tracking-widest text-[#916F65] flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> SWIPE LEFT: NOT MY JOB
          </span>
          <span className="font-headline text-[10px] uppercase tracking-widest text-[#2D6A4F] font-bold flex items-center gap-1">
            SWIPE RIGHT: {rightBadgeText} <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export function GeneralPackingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const urlGroupId = searchParams.get('groupId');
  const urlActivityId = searchParams.get('activityId');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    () => urlGroupId || localStorage.getItem('pack:last_group'),
  );
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    () => urlActivityId || localStorage.getItem('pack:last_activity'),
  );
  const [activeTab, setActiveTab] = useState<'ALL' | 'MINE' | 'UNCOVERED'>('ALL');

  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingCard, setAnimatingCard] = useState<SharedItemWithCoverage | null>(null);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [, setSkippedIds] = useState<Set<string>>(() => {
    try {
      const storedAct = urlActivityId || localStorage.getItem('pack:last_activity');
      const uId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : null;
      if (storedAct) {
        return loadSkipped(uId, storedAct);
      }
    } catch {}
    return new Set();
  });

  const [swipedIds, setSwipedIds] = useState<Set<string>>(() => {
    try {
      const storedAct = urlActivityId || localStorage.getItem('pack:last_activity');
      const uId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : null;
      if (storedAct) {
        return loadSwiped(uId, storedAct);
      }
    } catch {}
    return new Set();
  });

  const pointerStartX = useRef<number>(0);
  const loadedForKey = useRef<string | null>(null);

  // ── Fetch groups ──────────────────────────────────────────────────────────
  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => groupsService.listGroups(),
  });

  useEffect(() => {
    if (groups && groups.length > 0) {
      if (!selectedGroupId || !groups.some((g) => g.id === selectedGroupId)) {
        setSelectedGroupId(groups[0].id);
        try { localStorage.setItem('pack:last_group', groups[0].id); } catch {}
      }
    }
  }, [groups, selectedGroupId]);

  const handleSelectGroup = (id: string) => {
    if (id === selectedGroupId) return;
    setSelectedGroupId(id);
    try { localStorage.setItem('pack:last_group', id); } catch {}
    setSelectedActivityId(null);
    setSlideDir(null);
    setIsAnimating(false);
    setDragX(0);
    setAnimatingCard(null);
  };

  // ── Fetch activities ──────────────────────────────────────────────────────
  const { data: activities, isLoading: activitiesLoading } = useQuery<GroupActivity[]>({
    queryKey: ['activities', selectedGroupId],
    queryFn: () => groupsService.getGroupActivities(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  useEffect(() => {
    if (activities && activities.length > 0) {
      if (!selectedActivityId || !activities.some((a) => a.id === selectedActivityId)) {
        const targetActId = (localStorage.getItem('pack:last_activity') && activities.some(a => a.id === localStorage.getItem('pack:last_activity')))
          ? localStorage.getItem('pack:last_activity')!
          : activities[0].id;
        setSelectedActivityId(targetActId);
        try { localStorage.setItem('pack:last_activity', targetActId); } catch {}
      }
    } else if (activities && activities.length === 0) {
      setSelectedActivityId(null);
    }
  }, [activities, selectedActivityId]);

  const activityId = selectedActivityId;

  // ── Load persisted skips and swiped cards when activity changes ───────────
  useEffect(() => {
    if (!activityId) return;
    const key = `${user?.id || 'anon'}:${activityId}`;
    if (loadedForKey.current === key) return;
    loadedForKey.current = key;
    setSkippedIds(loadSkipped(user?.id, activityId));
    setSwipedIds(loadSwiped(user?.id, activityId));
  }, [activityId, user?.id]);

  // ── Fetch shared items ────────────────────────────────────────────────────
  const { data: sharedItems, isLoading: itemsLoading } = useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () => equipmentService.listSharedItems(activityId!),
    enabled: !!activityId,
  });

  // ── Sync with backend: If an item is already marked PACKED by current user, record it as swiped
  useEffect(() => {
    if (!sharedItems || !activityId) return;
    const packedByMe = sharedItems
      .filter((it) => it.responsibilities.some((r) => r.userId === user?.id && r.status === 'PACKED'))
      .map((it) => it.id);

    if (packedByMe.length > 0) {
      setSwipedIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        packedByMe.forEach((id) => {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        });
        if (changed) {
          saveSwiped(user?.id, activityId, next);
          return next;
        }
        return prev;
      });
    }
  }, [sharedItems, user?.id, activityId]);

  // ── Tab Counts ────────────────────────────────────────────────────────────
  const allCount = sharedItems?.length ?? 0;
  const myCount = useMemo(() => {
    if (!sharedItems || !user?.id) return 0;
    return sharedItems.filter((it) =>
      it.responsibilities.some(
        (r) => r.userId === user.id && ['COMMITTED', 'PACKED'].includes(r.status),
      ),
    ).length;
  }, [sharedItems, user?.id]);
  const uncoveredCount = useMemo(() => {
    if (!sharedItems) return 0;
    return sharedItems.filter((it) => it.coverage.uncoveredQuantity > 0).length;
  }, [sharedItems]);

  // ── Reset Entire Deck ─────────────────────────────────────────────────────
  const handleResetDeck = () => {
    if (activityId) {
      setSkippedIds(new Set());
      setSwipedIds(new Set());
      saveSkipped(user?.id, activityId, new Set());
      saveSwiped(user?.id, activityId, new Set());
      packingService.resetDeck(activityId);
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
    }
  };

  // ── Pending items list ────────────────────────────────────────────────────
  const pendingItems = useMemo(() => {
    if (!sharedItems) return [];
    const userId = user?.id;

    let items = sharedItems;
    if (activeTab === 'MINE') {
      items = sharedItems.filter((it) =>
        it.responsibilities.some(
          (r) => r.userId === userId && ['COMMITTED', 'PACKED'].includes(r.status),
        ),
      );
    } else if (activeTab === 'UNCOVERED') {
      items = sharedItems.filter((it) => it.coverage.uncoveredQuantity > 0);
    }

    // Filter out handled items (both left and right swipes)
    return items.filter((it) => !swipedIds.has(it.id));
  }, [sharedItems, swipedIds, user?.id, activeTab]);

  const currentItem = pendingItems[0] ?? null;
  const nextItem = pendingItems[1] ?? null;
  const activeDisplayItem = animatingCard || currentItem;
  const handledCount = swipedIds.size;
  const totalCards = pendingItems.length + handledCount;

  const isDone = Boolean(
    !itemsLoading &&
    activityId != null &&
    (sharedItems?.length ?? 0) > 0 &&
    pendingItems.length === 0 &&
    !animatingCard
  );

  // ── Claim & Pack mutations ────────────────────────────────────────────────
  const claimMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      equipmentService.claimResponsibility(itemId, { quantity: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  const packMutation = useMutation({
    mutationFn: (itemId: string) => equipmentService.packResponsibility(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  // ── Card advance without flickering ───────────────────────────────────────
  const advance = () => {
    setDragX(0);
    setSlideDir(null);
    setIsAnimating(false);
    setAnimatingCard(null);
  };

  const handleAction = (dir: 'left' | 'right') => {
    if (isAnimating || !currentItem) return;
    const itemToProcess = currentItem;

    // Lock the card into animating state so pendingItems keeps underneath card rendered
    setAnimatingCard(itemToProcess);
    setIsAnimating(true);
    setIsDragging(false);
    setSlideDir(dir);

    if (dir === 'right') {
      const myResp = itemToProcess.responsibilities.find((r) => r.userId === user?.id);
      const isMyItem = !!myResp && ['COMMITTED', 'PACKED'].includes(myResp.status);
      const isAlreadyPacked = myResp?.status === 'PACKED';

      if (isMyItem && !isAlreadyPacked) {
        packMutation.mutate(itemToProcess.id);
      } else if (itemToProcess.coverage.uncoveredQuantity > 0) {
        claimMutation.mutate({
          itemId: itemToProcess.id,
          qty: Math.max(1, itemToProcess.coverage.uncoveredQuantity || 1),
        });
      }
    } else {
      // Skip: "Not my job" — persist in localStorage atomically
      if (activityId) {
        setSkippedIds((prev) => {
          const next = new Set(prev);
          next.add(itemToProcess.id);
          saveSkipped(user?.id, activityId, next);
          return next;
        });
      }
    }

    // Advance only after slide out animation finishes:
    // Only THEN add the card to swipedIds and promote the underlying card!
    setTimeout(() => {
      if (activityId) {
        setSwipedIds((prev) => {
          const nextSwiped = new Set(prev);
          nextSwiped.add(itemToProcess.id);
          saveSwiped(user?.id, activityId, nextSwiped);
          return nextSwiped;
        });
      }
      advance();
    }, 360);
  };

  // ── Pointer handlers (both touch & mouse desktop support) ─────────────────
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
    if (Math.abs(dragX) > 75) {
      handleAction(dragX > 0 ? 'right' : 'left');
    } else {
      setDragX(0);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col pb-20 md:pb-8 animate-fadeIn">
      {/* Dark Header Strip */}
      <div className="bg-[#1A1A1A] px-4 pt-4 pb-4 shadow-sm">
        <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-headline font-bold text-lg text-white uppercase tracking-wide">
              TEAM PACKING & LOGISTICS
            </h1>
            {swipedIds.size > 0 && (
              <button
                onClick={() => setShowResetConfirmModal(true)}
                className="inline-flex items-center gap-1.5 text-[10px] font-headline uppercase tracking-widest text-[#FF4D00] hover:text-white transition-colors"
                title="Reset all swiped items in deck"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Deck ({swipedIds.size})</span>
              </button>
            )}
          </div>

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

          {/* Activities Pill Selector if multiple activities */}
          {activities && activities.length > 1 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto py-1 border-t border-white/10 no-scrollbar">
              <span className="text-[10px] font-headline uppercase text-white/50 tracking-wider shrink-0">
                Event:
              </span>
              {activities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => {
                    setSelectedActivityId(act.id);
                  }}
                  className={`text-[10px] font-headline uppercase tracking-widest px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    act.id === selectedActivityId
                      ? 'bg-white text-[#1A1A1A] font-bold'
                      : 'text-white/70 hover:text-white bg-white/5'
                  }`}
                >
                  {act.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body Container (Desktop Responsive max-w-2xl) */}
      <div className="flex-1 flex flex-col max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full px-4 pt-4">
        {/* Filter Tabs */}
        {sharedItems && sharedItems.length > 0 && (
          <div className="flex justify-between items-center mb-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => {
                  setActiveTab('ALL');
                }}
                className={`text-[11px] font-headline uppercase tracking-wider px-3 py-1 border transition-colors whitespace-nowrap ${
                  activeTab === 'ALL'
                    ? 'border-primary bg-primary text-white font-bold'
                    : 'border-brand-border bg-white text-brand-muted hover:text-brand-text'
                }`}
              >
                All Manifest Items ({allCount})
              </button>
              <button
                onClick={() => {
                  setActiveTab('MINE');
                }}
                className={`text-[11px] font-headline uppercase tracking-wider px-3 py-1 border transition-colors whitespace-nowrap ${
                  activeTab === 'MINE'
                    ? 'border-primary bg-primary text-white font-bold'
                    : 'border-brand-border bg-white text-brand-muted hover:text-brand-text'
                }`}
              >
                My Items ({myCount})
              </button>
              <button
                onClick={() => {
                  setActiveTab('UNCOVERED');
                }}
                className={`text-[11px] font-headline uppercase tracking-wider px-3 py-1 border transition-colors whitespace-nowrap ${
                  activeTab === 'UNCOVERED'
                    ? 'border-primary bg-primary text-white font-bold'
                    : 'border-brand-border bg-white text-brand-muted hover:text-brand-text'
                }`}
              >
                Needs Coverage ({uncoveredCount})
              </button>
            </div>
          </div>
        )}

        {/* Empty state for My Items tab */}
        {!itemsLoading && activeTab === 'MINE' && myCount === 0 && selectedGroupId && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <p className="font-headline font-bold text-sm uppercase tracking-widest text-brand-text mb-2">
              NO ITEMS ASSIGNED YET
            </p>
            <p className="font-body text-xs text-brand-muted mb-4 max-w-sm">
              You haven't claimed any gear for this mission yet. Switch to "Needs Coverage" or "All Manifest Items" to claim items.
            </p>
            <Button
              variant="urgent"
              onClick={() => {
                setActiveTab('UNCOVERED');
              }}
              className="flex items-center gap-1.5"
            >
              <span>VIEW NEEDED GEAR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* No groups state */}
        {!groupsLoading && (!groups || groups.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <p className="font-headline font-bold text-sm uppercase tracking-widest text-brand-text mb-2">
              NO MISSIONS FOUND
            </p>
            <p className="font-body text-xs text-brand-muted mb-6">
              Join or create a group to start packing.
            </p>
            <Button variant="urgent" onClick={() => navigate('/groups/new')}>
              + CREATE MISSION
            </Button>
          </div>
        )}

        {/* Loading state */}
        {selectedGroupId && (activitiesLoading || itemsLoading) && (
          <div className="flex-1 flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* No activity scheduled */}
        {!activitiesLoading && selectedGroupId && activities && activities.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <p className="font-headline font-bold text-sm uppercase tracking-widest text-brand-muted mb-2">
              NO EVENT SCHEDULED
            </p>
            <p className="font-body text-xs text-brand-muted mb-4">
              This group has no active events yet.
            </p>
            <Button
              variant="ghost"
              onClick={() => navigate(`/groups/${selectedGroupId}`)}
              className="text-xs uppercase flex items-center gap-1.5"
            >
              <span>Go to Squad Page</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Done / Finished State */}
        {isDone && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-[#2D6A4F] flex items-center justify-center mb-4 border-2 border-[#1A1A1A] shadow-md">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <p className="font-headline font-bold text-2xl uppercase tracking-widest text-[#2D6A4F] mb-1">
              YOU'RE ALL SET!
            </p>
            <p className="font-body text-sm text-brand-muted mb-6 max-w-sm">
              All items in this section have been reviewed. Check the squad event page to inspect
              the live team manifest.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                variant="primary"
                onClick={() => {
                  if (selectedGroupId) navigate(`/groups/${selectedGroupId}`);
                }}
              >
                VIEW SQUAD
              </Button>
              <Button
                variant="ghost"
                onClick={handleResetDeck}
                className="flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> RESET DECK
              </Button>
            </div>
          </div>
        )}

        {/* Swipe cards container */}
        {!itemsLoading && !isDone && activeDisplayItem && !(activeTab === 'MINE' && myCount === 0) && (
          <div className="flex-1 flex flex-col justify-between pt-2 pb-4">
            {/* Progress counter */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-headline text-[10px] uppercase tracking-widest text-brand-muted font-bold">
                CARD {handledCount + 1} OF {Math.max(totalCards, 1)}
              </span>
              <div className="flex gap-1.5">
                {Array.from({ length: Math.min(totalCards, 12) }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === handledCount ? '24px' : '8px',
                      background:
                        i < handledCount ? '#2D6A4F' : i === handledCount ? '#FF4D00' : '#E0D4CE',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 2-Card Stack Container */}
            <div className="relative w-full max-w-sm sm:max-w-md mx-auto my-2" style={{ minHeight: '520px' }}>
              {/* Underlying Next Card */}
              {nextItem && (
                <div
                  key={`bg-${nextItem.id}`}
                  className="absolute inset-x-0 top-0 pointer-events-none transform-gpu"
                  style={{
                    willChange: 'transform, opacity',
                    transform: isAnimating
                      ? 'scale(1) translateY(0px)'
                      : 'scale(0.94) translateY(14px)',
                    opacity: isAnimating ? 1 : 0.82,
                    transition: isAnimating
                      ? 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms cubic-bezier(0.22, 1, 0.36, 1)'
                      : 'none',
                    zIndex: 1,
                  }}
                >
                  <SwipeCard
                    key={`card-bg-${nextItem.id}`}
                    item={nextItem}
                    isBackgroundCard
                    currentUserId={user?.id}
                  />
                </div>
              )}

              {/* Active Foreground Card */}
              {activeDisplayItem && (
                <div key={`fg-${activeDisplayItem.id}`} className="relative z-10 transform-gpu">
                  <SwipeCard
                    key={`card-fg-${activeDisplayItem.id}`}
                    item={activeDisplayItem}
                    slideDir={slideDir}
                    dragX={dragX}
                    isDragging={isDragging}
                    currentUserId={user?.id}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => handleAction('left')}
                disabled={isAnimating}
                className="flex-1 min-h-[52px] border-2 border-[#1A1A1A] bg-white font-headline font-bold text-xs uppercase tracking-widest text-[#1A1A1A] flex items-center justify-center hover:bg-black/5 active:scale-95 transition-all disabled:opacity-50"
              >
                NOT MY JOB
              </button>
              <button
                type="button"
                onClick={() => handleAction('right')}
                disabled={isAnimating || claimMutation.isPending || packMutation.isPending}
                className="flex-1 min-h-[52px] bg-primary border-2 border-primary font-headline font-bold text-xs uppercase tracking-widest text-white flex items-center justify-center hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
              >
                {(() => {
                  if (claimMutation.isPending || packMutation.isPending) return 'SAVING...';
                  const activeMyResp = activeDisplayItem.responsibilities.find((r) => r.userId === user?.id);
                  const isMy = !!activeMyResp && ['COMMITTED', 'PACKED'].includes(activeMyResp.status);
                  const isPacked = activeMyResp?.status === 'PACKED';
                  if (isMy && !isPacked) return 'MARK PACKED ✓';
                  if (isPacked) return 'PACKED';
                  if (activeDisplayItem.coverage.uncoveredQuantity > 0) return "I'LL BRING IT →";
                  return 'NEXT ITEM';
                })()}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Reset Deck */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#1A1A1A] rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-base uppercase text-brand-text">
                  Reset Packing Deck?
                </h3>
                <p className="font-body text-xs text-brand-muted">
                  Restore all reviewed and skipped cards
                </p>
              </div>
            </div>
            <p className="font-body text-xs text-brand-muted">
              This will restore all {swipedIds.size} swiped and skipped gear cards back into your packing stack so you can review them again.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowResetConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="urgent"
                onClick={() => {
                  handleResetDeck();
                  setShowResetConfirmModal(false);
                }}
              >
                Reset Deck
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
