import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/auth/password-reset/request', { email });
      setSent(true);
    } catch {
      setError('Unable to request a reset link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-brand-bg px-6 py-16">
      <section className="mx-auto max-w-[390px] bg-white border border-brand-border p-6">
        <h1 className="font-headline text-2xl font-bold uppercase">Reset access code</h1>
        <p className="font-body text-sm text-brand-muted mt-2 mb-6">We will email a one-time reset link if the account exists.</p>
        {sent ? (
          <div role="status" className="border border-success p-4 text-sm text-success">Check your email for the password reset link.</div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
            <Button type="submit" fullWidth loading={isSubmitting}>Email reset link</Button>
          </form>
        )}
        <Link to="/login" className="mt-6 inline-block font-headline text-xs uppercase underline">Back to login</Link>
      </section>
    </main>
  );
}
