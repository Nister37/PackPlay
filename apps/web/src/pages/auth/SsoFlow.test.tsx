import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { LoginPage } from './LoginPage';
import { AuthCallbackPage } from './AuthCallbackPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const post = vi.mocked(api.post);
const get = vi.mocked(api.get);
const patch = vi.mocked(api.patch);
const del = vi.mocked(api.delete);

describe('SSO and Settings flow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders Google SSO button and triggers authorization URL redirect on click', async () => {
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    window.location = { ...originalLocation, href: '' } as any;

    post.mockResolvedValueOnce({
      data: { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test' },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const ssoBtn = screen.getByRole('button', { name: /continue with google/i });
    expect(ssoBtn).toBeInTheDocument();

    fireEvent.click(ssoBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/auth/sso/google/start',
        expect.objectContaining({ returnUrl: expect.stringContaining('/auth/callback') }),
      );
      expect(window.location.href).toContain('accounts.google.com');
    });

    window.location = originalLocation as any;
  });

  it('displays helpful explanation when redirected with SSO_LINK_REQUIRED error', async () => {
    render(
      <MemoryRouter initialEntries={['/login?error=SSO_LINK_REQUIRED']}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/an account with this email already exists/i),
    ).toBeInTheDocument();
  });

  it('handles tokens received in AuthCallbackPage and sets session', async () => {
    const setSessionMock = vi.fn();
    const testUser = { id: 'u-1', email: 'sso@example.com', name: 'SSO User', emailVerified: true, createdAt: '' };

    render(
      <AuthContext.Provider
        value={{
          user: null,
          isLoading: false,
          isAuthenticated: false,
          login: async () => {},
          logout: async () => {},
          register: async () => {},
          setSession: setSessionMock,
        }}
      >
        <MemoryRouter
          initialEntries={[
            `/auth/callback?accessToken=token123&refreshToken=refresh456&user=${encodeURIComponent(
              JSON.stringify(testUser),
            )}`,
          ]}
        >
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(setSessionMock).toHaveBeenCalledWith(
        { accessToken: 'token123', refreshToken: 'refresh456' },
        testUser,
      );
    });
  });

  it('renders connected methods and allows disconnecting when multiple exist in Settings', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/auth/sso/methods')) {
        return Promise.resolve({
          data: [
            { type: 'PASSWORD', email: 'user@example.com' },
            { type: 'SSO', provider: 'GOOGLE', email: 'user@example.com' },
          ],
        });
      }
      if (url.includes('/equipment-catalogue/preferences/me')) {
        return Promise.resolve({ data: { personalizationEnabled: true } });
      }
      return Promise.reject(new Error('not found'));
    });

    del.mockResolvedValueOnce({ data: { disconnected: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Account Settings')).toBeInTheDocument();
    expect(await screen.findByText('Google Account')).toBeInTheDocument();
    expect(screen.getByText('Email & Password')).toBeInTheDocument();

    const disconnectBtn = screen.getByRole('button', { name: /disconnect/i });
    expect(disconnectBtn).not.toBeDisabled();

    fireEvent.click(disconnectBtn);

    await waitFor(() => {
      expect(del).toHaveBeenCalledWith('/auth/sso/GOOGLE');
    });
  });

  it('toggles equipment suggestion personalization ranking', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/auth/sso/methods')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/equipment-catalogue/preferences/me')) {
        return Promise.resolve({ data: { personalizedRanking: false } });
      }
      return Promise.reject(new Error('not found'));
    });

    patch.mockResolvedValueOnce({ data: { personalizedRanking: true } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Account Settings')).toBeInTheDocument();

    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith(
        '/equipment-catalogue/preferences/me',
        { personalizedRanking: true },
      );
    });
  });
});
