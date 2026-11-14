import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldAlert, AlertCircle } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface SignInMethod {
  type: 'PASSWORD' | 'SSO';
  email: string;
  provider?: string;
  connectedAt?: string;
}

interface EquipmentPreference {
  personalizedRanking?: boolean;
  personalizationEnabled?: boolean;
}

interface ConnectRequest {
  id: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  receiverUserId: string;
  receiverEmail: string;
  ssoEmail: string;
  provider: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(
    searchParams.get('linked') ? 'Google account successfully linked!' : null,
  );

  const pendingApprovalParam = searchParams.get('pendingApproval') === 'true';
  const receiverEmailParam = searchParams.get('receiverEmail') || '';

  const { data: methods, isLoading: methodsLoading } = useQuery<SignInMethod[]>({
    queryKey: ['sso-methods'],
    queryFn: () => api.get('/auth/sso/methods').then((r) => r.data),
  });

  const { data: connectRequests } = useQuery<ConnectRequest[]>({
    queryKey: ['sso-connect-requests'],
    queryFn: () => api.get('/auth/sso/connect-requests').then((r) => r.data || []),
  });

  const { data: preference, isLoading: prefLoading } = useQuery<EquipmentPreference>({
    queryKey: ['catalogue-preference'],
    queryFn: () => api.get('/equipment-catalogue/preferences/me').then((r) => r.data),
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return api.post(`/auth/sso/connect-requests/${requestId}/accept`);
    },
    onSuccess: (_, requestId) => {
      const req = connectRequests?.find((r) => r.id === requestId);
      setActionSuccess(`Successfully connected to ${req?.requesterEmail || 'account'}.`);
      queryClient.invalidateQueries({ queryKey: ['sso-connect-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sso-methods'] });
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || 'Failed to accept connection request.');
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return api.post(`/auth/sso/connect-requests/${requestId}/decline`);
    },
    onSuccess: () => {
      setActionSuccess('Connection request declined.');
      queryClient.invalidateQueries({ queryKey: ['sso-connect-requests'] });
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || 'Failed to decline connection request.');
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const returnUrl = `${window.location.origin}/auth/callback`;
      const res = await api.post<{ authorizationUrl: string }>('/auth/sso/google/link/start', {
        returnUrl,
      });
      window.location.href = res.data.authorizationUrl;
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || 'Failed to start Google linking.');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (provider: string) => {
      return api.delete(`/auth/sso/${provider}`);
    },
    onSuccess: () => {
      setActionSuccess('Sign-in method disconnected successfully.');
      queryClient.invalidateQueries({ queryKey: ['sso-methods'] });
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || 'Failed to disconnect method.');
    },
  });

  const togglePersonalization = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) {
        return api.patch('/equipment-catalogue/preferences/me', { personalizedRanking: true });
      } else {
        return api.delete('/equipment-catalogue/preferences/me/personalization');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue-preference'] });
    },
  });

  const hasGoogle = Array.isArray(methods)
    ? methods.some((m) => m.type === 'SSO' && m.provider === 'GOOGLE')
    : false;
  const hasPassword = Array.isArray(methods)
    ? methods.some((m) => m.type === 'PASSWORD')
    : false;
  const canDisconnectGoogle = (Array.isArray(methods) ? methods.length : 0) > 1;

  return (
    <PageLayout>
      <div className="py-6 space-y-6">
        <header>
          <h1 className="font-headline text-2xl font-bold uppercase tracking-wider text-brand-text">
            Account Settings
          </h1>
          <p className="font-body text-sm text-brand-muted">
            Manage your credentials, authentication methods, and gear preferences.
          </p>
        </header>

        {actionSuccess && (
          <div className="bg-white border border-[#2D6A4F] px-4 py-3 rounded-lg">
            <p className="font-body text-sm text-[#2D6A4F] font-bold">{actionSuccess}</p>
          </div>
        )}

        {actionError && (
          <div className="bg-white border border-[#BA1A1A] px-4 py-3 rounded-lg">
            <p className="font-body text-sm text-[#BA1A1A]">{actionError}</p>
          </div>
        )}

        {pendingApprovalParam && (
          <div className="bg-blue-50 border border-blue-400 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-headline text-xs font-bold uppercase tracking-wider text-blue-800">
                Connection Request Awaiting Approval
              </p>
              <p className="font-body text-xs text-blue-700 mt-0.5">
                This Google account is currently associated with{' '}
                <span className="font-bold">{receiverEmailParam || 'another user'}</span>. A request
                has been sent to their account asking if they want to connect it to your account.
              </p>
            </div>
          </div>
        )}

        {/* Incoming SSO Connection Requests */}
        {connectRequests && connectRequests.length > 0 && (
          <section className="bg-amber-50 border-2 border-primary rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h2 className="font-headline font-bold text-sm uppercase tracking-wider text-brand-text">
                Incoming Account Connection Request
              </h2>
            </div>
            <div className="space-y-4">
              {connectRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-brand-border rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-body text-sm text-brand-text font-bold">
                      Account <span className="text-primary">{req.requesterEmail}</span> ({req.requesterName}) wants to connect your Google account ({req.ssoEmail}).
                    </p>
                    <p className="font-body text-xs text-brand-muted mt-1">
                      Do you want to connect your Google account to {req.requesterEmail}?
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={acceptRequestMutation.isPending}
                      onClick={() => acceptRequestMutation.mutate(req.id)}
                    >
                      Connect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={declineRequestMutation.isPending}
                      onClick={() => declineRequestMutation.mutate(req.id)}
                      className="text-brand-muted hover:text-brand-text"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* User Profile */}
        <section className="bg-white border border-brand-border rounded-lg p-5">
          <h2 className="font-headline font-bold text-sm uppercase tracking-wider mb-3">
            Profile Info
          </h2>
          <div className="space-y-2">
            <div>
              <span className="font-headline text-[10px] uppercase text-brand-muted block">
                Name
              </span>
              <span className="font-body text-sm text-brand-text font-bold">
                {user?.name || 'Not provided'}
              </span>
            </div>
            <div>
              <span className="font-headline text-[10px] uppercase text-brand-muted block">
                Email
              </span>
              <span className="font-body text-sm text-brand-text">{user?.email}</span>
            </div>
            <div>
              <span className="font-headline text-[10px] uppercase text-brand-muted block">
                Account Status
              </span>
              <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-headline font-bold uppercase tracking-wider bg-[#2D6A4F]/10 text-[#2D6A4F] rounded">
                Verified
              </span>
            </div>
          </div>
        </section>

        {/* Sign-in Methods */}
        <section className="bg-white border border-brand-border rounded-lg p-5">
          <h2 className="font-headline font-bold text-sm uppercase tracking-wider mb-1">
            Connected Sign-In Methods
          </h2>
          <p className="font-body text-xs text-brand-muted mb-4">
            You must always have at least one active sign-in method connected.
          </p>

          {methodsLoading ? (
            <div className="py-4 flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Password Method */}
              <div className="flex items-center justify-between p-3 border border-brand-border rounded">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-headline text-xs font-bold uppercase text-brand-text">
                      Email & Password
                    </p>
                    <p className="font-body text-xs text-brand-muted">
                      {hasPassword ? user?.email : 'Not set'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-headline uppercase tracking-wider text-[#2D6A4F]">
                  {hasPassword ? 'CONNECTED' : 'INACTIVE'}
                </span>
              </div>

              {/* Google Method */}
              <div className="flex items-center justify-between p-3 border border-brand-border rounded">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-brand-border flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-headline text-xs font-bold uppercase text-brand-text">
                      Google Account
                    </p>
                    <p className="font-body text-xs text-brand-muted">
                      {hasGoogle ? 'Connected to Google' : 'Not connected'}
                    </p>
                  </div>
                </div>

                {hasGoogle ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canDisconnectGoogle || unlinkMutation.isPending}
                    loading={unlinkMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Disconnect your Google account?')) {
                        unlinkMutation.mutate('GOOGLE');
                      }
                    }}
                    className="text-[#BA1A1A] hover:bg-red-50 text-xs"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={linkMutation.isPending}
                    onClick={() => {
                      setActionError(null);
                      linkMutation.mutate();
                    }}
                    className="border border-[#1A1A1A] text-xs"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Smart Preferences */}
        <section className="bg-white border border-brand-border rounded-lg p-5">
          <h2 className="font-headline font-bold text-sm uppercase tracking-wider mb-2">
            Smart Entry & Personalization
          </h2>
          <p className="font-body text-xs text-brand-muted mb-4">
            Adaptive equipment ranking learns from your accepted items to prioritize relevant gear.
          </p>

          {prefLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-headline text-xs uppercase text-brand-text">
                Personalized gear suggestions
              </span>
              <input
                type="checkbox"
                checked={preference?.personalizedRanking ?? preference?.personalizationEnabled ?? true}
                onChange={(e) => togglePersonalization.mutate(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
            </label>
          )}
        </section>

        {/* Session / Logout */}
        <div className="pt-2">
          <Button variant="ghost" fullWidth onClick={() => logout()} className="text-[#BA1A1A]">
            LOG OUT
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
