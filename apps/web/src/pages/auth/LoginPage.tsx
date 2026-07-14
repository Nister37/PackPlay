import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
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
        setError('Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Dark top section */}
      <div className="bg-[#1A1A1A] px-6 pt-16 pb-10">
        <p className="font-headline text-[10px] uppercase tracking-[0.2em] text-[#916F65] mb-3">
          SECURE MANIFEST ACCESS PROTOCOL
        </p>
        <h1 className="font-headline font-bold text-4xl text-white uppercase tracking-tight">
          GEARGUARDIAN
        </h1>
        <p className="font-headline text-xs text-[#5C4037] tracking-widest mt-1">
          INVENTORY SYSTEM v2.4
        </p>
      </div>

      {/* Form area */}
      <div className="flex-1 bg-[#FCF9F8]">
        <div className="px-6 py-8 max-w-[390px] mx-auto w-full">
          {/* Error card */}
          {error && (
            <div className="bg-white border border-[#BA1A1A] px-4 py-3 mb-4">
              <p className="font-body text-sm text-[#BA1A1A]">{error}</p>
              {error.toLowerCase().includes('verify') && (
                <Link
                  to={`/resend-verification?email=${encodeURIComponent(email)}`}
                  className="mt-2 inline-block font-headline text-xs font-bold uppercase tracking-wider text-brand-text underline"
                >
                  Resend verification email
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="OPERATOR EMAIL"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <div className="flex flex-col gap-1">
              <Input
                label="ACCESS CODE"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <div className="flex justify-end mt-1">
                <Link
                  to="/forgot-password"
                  className="font-headline text-[10px] uppercase tracking-widest text-brand-muted hover:text-brand-text transition-colors"
                >
                  FORGOT ACCESS CODE?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[52px] bg-[#1A1A1A] text-white font-headline font-bold uppercase tracking-wider mt-6 disabled:opacity-60"
            >
              {loading ? 'ACCESSING...' : 'ACCESS MANIFEST'}
            </button>
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
            disabled
            className="opacity-40 cursor-not-allowed"
          >
            REQUEST SSO ACCESS
          </Button>

          {/* Register link */}
          <p className="mt-8 text-center font-body text-sm text-brand-muted">
            NO ACCOUNT?{' '}
            <Link
              to={`/register${redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="font-headline font-bold uppercase text-brand-text hover:text-primary transition-colors"
            >
              REGISTER
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
