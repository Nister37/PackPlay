import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import api from '@/lib/api';
import { resetLiveTakeoverSession } from '@/lib/liveTakeoverSession';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser) as User);
        } catch {
          localStorage.removeItem('user');
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', { email, password });

    const { accessToken, refreshToken, user: loggedInUser } = response.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));

    resetLiveTakeoverSession();
    setUser(loggedInUser);

    // Auto-join pending invite if present
    const pendingInviteToken = localStorage.getItem('pendingInviteToken');
    if (pendingInviteToken) {
      localStorage.removeItem('pendingInviteToken');
      try {
        await api.post(`/invitations/${pendingInviteToken}/join`);
      } catch {
        // Silently ignore — user may already be a member or invite expired
      }
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      resetLiveTakeoverSession();
      setUser(null);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    await api.post('/auth/register', { email, password, name });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
