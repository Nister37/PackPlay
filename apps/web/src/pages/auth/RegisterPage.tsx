import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
      {/* Dark header */}
      <div className="bg-brand-border px-4 pt-16 pb-10">
        <div className="mx-auto" style={{ maxWidth: '390px' }}>
          <p className="font-headline text-xs uppercase tracking-widest text-[#916F65] mb-2">
            SECURE MANIFEST ACCESS PROTOCOL
          </p>
          <h1 className="font-headline font-bold text-2xl text-white uppercase tracking-wider">
            GEARGUARDIAN
          </h1>
        </div>
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
