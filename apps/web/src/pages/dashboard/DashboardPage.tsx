import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardList, Settings, QrCode, ArrowRight } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusChip } from '@/components/ui/StatusChip';
import { groupsService } from '@/services/groups.service';
import { equipmentService } from '@/services/equipment.service';
import type { Group, GroupActivity, GroupReadiness } from '@/types';

function GroupMissionCard({ group }: { group: Group }) {
  const { data: activities } = useQuery<GroupActivity[]>({
    queryKey: ['activities', group.id],
    queryFn: () => groupsService.getGroupActivities(group.id),
  });

  const activityId = activities?.[0]?.id;

  const { data: readiness } = useQuery<GroupReadiness>({
    queryKey: ['readiness', activityId],
    queryFn: () => equipmentService.getActivityReadiness(activityId!),
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
    <div className="bg-white border border-[#1A1A1A] rounded-lg p-4 hover:border-primary transition-colors flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-1">
          <Link
            to={`/groups/${group.id}`}
            className="font-headline font-bold text-base uppercase tracking-wide text-brand-text truncate flex-1 min-w-0 hover:text-primary transition-colors"
          >
            {group.name}
          </Link>
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
            {group.sport ?? 'SQUAD'}
          </p>
          {hasAlerts && <StatusChip status="urgent" label="CRITICAL!" />}
        </div>

        {activityId ? (
          <div className="mb-3 p-2.5 bg-brand-bg rounded border border-brand-border text-xs">
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-headline font-bold truncate text-brand-text">
                {activities?.[0]?.name}
              </span>
              <Link
                to={`/groups/${group.id}/events/${activityId}`}
                className="text-[10px] font-headline font-bold text-primary hover:underline shrink-0 ml-2 uppercase"
              >
                <span className="inline-flex items-center gap-1">Event Details <ArrowRight className="w-3 h-3" /></span>
              </Link>
            </div>
            <div className="flex items-center justify-between mb-1">
              <ProgressBar value={Math.round(overallReadiness)} />
              <span className="font-headline font-bold text-xs text-brand-text ml-2 shrink-0">
                {Math.round(overallReadiness)}%
              </span>
            </div>
            <p className="font-headline text-[9px] uppercase tracking-widest text-brand-muted">
              {packedCount} / {totalCount} ITEMS PACKED
            </p>
          </div>
        ) : (
          <div className="mb-3 p-3 bg-brand-bg rounded border border-dashed border-brand-border text-center">
            <p className="font-body text-xs text-brand-muted">No upcoming events scheduled</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-border text-[11px] font-headline uppercase font-bold">
        <Link
          to={`/groups/${group.id}`}
          className="text-center py-1.5 px-1 border border-brand-border rounded hover:bg-brand-bg transition-colors"
        >
          Squad
        </Link>
        <Link
          to={`/groups/${group.id}/inventory`}
          className="text-center py-1.5 px-1 border border-brand-border rounded hover:bg-brand-bg transition-colors"
        >
          Inventory
        </Link>
        <Link
          to={`/groups/${group.id}/calendar`}
          className="text-center py-1.5 px-1 border border-brand-border rounded hover:bg-brand-bg transition-colors"
        >
          Calendar
        </Link>
      </div>
    </div>
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
    queryFn: () => groupsService.listGroups(),
  });

  return (
    <PageLayout>
      {/* Header Banner */}
      <div className="bg-[#1A1A1A] rounded-xl p-5 text-white mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-headline font-bold tracking-widest text-emerald-400 uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            PackPlay Mission Control
          </span>
          <h1 className="font-headline font-extrabold text-2xl uppercase tracking-wide">
            Operational Dashboard
          </h1>
          <p className="text-xs text-gray-300 mt-1 max-w-lg font-body">
            Monitor squad readiness, custody tracking, weather suggestions, and event schedules.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="urgent" onClick={() => navigate('/groups/new')}>
            + New Squad
          </Button>
        </div>
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Link
          to="/groups"
          className="bg-white border border-brand-border p-3 rounded-lg hover:border-primary transition-colors flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded bg-brand-bg flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-headline font-bold text-xs uppercase">Squads</p>
            <p className="text-[10px] text-brand-muted">Manage teams</p>
          </div>
        </Link>
        <Link
          to="/checklists"
          className="bg-white border border-brand-border p-3 rounded-lg hover:border-primary transition-colors flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded bg-brand-bg flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-headline font-bold text-xs uppercase">Checklists</p>
            <p className="text-[10px] text-brand-muted">Sport profiles</p>
          </div>
        </Link>
        <Link
          to="/settings"
          className="bg-white border border-brand-border p-3 rounded-lg hover:border-primary transition-colors flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded bg-brand-bg flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-headline font-bold text-xs uppercase">Settings</p>
            <p className="text-[10px] text-brand-muted">SSO & Preferences</p>
          </div>
        </Link>
        <button
          onClick={() => {
            const token = window.prompt('Enter QR Token to resolve custody:');
            if (token) navigate(`/inventory/qr/${encodeURIComponent(token.trim())}`);
          }}
          className="bg-white border border-brand-border p-3 rounded-lg hover:border-primary transition-colors flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded bg-brand-bg flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-headline font-bold text-xs uppercase">Scan QR</p>
            <p className="text-[10px] text-brand-muted">Resolve custody</p>
          </div>
        </button>
      </div>

      {/* Body */}
      <div>
        {/* Active Missions */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              ACTIVE MISSIONS & SQUADS
            </p>
            <Link
              to="/groups/new"
              className="text-xs font-headline font-bold text-primary uppercase hover:underline"
            >
              + Create Squad
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => (
                <GroupMissionCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </section>

        {/* System Activity */}
        <section>
          <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
            RECENT ACTIVITY & STATUS
          </p>
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#2D6A4F] text-xs">●</span>
              <span className="font-headline text-xs uppercase tracking-wider text-[#2D6A4F]">SYSTEM READY</span>
            </div>
            <p className="font-body text-xs text-brand-muted">
              Live squad readiness, inventory custody sync, and calendar feeds operational.
            </p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
