import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResendVerificationPage } from './ResendVerificationPage';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));
const post = vi.mocked(api.post);

beforeEach(() => post.mockReset());

describe('account recovery pages', () => {
  it('requests a password reset without exposing account existence', async () => {
    post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /email reset link/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/auth/password-reset/request', { email: 'person@example.com' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/check your email/i);
  });

  it('resends verification to a prefilled address', async () => {
    post.mockResolvedValue({ data: {} });
    render(<MemoryRouter initialEntries={['/resend-verification?email=user%40example.com']}><ResendVerificationPage /></MemoryRouter>);
    expect(screen.getByLabelText('Email')).toHaveValue('user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /send verification/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/auth/resend-verification', { email: 'user@example.com' }));
  });

  it('rejects mismatched passwords before calling the API', async () => {
    render(<MemoryRouter initialEntries={['/reset-password?token=valid']}><ResetPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different123' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(post).not.toHaveBeenCalled();
  });
});
