import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusChip } from '@/components/ui/StatusChip';
import api from '@/lib/api';
import type { Group, GroupActivity, GroupReadiness } from '@/types';

function GroupMissionCard({ group }: { group: Group }) {
  const { data: activities } = useQuery<GroupActivity[]>({
    queryKey: ['activities', group.id],
    queryFn: () => api.get(`/groups/${group.id}/activities`).then((r) => r.data),
  });

  const activityId = activities?.[0]?.id;

  const { data: readiness } = useQuery<GroupReadiness>({
    queryKey: ['readiness', activityId],
    queryFn: () => api.get(`/activities/${activityId}/readiness`).then((r) => r.data),
    enabled: !!activityId,
  });

  const overallReadiness = readiness?.groupPercentage ?? 0;
  const hasAlerts =
    readiness != null &&
    readiness.totalSharedItems > 0 &&
    readiness.coveredSharedItems < readiness.totalSharedItems;
  const packedCount = readiness?.coveredSharedItems ?? 0;
  const totalCount = readiness?.totalSharedItems ?? 0;

  return (
    <Link
      to={`/groups/${group.id}`}
      className="block mb-3 bg-white border border-[#1A1A1A] rounded-lg p-4 hover:border-primary transition-colors"
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-headline font-bold text-sm uppercase tracking-wide text-brand-text truncate flex-1 min-w-0">
          {group.name}
        </h3>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          {group.memberCount != null && (
            <span className="font-headline text-[10px] uppercase tracking-wider border border-brand-border px-2 py-0.5 text-brand-text">
              {group.memberCount} {group.memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-headline text-[10px] uppercase tracking-widest text-brand-muted">
          {group.sport ?? 'TOURNAMENT'}
        </p>
        {hasAlerts && <StatusChip status="urgent" label="CRITICAL!" />}
      </div>
      <div className="flex items-center justify-between mb-1">
        <ProgressBar value={Math.round(overallReadiness)} />
        <span className="font-headline font-bold text-sm text-brand-text ml-3 shrink-0">
          {Math.round(overallReadiness)}%
        </span>
      </div>
      <p className="font-headline text-[10px] uppercase tracking-widest text-brand-muted mt-1">
        {packedCount} / {totalCount} ITEMS PACKED
      </p>
    </Link>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();

  const {
    data: groups,
    isLoading,
    isError,
  } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data),
  });

  return (
    <PageLayout>
      {/* Dark header — break out of PageLayout padding with negative margin */}
      <div className="bg-[#1A1A1A] mx-[-16px] px-4 pt-12 pb-4 flex justify-between items-center">
        <h1 className="font-headline font-bold text-lg text-white uppercase tracking-wide">
          GEARGUARDIAN
        </h1>
        <button
          aria-label="Notifications"
          className="w-10 h-10 flex items-center justify-center border border-white/30 text-white text-xl"
        >
          🔔
        </button>
      </div>

      {/* Body */}
      <div className="pt-5">
        {/* Active Missions */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              ACTIVE MISSIONS
            </p>
            <Link
              to="/groups/new"
              className="w-8 h-8 flex items-center justify-center bg-primary text-white font-headline font-bold text-lg border border-primary"
              aria-label="Create new group"
            >
              +
            </Link>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {isError && (
            <div className="bg-white border border-[#BA1A1A] rounded-lg px-4 py-3">
              <p className="font-body text-sm text-[#BA1A1A]">Failed to load groups. Please try again.</p>
            </div>
          )}

          {!isLoading && !isError && groups && groups.length === 0 && (
            <div className="bg-white border border-brand-border rounded-lg p-4 text-center py-10">
              <p className="font-headline font-bold text-sm uppercase tracking-widest text-brand-muted mb-1">
                NO ACTIVE MISSIONS
              </p>
              <p className="font-body text-xs text-brand-muted mb-5">
                Create your first group to get started.
              </p>
              <Button variant="urgent" onClick={() => navigate('/groups/new')}>
                START NEW MISSION
              </Button>
            </div>
          )}

          {!isLoading && !isError && groups && groups.length > 0 && (
            <div>
              {groups.map((group) => (
                <GroupMissionCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section>
          <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
            RECENT ACTIVITY
          </p>
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#2D6A4F] text-xs">●</span>
              <span className="font-headline text-xs uppercase tracking-wider text-[#2D6A4F]">SYSTEM READY</span>
            </div>
            <p className="font-body text-xs text-brand-muted">
              Connect your team to see live activity
            </p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
