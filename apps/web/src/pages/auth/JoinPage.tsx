import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { Invitation, GroupMember } from '@/types';

interface InvitationInfo {
  token: string;
  group: Invitation['group'];
  expiresAt?: string;
  maxUses?: number;
  useCount: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).toUpperCase();
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function isMaxedOut(info: InvitationInfo): boolean {
  if (!info.maxUses) return false;
  return info.useCount >= info.maxUses;
}

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [joinError, setJoinError] = useState<string | null>(null);

  // Store invite token for auto-join after login
  useEffect(() => {
    if (token && !isAuthenticated && !authLoading) {
      localStorage.setItem('pendingInviteToken', token);
    }
  }, [token, isAuthenticated, authLoading]);

  const { data: inviteInfo, isLoading: infoLoading, error: infoError } = useQuery<InvitationInfo>({
    queryKey: ['invitation-info', token],
    queryFn: () => api.get(`/invitations/${token}/info`).then(r => r.data),
    enabled: !!token,
    retry: false,
  });

  const joinMutation = useMutation<GroupMember>({
    mutationFn: () => api.post(`/invitations/${token}/join`).then(r => r.data),
    onSuccess: (member) => {
      navigate(`/groups/${member.groupId}`, { replace: true });
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number } };
      const status = axiosErr.response?.status;
      const message = axiosErr.response?.data?.message;

      if (status === 409 || (message && message.toLowerCase().includes('already'))) {
        setJoinError('You are already a member of this group.');
      } else if (status === 410 || (message && message.toLowerCase().includes('expired'))) {
        setJoinError('This invitation has expired.');
      } else {
        setJoinError(message ?? 'Failed to join group. Please try again.');
      }
    },
  });

  const expired = inviteInfo ? isExpired(inviteInfo.expiresAt) : false;
  const maxedOut = inviteInfo ? isMaxedOut(inviteInfo) : false;
  const canJoin = !expired && !maxedOut && !joinError;

  const redirectParam = `?redirect=/join/${token}`;

  if (authLoading || infoLoading) {
    return (
      <PageLayout hideNav>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  // Token/invite fetch error
  if (infoError) {
    const axiosErr = infoError as { response?: { status?: number } };
    const status = axiosErr.response?.status;

    return (
      <PageLayout hideNav>
        <div className="pt-10 pb-8">
          <Card className="border-red-500 border-2">
            <p className="font-headline font-bold text-sm uppercase tracking-wider text-red-600 mb-2">
              {status === 404 ? 'INVALID INVITE' : 'ERROR'}
            </p>
            <p className="font-body text-sm text-brand-muted">
              {status === 404
                ? 'This invitation link is invalid or does not exist.'
                : 'Something went wrong loading this invitation.'}
            </p>
          </Card>
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="font-headline text-xs uppercase tracking-wider text-brand-muted underline"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout hideNav>
      <div className="pt-10 pb-8">
        {/* Label */}
        <p className="font-headline text-xs uppercase tracking-widest text-brand-muted mb-3">
          YOU'VE BEEN INVITED TO
        </p>

        {/* Group Card */}
        {inviteInfo && (
          <Card className="mb-6">
            <div className="border-b border-brand-border pb-4 mb-4">
              <h1 className="font-headline font-bold text-2xl uppercase tracking-wider text-brand-text">
                {inviteInfo.group.name}
              </h1>
              {inviteInfo.group.sport && (
                <p className="font-headline text-sm uppercase tracking-wider text-primary mt-1">
                  {inviteInfo.group.sport}
                </p>
              )}
            </div>

            <div className="flex items-center gap-6 text-xs">
              {inviteInfo.expiresAt && (
                <div>
                  <p className="font-headline uppercase tracking-wider text-brand-muted">EXPIRES</p>
                  <p className="font-headline font-bold text-brand-text mt-0.5">
                    {expired ? (
                      <span className="text-red-600">EXPIRED</span>
                    ) : (
                      formatDate(inviteInfo.expiresAt)
                    )}
                  </p>
                </div>
              )}
              {inviteInfo.maxUses && (
                <div>
                  <p className="font-headline uppercase tracking-wider text-brand-muted">SPOTS LEFT</p>
                  <p className="font-headline font-bold text-brand-text mt-0.5">
                    {maxedOut ? (
                      <span className="text-red-600">FULL</span>
                    ) : (
                      `${inviteInfo.maxUses - inviteInfo.useCount} / ${inviteInfo.maxUses}`
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Status Alerts */}
            {(expired || maxedOut) && (
              <div className="mt-4 border border-red-300 bg-red-50 rounded px-3 py-2">
                <p className="font-body text-xs text-red-700">
                  {expired
                    ? 'This invitation link has expired. Ask your group admin for a new one.'
                    : 'This invitation has reached its maximum number of uses.'}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Join Error */}
        {joinError && (
          <Card className="border-red-500 mb-4">
            <p className="font-body text-sm text-red-600">{joinError}</p>
          </Card>
        )}

        {/* Auth / Action Section */}
        {!isAuthenticated ? (
          <div className="space-y-3">
            <p className="font-body text-sm text-brand-muted mb-4">
              Login or register to join this group.
            </p>
            <Link to={`/login${redirectParam}`} className="block">
              <Button variant="urgent" fullWidth>
                LOGIN TO JOIN
              </Button>
            </Link>
            <Link to={`/register${redirectParam}`} className="block">
              <Button variant="ghost" fullWidth>
                CREATE AN ACCOUNT
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {canJoin && (
              <Button
                variant="urgent"
                fullWidth
                loading={joinMutation.isPending}
                onClick={() => joinMutation.mutate()}
              >
                JOIN MISSION
              </Button>
            )}
            <Link to="/groups" className="block">
              <Button variant="ghost" fullWidth>
                BACK TO GROUPS
              </Button>
            </Link>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
