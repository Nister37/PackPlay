import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Trash2,
  ArrowLeft,
  Settings,
  Plus,
  Send,
} from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LiveTakeoverAlert } from '@/components/notifications/LiveTakeoverAlert';
import { useAuth } from '@/hooks/useAuth';
import { claimLiveTakeoverAlert, getTopmostMissingItem } from '@/lib/liveTakeoverSession';
import { groupsService } from '@/services/groups.service';
import { equipmentService } from '@/services/equipment.service';
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
                  <span className="inline-flex items-center justify-center text-[10px] text-white bg-[#2D6A4F] px-1.5 py-0.5">
                    <Check className="w-3 h-3 stroke-[2.5]" />
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
              <p className="font-headline text-[10px] uppercase tracking-widest text-primary mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>NO ONE ASSIGNED</span>
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
  const [takeoverItem, setTakeoverItem] = useState<SharedItemWithCoverage | null>(null);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);

  // Group Query
  const {
    data: group,
    isLoading: groupLoading,
    isError: groupError,
  } = useQuery<Group>({
    queryKey: ['group', groupId],
    queryFn: () => groupsService.getGroup(groupId!),
    enabled: !!groupId,
  });

  // Members Query
  const { data: members, isLoading: membersLoading } = useQuery<GroupMember[]>({
    queryKey: ['members', groupId],
    queryFn: () => groupsService.getGroupMembers(groupId!),
    enabled: !!groupId,
  });

  // Activities Query
  const { data: activities, isLoading: activitiesLoading } = useQuery<GroupActivity[]>({
    queryKey: ['activities', groupId],
    queryFn: () => groupsService.getGroupActivities(groupId!),
    enabled: !!groupId,
  });

  const activityId = activities?.[0]?.id;

  const myRole = members?.find((m) => m.userId === user?.id)?.role ?? null;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  // Readiness Query
  const { data: readiness, isLoading: readinessLoading } = useQuery<GroupReadiness>({
    queryKey: ['readiness', activityId],
    queryFn: () => equipmentService.getActivityReadiness(activityId!),
    enabled: !!activityId,
  });

  // Shared Items Query
  const { data: sharedItems, isLoading: itemsLoading } = useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () => equipmentService.listSharedItems(activityId!),
    enabled: !!activityId,
  });

  // Takeover effect
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
      if (hasMissingOwner) {
        return equipmentService.takeOver(item.id, {
          quantity: item.coverage.uncoveredQuantity,
        });
      }
      return equipmentService.claimResponsibility(item.id, {
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

  // Create Activity Modal state & Mutation
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityType, setNewActivityType] = useState('TRAINING');
  const [newActivityDate, setNewActivityDate] = useState('');

  const createActivityMutation = useMutation({
    mutationFn: () =>
      groupsService.createActivity(groupId!, {
        name: newActivityName.trim(),
        activityType: newActivityType as any,
        date: newActivityDate ? new Date(newActivityDate).toISOString() : undefined,
      }),
    onSuccess: (res) => {
      setShowCreateActivity(false);
      setNewActivityName('');
      queryClient.invalidateQueries({ queryKey: ['activities', groupId] });
      navigate(`/groups/${groupId}/activities/${res.id}`);
    },
  });

  // Delete Activity Mutation
  const deleteActivityMutation = useMutation({
    mutationFn: (actId: string) => groupsService.deleteActivity(groupId!, actId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', groupId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  // Member Management Mutations
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => groupsService.removeMember(groupId!, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', groupId] }),
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'ADMIN' | 'MEMBER' }) =>
      groupsService.updateMemberRole(groupId!, memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', groupId] }),
  });

  // Squad Capacity / Max Members
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [maxMembersInput, setMaxMembersInput] = useState<number | string>('');

  useEffect(() => {
    if (group?.maxMembers != null) {
      setMaxMembersInput(group.maxMembers);
    }
  }, [group?.maxMembers]);

  const updateGroupMutation = useMutation({
    mutationFn: (data: { maxMembers?: number }) => groupsService.updateGroup(groupId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      setShowSettingsModal(false);
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: () => groupsService.leaveGroup(groupId!),
    onSuccess: () => navigate('/groups'),
  });

  // Broadcast Gear Reminder
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);
  const broadcastGearReminderMutation = useMutation({
    mutationFn: () => {
      if (!activityId) throw new Error('No active event scheduled to broadcast for.');
      return groupsService.broadcastReminder(groupId!, activityId);
    },
    onSuccess: (res: any) => {
      setBroadcastFeedback(`Gear reminder sent to ${res?.notifiedCount ?? 'squad'} member(s)!`);
      setTimeout(() => setBroadcastFeedback(null), 4000);
    },
    onError: (err: any) => {
      setBroadcastFeedback(err.response?.data?.message || 'Failed to send broadcast reminder.');
      setTimeout(() => setBroadcastFeedback(null), 4000);
    },
  });

  // Delete Group Slider Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dragSliderX, setDragSliderX] = useState(0);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const sliderStartX = useRef(0);

  const deleteGroupMutation = useMutation({
    mutationFn: () => groupsService.deleteGroup(groupId!),
    onSuccess: () => {
      navigate('/dashboard');
    },
    onError: () => {
      alert('Failed to delete group.');
      setShowDeleteModal(false);
      setDragSliderX(0);
    },
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
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> BACK TO GROUPS
            </span>
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
          className="text-white text-xl font-bold leading-none w-8 h-8 flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
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
            <p className="font-headline text-xs uppercase tracking-widest text-primary mt-1 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uncoveredCount} ITEM{uncoveredCount !== 1 ? 'S' : ''} STILL NEEDED</span>
            </p>
          )}
          {hasActivity && !readinessLoading && uncoveredCount === 0 && totalItems > 0 && (
            <p className="font-headline text-xs uppercase tracking-widest text-[#2D6A4F] mt-1 flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>ALL ITEMS COVERED</span>
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

        {/* Squad Events Section */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              SQUAD EVENTS ({activities?.length ?? 0})
            </p>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateActivity(true)}
                className="text-xs font-headline uppercase"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Schedule Event
              </Button>
            )}
          </div>

          {activities && activities.length > 0 ? (
            <div className="bg-white border border-brand-border rounded-lg divide-y divide-brand-border">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 flex items-center justify-between hover:bg-brand-bg/40 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <Link
                      to={`/groups/${groupId}/activities/${act.id}`}
                      className="font-headline font-bold text-sm uppercase text-brand-text hover:text-primary transition-colors truncate block"
                    >
                      {act.name}
                    </Link>
                    {(act.scheduledAt || act.date!) && (
                      <p className="font-body text-xs text-brand-muted mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-brand-muted" />
                        <span>{new Date(act.scheduledAt || act.date!).toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/groups/${groupId}/activities/${act.id}`}
                      className="px-2.5 py-1 text-xs border border-brand-border font-headline uppercase tracking-wider hover:bg-brand-bg rounded"
                    >
                      Open
                    </Link>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete event "${act.name}"? This action cannot be undone.`)) {
                            deleteActivityMutation.mutate(act.id);
                          }
                        }}
                        disabled={deleteActivityMutation.isPending}
                        className="p-1 border border-red-300 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-brand-border rounded-lg p-5 text-center">
              <p className="font-headline text-xs uppercase text-brand-muted">
                No events scheduled yet.
              </p>
              {canManage && (
                <Button
                  variant="urgent"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowCreateActivity(true)}
                >
                  Create First Event
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Squad Members Section with Leader Powers */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              SQUAD {group.maxMembers ? `(${members?.length ?? 0}/${group.maxMembers})` : `(${members?.length ?? 0})`}
            </p>
            {myRole === 'OWNER' && (
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="font-headline text-[10px] uppercase text-primary underline flex items-center gap-1 hover:text-primary/80"
              >
                <Settings className="w-3 h-3" />
                <span>Max Capacity: {group.maxMembers ?? 'No limit'}</span>
              </button>
            )}
          </div>

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
                        {member.role === 'OWNER' ? (
                          <span className="font-headline text-[10px] uppercase tracking-wider border border-brand-border px-1.5 py-0.5 text-brand-muted ml-2 shrink-0">
                            OWNER
                          </span>
                        ) : member.role === 'ADMIN' ? (
                          <span className="font-headline text-[10px] uppercase tracking-wider border border-primary bg-primary/10 text-primary px-1.5 py-0.5 ml-2 shrink-0 font-bold">
                            LEADER
                          </span>
                        ) : null}
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

                    {/* Leader Controls */}
                    {myRole === 'OWNER' && member.userId !== user?.id && member.role !== 'OWNER' && (
                      <div className="flex items-center gap-2 shrink-0">
                        {member.role === 'ADMIN' ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateMemberRoleMutation.mutate({ memberId: member.id, role: 'MEMBER' })
                            }
                            disabled={updateMemberRoleMutation.isPending}
                            className="min-h-[44px] px-1 font-headline text-[10px] uppercase text-brand-muted underline hover:text-black"
                          >
                            Set Member
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              updateMemberRoleMutation.mutate({ memberId: member.id, role: 'ADMIN' })
                            }
                            disabled={updateMemberRoleMutation.isPending}
                            className="min-h-[44px] px-1 font-headline text-[10px] uppercase text-primary underline hover:text-primary/80 font-bold"
                          >
                            Make Leader
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove ${member.user?.name ?? 'this member'} from the group?`)) {
                              removeMemberMutation.mutate(member.id);
                            }
                          }}
                          className="min-h-[44px] px-1 font-headline text-[10px] uppercase text-error underline"
                        >
                          Remove
                        </button>
                      </div>
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

        {/* Action buttons (Packing removed per request, keeping Equipment, Inventory, Calendar, Invite) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <button
            onClick={() => navigate(`/groups/${groupId}/equipment`)}
            className="border border-[#1A1A1A] bg-white font-headline text-xs uppercase py-3 tracking-widest hover:bg-brand-bg transition-colors rounded"
          >
            EQUIPMENT
          </button>
          <button
            onClick={() => navigate(`/groups/${groupId}/inventory`)}
            className="border border-[#1A1A1A] bg-white font-headline text-xs uppercase py-3 tracking-widest hover:bg-brand-bg transition-colors rounded"
          >
            INVENTORY
          </button>
          <button
            onClick={() => navigate(`/groups/${groupId}/calendar`)}
            className="border border-[#1A1A1A] bg-white font-headline text-xs uppercase py-3 tracking-widest hover:bg-brand-bg transition-colors rounded"
          >
            CALENDAR
          </button>
          <button
            onClick={() => navigate(`/groups/${groupId}/invite`)}
            className="border border-[#1A1A1A] bg-white font-headline text-xs uppercase py-3 tracking-widest hover:bg-brand-bg transition-colors rounded"
          >
            INVITE
          </button>
        </div>

        {/* Broadcast Gear Reminder & Leave / Delete Actions */}
        <div className="mt-4 mb-6 space-y-3">
          <Button
            variant="ghost"
            fullWidth
            disabled={!activityId || broadcastGearReminderMutation.isPending}
            loading={broadcastGearReminderMutation.isPending}
            onClick={() => broadcastGearReminderMutation.mutate()}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span>BROADCAST GEAR REMINDER</span>
            </span>
          </Button>

          {broadcastFeedback && (
            <p className="text-center font-headline text-xs uppercase tracking-wider text-primary p-2 bg-primary/10 border border-primary rounded font-bold">
              {broadcastFeedback}
            </p>
          )}

          {myRole === 'OWNER' && (
            <button
              type="button"
              onClick={() => {
                setDragSliderX(0);
                setShowDeleteModal(true);
              }}
              className="w-full min-h-[44px] border border-red-400 bg-white font-headline font-bold text-xs uppercase tracking-widest text-red-600 flex items-center justify-center hover:bg-red-50 transition-colors rounded"
            >
              DELETE GROUP
            </button>
          )}

          {myRole !== 'OWNER' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Leave this group?')) leaveGroupMutation.mutate();
              }}
              disabled={leaveGroupMutation.isPending}
              className="w-full min-h-[44px] border border-red-400 bg-white font-headline font-bold text-xs uppercase tracking-widest text-red-600 disabled:opacity-50 rounded"
            >
              Leave group
            </button>
          )}
        </div>
      </div>

      {/* Modal: Schedule Squad Event */}
      {showCreateActivity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
            <h2 className="font-headline font-bold text-base uppercase">Schedule Squad Event</h2>
            <Input
              label="Event Name"
              required
              value={newActivityName}
              onChange={(e) => setNewActivityName(e.target.value)}
              placeholder="e.g. League Match vs Rovers"
            />
            <div>
              <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted mb-1">
                Activity Type
              </label>
              <select
                value={newActivityType}
                onChange={(e) => setNewActivityType(e.target.value)}
                className="w-full border border-brand-border p-2 bg-white text-xs"
              >
                <option value="TRAINING">Training</option>
                <option value="COMPETITION">Competition</option>
                <option value="CASUAL">Casual</option>
                <option value="TRAVEL">Travel</option>
              </select>
            </div>
            <Input
              label="Date & Time"
              type="datetime-local"
              value={newActivityDate}
              onChange={(e) => setNewActivityDate(e.target.value)}
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowCreateActivity(false)}>
                Cancel
              </Button>
              <Button
                variant="urgent"
                disabled={!newActivityName.trim() || createActivityMutation.isPending}
                loading={createActivityMutation.isPending}
                onClick={() => createActivityMutation.mutate()}
              >
                Create Event
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Squad Capacity (Max Members) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="font-headline font-bold text-base uppercase">Squad Capacity Settings</h2>
            </div>
            <p className="font-body text-xs text-brand-muted">
              Configure the maximum number of squad members allowed to join this group.
            </p>
            <Input
              label="Maximum Member Count"
              type="number"
              min={1}
              max={500}
              value={maxMembersInput}
              onChange={(e) => setMaxMembersInput(e.target.value)}
              placeholder="Leave empty for unlimited"
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowSettingsModal(false)}>
                Cancel
              </Button>
              <Button
                variant="urgent"
                loading={updateGroupMutation.isPending}
                onClick={() => {
                  const num = maxMembersInput !== '' ? Number(maxMembersInput) : undefined;
                  updateGroupMutation.mutate({ maxMembers: num });
                }}
              >
                Save Capacity
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Group with Drag Slider Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-base uppercase text-brand-text">
                  Delete Squad?
                </h3>
                <p className="font-body text-xs text-brand-muted">
                  Permanent action, cannot be undone
                </p>
              </div>
            </div>
            <p className="font-body text-xs text-brand-muted">
              All events, equipment manifests, and squad records will be deleted immediately.
            </p>

            {/* Slider Track */}
            <div className="space-y-2 pt-2">
              <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted text-center">
                Slide button from left to right to delete
              </label>
              <div
                ref={sliderTrackRef}
                className="relative h-12 bg-red-50 border-2 border-red-300 rounded-full overflow-hidden select-none touch-none flex items-center"
              >
                {/* Progress fill */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-red-500/25 pointer-events-none"
                  style={{ width: `${dragSliderX + 44}px` }}
                />

                {/* Instruction Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="font-headline font-bold text-[10px] uppercase tracking-widest text-red-600">
                    {dragSliderX > 140 ? 'RELEASE TO DELETE' : 'DRAG BUTTON TO DELETE ➔'}
                  </span>
                </div>

                {/* Draggable Button */}
                <div
                  onPointerDown={(e) => {
                    setIsSliderDragging(true);
                    sliderStartX.current = e.clientX - dragSliderX;
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!isSliderDragging || !sliderTrackRef.current) return;
                    const trackWidth = sliderTrackRef.current.clientWidth;
                    const maxTravel = trackWidth - 48;
                    const currentX = Math.max(0, Math.min(e.clientX - sliderStartX.current, maxTravel));
                    setDragSliderX(currentX);
                  }}
                  onPointerUp={() => {
                    if (!isSliderDragging || !sliderTrackRef.current) return;
                    setIsSliderDragging(false);
                    const trackWidth = sliderTrackRef.current.clientWidth;
                    const maxTravel = trackWidth - 48;
                    if (dragSliderX >= maxTravel * 0.85) {
                      deleteGroupMutation.mutate();
                    } else {
                      setDragSliderX(0);
                    }
                  }}
                  className="absolute left-1 w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md z-10 transition-transform"
                  style={{
                    transform: `translateX(${dragSliderX}px)`,
                    transition: isSliderDragging ? 'none' : 'transform 200ms ease-out',
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Cancel Button Below */}
            <div className="pt-2">
              <Button
                variant="ghost"
                fullWidth
                disabled={deleteGroupMutation.isPending}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDragSliderX(0);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Takeover Alert */}
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
