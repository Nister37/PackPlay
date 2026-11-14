import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import type { User } from '@/types';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      const err = searchParams.get('error');
      const errMessage = searchParams.get('message');
      if (err) {
        if (err === 'SSO_LINK_REQUIRED') {
          navigate(
            `/login?error=SSO_LINK_REQUIRED&message=${encodeURIComponent(
              'Sign in with your existing email and password, then connect Google in Settings.',
            )}`,
            { replace: true },
          );
          return;
        }
        setError(errMessage || err || 'Authentication failed. Please try again.');
        return;
      }

      // Check if tokens were passed via redirect params
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const userParam = searchParams.get('user');
      const linked = searchParams.get('linked');
      const pendingApproval = searchParams.get('pendingApproval');
      const receiverEmail = searchParams.get('receiverEmail');

      if (pendingApproval) {
        navigate(
          `/settings?pendingApproval=true&receiverEmail=${encodeURIComponent(
            receiverEmail || '',
          )}`,
          { replace: true },
        );
        return;
      }

      if (linked) {
        navigate('/settings?linked=true', { replace: true });
        return;
      }

      if (accessToken && refreshToken && userParam) {
        try {
          const userObj = JSON.parse(userParam) as User;
          setSession({ accessToken, refreshToken }, userObj);
          navigate('/dashboard', { replace: true });
          return;
        } catch {
          setError('Failed to parse authentication payload.');
          return;
        }
      }

      // Check if code & state were provided directly to callback
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (code && state) {
        try {
          const response = await api.get('/auth/sso/google/callback', {
            params: { code, state },
          });

          if (response.data.pendingApproval) {
            navigate(
              `/settings?pendingApproval=true&receiverEmail=${encodeURIComponent(
                response.data.receiverEmail || '',
              )}`,
              { replace: true },
            );
            return;
          }

          if (response.data.linked) {
            navigate('/settings?linked=true', { replace: true });
            return;
          }

          if (response.data.accessToken && response.data.refreshToken) {
            setSession(
              {
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
              },
              response.data.user,
            );
            const returnUrl = response.data.returnUrl || '/dashboard';
            navigate(returnUrl.startsWith('http') ? '/dashboard' : returnUrl, { replace: true });
            return;
          }
        } catch (apiErr: any) {
          const apiCode = apiErr.response?.data?.code;
          const apiMsg = apiErr.response?.data?.message;

          if (apiCode === 'SSO_LINK_REQUIRED') {
            navigate(
              `/login?error=SSO_LINK_REQUIRED&message=${encodeURIComponent(
                'An account with this email already exists. Sign in with your password and connect Google in Settings.',
              )}`,
              { replace: true },
            );
            return;
          }

          setError(apiMsg || 'SSO authentication failed. Please try again.');
          return;
        }
      }

      setError('No authorization parameters found.');
    }

    handleAuth();
  }, [navigate, searchParams, setSession]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="bg-white border border-[#BA1A1A] p-6 max-w-md w-full text-center">
          <h2 className="font-headline font-bold text-lg text-[#BA1A1A] uppercase mb-2">
            Authentication Error
          </h2>
          <p className="font-body text-sm text-brand-muted mb-4">{error}</p>
          <Button variant="ghost" fullWidth onClick={() => navigate('/login')}>
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="font-headline text-xs uppercase tracking-widest text-brand-muted mt-4">
          Completing authentication...
        </p>
      </div>
    </div>
  );
}
