import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/api';
import type { Invitation } from '@/types';

function formatExpiry(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear().toString().slice(2);
  return `${day} ${month} ${year}`;
}

export function InvitePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: invitations, isLoading, error } = useQuery<Invitation[]>({
    queryKey: ['invitations', groupId],
    queryFn: () => api.get(`/groups/${groupId}/invitations`).then(r => r.data),
  });

  const activeInvitation = invitations?.[0];
  const inviteLink = activeInvitation
    ? `${window.location.origin}/join/${activeInvitation.token}`
    : '';

  const createInvitation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/invitations`, {
        expiresInHours: 168, // 7 days
        maxUses: 50,
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', groupId] });
    },
  });

  const regenerateInvitation = useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/invitations/regenerate`, {
      expiresInHours: 168,
      maxUses: 50,
    }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations', groupId] }),
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silent fail
      }
      document.body.removeChild(textArea);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${activeInvitation?.group?.name ?? 'our group'} on GearGuardian`,
          url: inviteLink,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  return (
    <PageLayout>
      <div className="pt-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-headline font-bold text-xl uppercase tracking-wider text-brand-text">
            TEAM ACCESS PASS
          </h1>
          <button
            onClick={() => navigate(-1)}
            className="font-headline text-xs uppercase tracking-wider text-brand-muted border border-brand-border px-3 py-2 hover:text-brand-text transition-colors"
          >
            BACK
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && !isLoading && (
          <div className="border-2 border-red-500 rounded-lg p-4 bg-white">
            <p className="font-headline font-bold text-sm uppercase text-red-600 mb-1">ERROR</p>
            <p className="font-body text-sm text-brand-muted">
              Failed to load invitations. Please try again.
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Pass Card */}
            <div className="border-2 border-brand-border rounded-lg bg-white overflow-hidden mb-6">
              {/* Pass Header */}
              <div className="bg-brand-border px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-headline font-bold text-xs uppercase tracking-widest text-white opacity-70">
                    GEARGUARDIAN
                  </p>
                  <p className="font-headline font-bold text-sm uppercase tracking-wider text-white">
                    {activeInvitation?.group?.name ?? 'GROUP INVITE'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-headline text-xs uppercase tracking-wider text-white opacity-70">
                    SPORT
                  </p>
                  <p className="font-headline text-xs font-bold uppercase text-white">
                    {activeInvitation?.group?.sport ?? '—'}
                  </p>
                </div>
              </div>

              {/* Serial Row */}
              <div className="border-b border-brand-border px-4 py-2 flex items-center justify-between bg-brand-bg">
                <span className="font-headline text-xs uppercase tracking-widest text-brand-muted">
                  SERIAL
                </span>
                <span className="font-headline font-bold text-xs tracking-widest text-brand-text">
                  #{activeInvitation ? activeInvitation.id.slice(0, 8).toUpperCase() : '—'}
                </span>
              </div>

              {/* QR Code Area */}
              <div className="flex flex-col items-center py-6 px-4 border-b border-brand-border">
                {activeInvitation ? (
                  <>
                    <div className="border border-brand-border p-2 bg-white">
                      <QRCodeSVG
                        value={inviteLink}
                        size={180}
                        fgColor="#1A1A1A"
                        bgColor="#FFFFFF"
                        level="M"
                      />
                    </div>
                    <p className="font-body text-xs text-brand-muted mt-3 text-center break-all font-mono leading-relaxed px-2">
                      {inviteLink}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-[180px] h-[180px] border-2 border-dashed border-brand-border flex items-center justify-center">
                      <p className="font-headline text-xs text-brand-muted text-center uppercase tracking-wider px-4">
                        NO ACTIVE INVITE
                      </p>
                    </div>
                    <p className="font-body text-xs text-brand-muted mt-3 text-center">
                      Create a new invite link to get started
                    </p>
                  </div>
                )}
              </div>

              {/* Stats Row */}
              {activeInvitation && (
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="text-center">
                    <p className="font-headline text-xs uppercase tracking-wider text-brand-muted">
                      EXPIRES
                    </p>
                    <p className="font-headline font-bold text-xs text-brand-text mt-0.5">
                      {activeInvitation.expiresAt ? formatExpiry(activeInvitation.expiresAt) : 'NEVER'}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-brand-border" />
                  <div className="text-center">
                    <p className="font-headline text-xs uppercase tracking-wider text-brand-muted">
                      MAX USES
                    </p>
                    <p className="font-headline font-bold text-xs text-brand-text mt-0.5">
                      {activeInvitation.maxUses ?? '∞'}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-brand-border" />
                  <div className="text-center">
                    <p className="font-headline text-xs uppercase tracking-wider text-brand-muted">
                      USED
                    </p>
                    <p className="font-headline font-bold text-xs text-brand-text mt-0.5">
                      {activeInvitation.useCount}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="font-body text-sm text-brand-muted mb-6 leading-relaxed">
              Anyone with this link can join the manifest and add items.
            </p>

            {/* Action Buttons */}
            {activeInvitation && (
              <div className="flex gap-3 mb-4">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleCopy}
                  className="flex-1"
                >
                  {copied ? 'COPIED!' : 'COPY LINK'}
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={handleShare}
                  className="flex-1"
                >
                  SHARE
                </Button>
              </div>
            )}

            <Button
              variant="urgent"
              fullWidth
              loading={createInvitation.isPending || regenerateInvitation.isPending}
              onClick={() => activeInvitation ? regenerateInvitation.mutate() : createInvitation.mutate()}
            >
              {activeInvitation ? 'INVALIDATE & REGENERATE' : 'CREATE NEW INVITE LINK'}
            </Button>

            {createInvitation.isError && (
              <p className="font-body text-xs text-red-600 mt-3 text-center">
                Failed to create invitation. Please try again.
              </p>
            )}
            {regenerateInvitation.isError && (
              <p className="font-body text-xs text-red-600 mt-3 text-center">Failed to regenerate invitation.</p>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
