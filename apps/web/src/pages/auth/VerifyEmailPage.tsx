import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const redirect = searchParams.get('redirect');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const calledRef = useRef(false);

  const loginPath = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided.');
      return;
    }

    if (calledRef.current) return;
    calledRef.current = true;

    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(
          err.response?.data?.message || 'Verification failed. The token may be invalid or expired.',
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Dark top section */}
      <div className="bg-[#1A1A1A] px-6 pt-16 pb-10">
        <p className="font-headline text-[10px] uppercase tracking-[0.2em] text-[#916F65] mb-3">
          EMAIL VERIFICATION
        </p>
        <h1 className="font-headline font-bold text-4xl text-white uppercase tracking-tight">
          GEARGUARDIAN
        </h1>
      </div>

      {/* Content area */}
      <div className="flex-1 bg-[#FCF9F8]">
        <div className="px-6 py-8 max-w-[390px] mx-auto w-full">
          {status === 'loading' && (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" />
              <p className="mt-4 font-body text-sm text-brand-muted">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <div className="bg-white border border-success px-4 py-3 mb-6">
                <p className="font-headline text-sm uppercase text-success font-bold">
                  Email Verified Successfully
                </p>
              </div>
              <p className="font-body text-sm text-brand-muted mb-6">
                Your email has been confirmed. You can now log in.
              </p>
              <Link
                to={loginPath}
                className="block w-full min-h-[52px] bg-[#1A1A1A] text-white font-headline font-bold uppercase tracking-wider leading-[52px] text-center"
              >
                GO TO LOGIN
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <div className="bg-white border border-error px-4 py-3 mb-6">
                <p className="font-headline text-sm uppercase text-error font-bold">
                  Verification Failed
                </p>
                <p className="font-body text-sm text-brand-muted mt-1">{errorMessage}</p>
              </div>
              <Link
                to={loginPath}
                className="block w-full min-h-[52px] bg-[#1A1A1A] text-white font-headline font-bold uppercase tracking-wider leading-[52px] text-center"
              >
                GO TO LOGIN
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
