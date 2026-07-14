import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LiveTakeoverAlert } from '@/components/notifications/LiveTakeoverAlert';
import { useAuth } from '@/hooks/useAuth';
import { claimLiveTakeoverAlert, getTopmostMissingItem } from '@/lib/liveTakeoverSession';
import api from '@/lib/api';
import type {
  Group,
  GroupMember,
  GroupActivity,
  GroupReadiness,
  SharedItemWithCoverage,
} from '@/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Item Manifest Section ────────────────────────────────────────────────────

function ItemManifest({ items }: { items: SharedItemWithCoverage[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-brand-border rounded-lg p-4 text-center">
        <p className="font-body text-sm text-brand-muted">No items in this mission's manifest.</p>
      </div>
    );
  }

  return (
    <div className="border border-brand-border bg-white rounded-lg overflow-hidden">
      {items.map((item, idx) => {
        const covered = item.coverage.committedQuantity;
        const total = item.requiredQuantity;
        const uncovered = item.coverage.uncoveredQuantity;
        const isCovered = uncovered <= 0;
        const activeResponsibilities = item.responsibilities.filter(
          (r) => r.status === 'COMMITTED' || r.status === 'PACKED',
        );
        const isLast = idx === items.length - 1;

        return (
          <div
            key={item.id}
            className={`px-4 py-3 ${!isLast ? 'border-b border-brand-border' : ''}`}
          >
            {/* Item header */}
            <div className="flex items-center justify-between mb-1.5">
              <p className="font-headline font-bold text-sm uppercase tracking-wide text-brand-text flex-1 min-w-0 truncate">
                {item.name}
              </p>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="font-headline font-bold text-sm text-brand-text">
                  {covered}/{total}
                </span>
                {isCovered ? (
                  <span className="font-headline text-[10px] uppercase tracking-widest text-white bg-[#2D6A4F] px-1.5 py-0.5">
                    ✓
                  </span>
                ) : (
                  <span className="font-headline text-[10px] uppercase tracking-widest text-white bg-primary px-1.5 py-0.5">
                    -{uncovered}
                  </span>
                )}
              </div>
            </div>

            {/* Coverage bar */}
            <div className="w-full h-1 bg-[#F0E8E4] mb-2">
              <div
                className="h-full transition-all"
                style={{
                  width: `${total > 0 ? Math.min((covered / total) * 100, 100) : 0}%`,
                  background: isCovered ? '#2D6A4F' : '#FF4D00',
                }}
              />
            </div>

            {/* Who's bringing it */}
            {activeResponsibilities.length > 0 ? (
              <div className="flex flex-col gap-1 mt-1">
                {activeResponsibilities.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                      <span className="font-headline font-bold text-[7px] text-white">
                        {getInitials(r.user.name)}
                      </span>
                    </div>
                    <span className="font-body text-xs text-brand-muted">
                      {r.user.name}
                      {r.status === 'PACKED' && (
                        <span className="ml-1 text-[#2D6A4F] font-headline text-[10px] uppercase">
                          · packed
                        </span>
                      )}
                    </span>
                    <span className="ml-auto font-headline font-bold text-xs text-brand-text">
                      ×{r.committedQuantity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-headline text-[10px] uppercase tracking-widest text-primary mt-1">
                ⚠ NO ONE ASSIGNED
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [broadcastClicked, setBroadcastClicked] = useState(false);
  const [takeoverItem, setTakeoverItem] = useState<SharedItemWithCoverage | null>(null);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);

  const {
    data: group,
    isLoading: groupLoading,
    isError: groupError,
  } = useQuery<Group>({
    queryKey: ['group', groupId],
    queryFn: () => api.get(`/groups/${groupId}`).then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: members, isLoading: membersLoading } = useQuery<GroupMember[]>({
    queryKey: ['members', groupId],
    queryFn: () => api.get(`/groups/${groupId}/members`).then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<GroupActivity[]>({
    queryKey: ['activities', groupId],
    queryFn: () => api.get(`/groups/${groupId}/activities`).then((r) => r.data),
    enabled: !!groupId,
  });

  const activityId = activities?.[0]?.id;

  const myRole = members?.find((m) => m.userId === user?.id)?.role ?? null;

  const { data: readiness, isLoading: readinessLoading } = useQuery<GroupReadiness>({
    queryKey: ['readiness', activityId],
    queryFn: () => api.get(`/activities/${activityId}/readiness`).then((r) => r.data),
    enabled: !!activityId,
  });

  const { data: sharedItems, isLoading: itemsLoading } = useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () => api.get(`/activities/${activityId}/shared-items`).then((r) => r.data),
    enabled: !!activityId,
  });

  useEffect(() => {
    if (!groupId || !user?.id || itemsLoading) return;

    const missingItem = getTopmostMissingItem(sharedItems);
    if (missingItem && claimLiveTakeoverAlert(user.id, groupId)) {
      setTakeoverItem(missingItem);
    }
  }, [groupId, itemsLoading, sharedItems, user?.id]);

  const takeOverMutation = useMutation({
    mutationFn: async (item: SharedItemWithCoverage) => {
      const hasMissingOwner = item.responsibilities.some(
        (responsibility) =>
          responsibility.status === 'FORGOT' || responsibility.status === 'COULD_NOT_BRING',
      );
      const endpoint = hasMissingOwner ? 'take-over' : 'claim';
      return api.post(`/shared-items/${item.id}/${endpoint}`, {
        quantity: item.coverage.uncoveredQuantity,
      });
    },
    onSuccess: () => {
      setTakeoverItem(null);
      setTakeoverError(null);
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setTakeoverError(
        error.response?.data?.message ?? 'Could not take over this item. Please try again.',
      );
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/groups/${groupId}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', groupId] }),
  });

  const leaveGroupMutation = useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/leave`),
    onSuccess: () => navigate('/groups'),
  });

  const isPageLoading = groupLoading || membersLoading || activitiesLoading;

  if (isPageLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  if (groupError || !group) {
    return (
      <PageLayout>
        <div className="pt-10">
          <div className="border border-[#BA1A1A] bg-white px-4 py-4 mb-4 rounded-lg">
            <p className="font-body text-sm text-[#BA1A1A]">Failed to load group details.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/groups')}>
            ← BACK TO GROUPS
          </Button>
        </div>
      </PageLayout>
    );
  }

  const overallReadiness = readiness?.groupPercentage ?? 0;
  const hasActivity = !!activityId;
  const readinessColor = overallReadiness >= 70 ? '#2D6A4F' : '#FF4D00';

  // Compute per-member commitment summary from shared items
  const memberCommitments: Record<string, { name: string; items: string[] }> = {};
  if (sharedItems && members) {
    members.forEach((m) => {
      memberCommitments[m.userId] = { name: m.user?.name ?? 'Unknown', items: [] };
    });
    sharedItems.forEach((item) => {
      item.responsibilities
        .filter((r) => r.status === 'COMMITTED' || r.status === 'PACKED')
        .forEach((r) => {
          if (!memberCommitments[r.userId]) {
            memberCommitments[r.userId] = { name: r.user.name, items: [] };
          }
          memberCommitments[r.userId].items.push(`${item.name} ×${r.committedQuantity}`);
        });
    });
  }

  const uncoveredCount = sharedItems?.filter((i) => i.coverage.uncoveredQuantity > 0).length ?? 0;
  const totalItems = sharedItems?.length ?? 0;

  return (
    <PageLayout>
      {/* Dark header */}
      <div className="bg-[#1A1A1A] mx-[-16px] px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-white text-xl font-bold leading-none w-8 h-8 flex items-center justify-center shrink-0"
          aria-label="Go back"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-headline font-bold text-base text-white uppercase tracking-wide truncate">
            {group.name}
          </h1>
          <p className="font-headline text-[10px] uppercase tracking-widest text-[#5C4037]">
            DEPLOYMENT STATUS
          </p>
        </div>
        {hasActivity && !itemsLoading && (
          <div className="shrink-0 text-right">
            <p className="font-headline font-bold text-xs text-white">
              {totalItems - uncoveredCount}/{totalItems}
            </p>
            <p className="font-headline text-[9px] uppercase tracking-widest text-[#5C4037]">
              COVERED
            </p>
          </div>
        )}
      </div>

      <div className="pt-5">
        {/* Readiness circle */}
        <div className="text-center py-5">
          <p className="font-headline text-[10px] uppercase tracking-widest text-brand-muted mb-1">
            GEAR READINESS
          </p>
          {readinessLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner />
            </div>
          ) : (
            <span
              className="font-headline font-bold text-7xl block leading-none"
              style={{ color: hasActivity ? readinessColor : '#C4B5AF' }}
            >
              {hasActivity ? `${Math.round(overallReadiness)}%` : '—'}
            </span>
          )}
          {hasActivity && !readinessLoading && uncoveredCount > 0 && (
            <p className="font-headline text-xs uppercase tracking-widest text-primary mt-1">
              ⚠ {uncoveredCount} ITEM{uncoveredCount !== 1 ? 'S' : ''} STILL NEEDED
            </p>
          )}
          {hasActivity && !readinessLoading && uncoveredCount === 0 && totalItems > 0 && (
            <p className="font-headline text-xs uppercase tracking-widest text-[#2D6A4F] mt-1">
              ALL ITEMS COVERED ✓
            </p>
          )}
        </div>

        {/* Item Manifest */}
        {hasActivity && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                ITEM MANIFEST
              </p>
              {itemsLoading && <LoadingSpinner size="sm" />}
            </div>
            {sharedItems && !itemsLoading && <ItemManifest items={sharedItems} />}
          </section>
        )}

        {/* Squad */}
        <section className="mb-5">
          <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
            SQUAD
          </p>

          {members && members.length > 0 ? (
            <div className="bg-white border border-brand-border rounded-lg overflow-hidden">
              {members.map((member, idx) => {
                const commitmentData = memberCommitments[member.userId];
                const bringCount = commitmentData?.items.length ?? 0;
                const isLast = idx === members.length - 1;

                return (
                  <div
                    key={member.id}
                    className={`flex items-start gap-3 px-4 py-3 ${!isLast ? 'border-b border-brand-border' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#1A1A1A] text-white shrink-0 mt-0.5">
                      <span className="font-headline font-bold text-xs">
                        {getInitials(member.user?.name ?? member.userId)}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-headline font-bold text-sm uppercase tracking-wide text-brand-text truncate">
                          {member.user?.name ?? 'Unknown'}
                        </p>
                        {member.role === 'OWNER' && (
                          <span className="font-headline text-[10px] uppercase tracking-wider border border-brand-border px-1.5 py-0.5 text-brand-muted ml-2 shrink-0">
                            OWNER
                          </span>
                        )}
                      </div>

                      {hasActivity && commitmentData && bringCount > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {commitmentData.items.map((label, i) => (
                            <p key={i} className="font-body text-xs text-brand-muted">
                              · {label}
                            </p>
                          ))}
                        </div>
                      ) : hasActivity ? (
                        <p className="font-body text-xs text-brand-muted">Nothing committed yet</p>
                      ) : null}
                    </div>
                    {(myRole === 'OWNER' || myRole === 'ADMIN') &&
                      member.userId !== user?.id && member.role !== 'OWNER' && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${member.user?.name ?? 'this member'} from the group?`)) {
                              removeMemberMutation.mutate(member.id);
                            }
                          }}
                          className="min-h-[44px] px-2 font-headline text-[10px] uppercase text-error underline"
                        >
                          Remove
                        </button>
                      )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-brand-border rounded-lg p-4">
              <p className="font-body text-sm text-brand-muted text-center py-4">No members yet.</p>
            </div>
          )}
        </section>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() =>
              navigate(
                activityId
                  ? `/groups/${groupId}/packing?activityId=${activityId}`
                  : `/groups/${groupId}/packing`,
              )
            }
            className="flex-1 border border-[#1A1A1A] bg-white font-headline text-xs uppercase py-3 tracking-widest hover:bg-brand-bg transition-colors"
          >
            PACKING
          </button>
          <button
            onClick={() => navigate(`/groups/${groupId}/equipment`)}
            className="flex-1 border border-[#1A1A1A] bg-white font-headline text-xs uppercase py-3 tracking-widest hover:bg-brand-bg transition-colors"
          >
            EQUIPMENT
          </button>
          <button
            onClick={() => navigate(`/groups/${groupId}/invite`)}
            className="flex-1 border border-[#1A1A1A] bg-white font-headline text-xs uppercase py-3 tracking-widest hover:bg-brand-bg transition-colors"
          >
            INVITE
          </button>
        </div>

        <div className="mt-3 mb-6">
          <Button variant="ghost" fullWidth onClick={() => setBroadcastClicked(true)}>
            BROADCAST GEAR REMINDER
          </Button>
          {broadcastClicked && (
            <p className="text-center font-headline text-[10px] uppercase tracking-widest text-brand-muted mt-2">
              Coming soon
            </p>
          )}
          {myRole === 'OWNER' && (
            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    'Are you sure you want to delete this group? This action cannot be undone.',
                  )
                )
                  return;
                try {
                  await api.delete(`/groups/${groupId}`);
                  navigate('/dashboard');
                } catch {
                  alert('Failed to delete group.');
                }
              }}
              className="w-full mt-3 min-h-[44px] border border-red-400 bg-white font-headline font-bold text-xs uppercase tracking-widest text-red-600 flex items-center justify-center hover:bg-red-50 transition-colors"
            >
              DELETE GROUP
            </button>
          )}
          {myRole !== 'OWNER' && (
            <button
              onClick={() => {
                if (window.confirm('Leave this group?')) leaveGroupMutation.mutate();
              }}
              disabled={leaveGroupMutation.isPending}
              className="w-full mt-3 min-h-[44px] border border-red-400 bg-white font-headline font-bold text-xs uppercase tracking-widest text-red-600 disabled:opacity-50"
            >
              Leave group
            </button>
          )}
        </div>
      </div>
      {takeoverItem ? (
        <LiveTakeoverAlert
          item={takeoverItem}
          isTakingOver={takeOverMutation.isPending}
          error={takeoverError}
          onCannotHelp={() => setTakeoverItem(null)}
          onTakeOver={() => {
            setTakeoverError(null);
            takeOverMutation.mutate(takeoverItem);
          }}
        />
      ) : null}
    </PageLayout>
  );
}
