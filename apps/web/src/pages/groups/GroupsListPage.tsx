import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/api';
import type { Group } from '@/types';

export function GroupsListPage() {
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
      {/* Header */}
      <div className="pt-10 pb-6">
        <h1 className="font-headline font-bold text-xl uppercase tracking-widest text-brand-text">
          MY GROUPS
        </h1>
        <p className="font-headline text-xs text-brand-muted uppercase tracking-widest mt-1">
          MANAGE YOUR SQUADS
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="border border-error bg-white px-4 py-3 mb-4">
          <p className="font-body text-sm text-error">Failed to load groups. Please try again.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && groups && groups.length === 0 && (
        <Card className="text-center py-10 mb-4">
          <p className="font-headline font-bold text-sm uppercase tracking-widest text-brand-muted mb-1">
            NO GROUPS YET
          </p>
          <p className="font-body text-xs text-brand-muted mb-5">
            Create a group to coordinate your squad.
          </p>
        </Card>
      )}

      {/* Groups list */}
      {!isLoading && !isError && groups && groups.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {groups.map((group) => (
            <Link key={group.id} to={`/groups/${group.id}`} className="block">
              <Card className="hover:border-primary transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline font-bold text-base uppercase tracking-wide text-brand-text truncate">
                      {group.name}
                    </h3>
                    <p className="font-headline text-xs uppercase tracking-widest text-brand-muted mt-0.5">
                      {group.sport ?? (group as Group & { sportType?: string }).sportType ?? 'SPORT'}
                    </p>
                    {group.description && (
                      <p className="font-body text-xs text-brand-muted mt-1 truncate">
                        {group.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
                    {group.memberCount != null && (
                      <span className="font-headline text-xs uppercase tracking-wider border border-brand-border px-2 py-0.5 text-brand-text">
                        {group.memberCount} {group.memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
                      </span>
                    )}
                    <span className="font-headline text-xs uppercase tracking-wider text-primary">
                      VIEW →
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create button */}
      <div className="pt-2 pb-4">
        <Link to="/groups/new">
          <Button variant="urgent" fullWidth>
            + CREATE NEW GROUP
          </Button>
        </Link>
      </div>
    </PageLayout>
  );
}
