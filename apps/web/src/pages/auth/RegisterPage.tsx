import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function RegisterPage() {
  const { register } = useAuth();
  const [searchParams] = useSearchParams();

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [registered, setRegistered] = useState(false);

  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setLoading(true);

    try {
      await register(email, password, name);
      setRegistered(true);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
      ) {
        setError(String((err.response.data as { message: string }).message));
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Brand header */}
      <div className="bg-[#FCF9F8] border-b border-brand-border/40 px-6 pt-12 pb-6 flex flex-col items-center text-center">
        <Link to="/" className="flex flex-col items-center gap-2 group">
          <img
            src="/packplay-logo.png"
            alt="PackPlay"
            className="w-14 h-14 object-contain"
          />
          <div>
            <span className="font-headline font-bold text-2xl tracking-wider text-[#1A1A1A] block leading-none">
              PACKPLAY
            </span>
            <span className="font-headline text-[9px] uppercase tracking-widest text-[#FF4D00] block mt-1">
              READINESS OS
            </span>
          </div>
        </Link>
        <p className="font-headline text-[10px] uppercase tracking-[0.2em] text-[#916F65] mt-4">
          OPERATOR REGISTRATION
        </p>
      </div>

      {/* Form area */}
      <div
        className="flex-1 px-4 py-8"
        style={{ maxWidth: '390px', margin: '0 auto', width: '100%' }}
      >
        {registered ? (
          /* Success state */
          <div className="flex flex-col items-center gap-6 pt-4">
            <div className="border border-success bg-white w-full px-4 py-5">
              <p className="font-headline text-sm uppercase tracking-wider text-success mb-1">
                Account Created
              </p>
              <p className="font-body text-sm text-brand-text">
                Check your email to verify your account before logging in.
              </p>
            </div>
            <Link
              to={`/login${redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="font-headline font-bold text-sm uppercase tracking-wider text-brand-text underline hover:text-primary transition-colors"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            {/* Error alert */}
            {error && (
              <div className="border border-error bg-white px-4 py-3 mb-6">
                <p className="font-body text-sm text-error">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                label="Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                error={fieldErrors.name}
              />

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                error={fieldErrors.email}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                error={fieldErrors.password}
              />

              <Button
                type="submit"
                variant="urgent"
                fullWidth
                loading={loading}
                className="mt-2"
              >
                CREATE ACCOUNT
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#1A1A1A] opacity-20" />
              <span className="font-headline text-[10px] text-brand-muted">OR</span>
              <div className="flex-1 h-px bg-[#1A1A1A] opacity-20" />
            </div>

            {/* SSO button */}
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={async () => {
                try {
                  const res = await api.post<{ authorizationUrl: string }>('/auth/sso/google/start', {
                    returnUrl: `${window.location.origin}/auth/callback`,
                  });
                  window.location.href = res.data.authorizationUrl;
                } catch {
                  setError('Google SSO is currently unavailable.');
                }
              }}
              className="flex items-center justify-center gap-2 border border-[#1A1A1A] hover:bg-[#F0E8E4]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
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
              REGISTER WITH GOOGLE
            </Button>

            {/* Login link */}
            <p className="mt-8 text-center font-body text-sm text-brand-muted">
              Already have an account?{' '}
              <Link
                to={`/login${redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                className="font-headline font-bold uppercase tracking-wider text-brand-text hover:text-primary transition-colors"
              >
                LOGIN
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
