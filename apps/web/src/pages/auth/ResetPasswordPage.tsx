import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(token ? '' : 'This reset link is missing its token.');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/auth/password-reset/confirm', { token, newPassword: password });
      setComplete(true);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? 'This reset link is invalid or expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-brand-bg px-6 py-16">
      <section className="mx-auto max-w-[390px] bg-white border border-brand-border p-6">
        <h1 className="font-headline text-2xl font-bold uppercase">Choose a new password</h1>
        {complete ? (
          <div className="mt-6">
            <p role="status" className="border border-success p-4 text-sm text-success">Password updated. Existing sessions were signed out.</p>
            <Link to="/login" className="mt-6 inline-block font-headline text-xs uppercase underline">Continue to login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 mt-6">
            <Input label="New password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input label="Confirm password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
            <Button type="submit" fullWidth loading={isSubmitting} disabled={!token}>Update password</Button>
          </form>
        )}
      </section>
    </main>
  );
}
